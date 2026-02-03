import yfinance as yf
import pandas as pd
from datetime import datetime
import concurrent.futures
import numpy as np
import joblib
from typing import List, Dict, Any, Optional
from app.services.sentiment import sentiment_engine

def get_historical_data(ticker: str, period: str="1mo", interval: str='1d') -> pd.DataFrame:
    stock = yf.Ticker(ticker)
    return stock.history(period=period, interval=interval)

def get_current_price(ticker: str) -> Optional[float]:
    try:
        stock = yf.Ticker(ticker)
        return stock.history(period="1d")["Close"].iloc[-1]
    except Exception:
        return None

def fetch_data(pkl_file) -> pd.DataFrame:
    data = joblib.load(pkl_file)

    closing_data = {}
    for asset, asset_data in data.items(): 
        hist = asset_data.get("history")
        if isinstance(hist, pd.DataFrame) and not hist.empty:
            if "Close" in hist.columns:
                series = hist["Close"]
                closing_data[asset] = series

    # Combine into one DataFrame (aligned by date)
    returns = pd.concat(closing_data, axis=1)
    returns = returns.interpolate(method='time', limit_direction='both', axis=0)
    # Convert columns to string for JSON serialization
    returns = returns.pct_change(fill_method=None).dropna()
    returns.columns = returns.columns.astype(str)
    return returns

def calculate_annual_returns(assets, pkl_file):
    """
    Calculate annualized returns and volatility for given assets
    using cached historical data from joblib file.
    """
    # Load cached data
    data = joblib.load(pkl_file)
    
    # Collect closing prices
    prices = pd.DataFrame()
    for ticker in assets:
        asset_data = data.get(ticker, {})
        hist = asset_data.get("history")
        if hist is None or hist.empty:
            raise ValueError(f"No cached history found for {ticker}")

        if "Close" not in hist.columns:
            raise ValueError(f"No 'Close' data for {ticker}")

        prices[ticker] = hist["Close"].tail(252)

    # --- Daily returns ---
    daily_returns = prices.pct_change(fill_method=None).dropna()

    # --- Annualized Mean Return ---
    annualized_returns = daily_returns.mean() * 252

    # --- Annualized Volatility ---
    annual_volatility = daily_returns.std() * np.sqrt(252)

    # Combine into DataFrame
    df = pd.DataFrame({
        "Annualized Return": annualized_returns.round(4),
        "Annual Volatility": annual_volatility.round(4)
    })

    return df

def create_table_values(weights: Dict[str, float], investment_amount: float, investment_horizon: int, risk_free: float, expected_return_annual: float, pkl_file) -> pd.DataFrame:
    """
    Generalized data engine that reconciles individual asset data 
    with the unified portfolio projection.
    """
    tickers = list(weights.keys())
    data = joblib.load(pkl_file)

    def format_market_cap(val):
        if not val or not isinstance(val, (int, float)):
            return "N/A"
        if val >= 1e12:
            return f"${val/1e12:.2f}T"
        elif val >= 1e9:
            return f"${val/1e9:.2f}B"
        elif val >= 1e6:
            return f"${val/1e6:.2f}M"
        return f"${val:,.0f}"
    rows = []
    for ticker in tickers:
        asset_data = data.get(ticker, {})
        
        # Latest close price (from history)
        hist = asset_data.get("history")
        close_price = hist["Close"].iloc[-1]
        if isinstance(close_price, pd.Series):  
            close_price = close_price.squeeze()  # reduce Series to scalar
        close_price = float(close_price) if pd.notna(close_price) else 0

        # Fundamentals (cached in pkl)
        info = asset_data.get("info", {})
        company_name = info.get("longName", ticker)
        market_cap = info.get("marketCap")
        beta = info.get("beta")
        pe_ratio = info.get("trailingPE")
        dividend_yield = info.get("dividendYield")
        roe = info.get("returnOnEquity")

        rows.append({
            "Ticker": ticker,
            "Company": company_name if pd.notna(company_name) else None,
            "Market Cap": format_market_cap(market_cap),
            "Beta": beta if pd.notna(beta) else 0,
            "P/E": pe_ratio if pd.notna(pe_ratio) else 0,
            "Dividend Yield": dividend_yield if pd.notna(dividend_yield) else 0,
            "ROE": roe if pd.notna(roe) else 0,
        })

    df = pd.DataFrame(rows)

    annual_data = calculate_annual_returns(tickers, pkl_file)
    
    # Map index (Tickers) to df rows
    df.set_index("Ticker", inplace=True)
    df["Annual Return %"] = annual_data["Annualized Return"].values * 100
    df["Volatility %"] = annual_data["Annual Volatility"].values * 100
    df["Sharpe Ratio"] = (df['Annual Return %'] / 100 - risk_free) / (df["Volatility %"] / 100)
    # Handle division by zero or nan in Sharpe
    df["Sharpe Ratio"] = df["Sharpe Ratio"].fillna(0.0)
    
    df["Weight"] = pd.Series(weights)
    df["Investment Amount"] = df["Weight"] * float(investment_amount)
    
    # Calculate projected return amount for this specific asset
    # FV = P * (1 + r)^t
    df["Returned Amount"] = df["Investment Amount"] * ((1 + (df["Annual Return %"] / 100)) ** investment_horizon)
    
    df.reset_index(inplace=True)
    
    return df

def calculate_portfolio_beta(df_values: pd.DataFrame) -> Optional[float]:
    """
    Calculates portfolio beta using the output from create_table_values.
    
    Args:
        df_values : DataFrame returned by create_table_values
    """
    valid_data = df_values.dropna(subset=['Beta'])
    
    if valid_data.empty:
        return None
    total_beta = (valid_data['Weight'] * valid_data['Beta']).sum()
    total_weight = valid_data['Weight'].sum()

    return total_beta / total_weight if total_weight > 0 else None


def fetch_realtime_news(tickers: List[str], timeout:int=1, limit:int=10) -> pd.DataFrame:
    """
    Pulls news for multiple tickers in parallel and returns a cleaned pandas DataFrame.
    """
    df = sentiment_engine.get_news(tickers, timeout=timeout, limit=limit)
    if not df.empty:
        df['Date'] = pd.to_datetime(df["Published"], errors='coerce') # Handle parsing for sorting
        df['Date'] = df['Date'].dt.strftime('%b %d, %Y') # Format back to string
    return df

def get_ticker_summary(ticker_symbol: str) -> pd.DataFrame:
    """
    Fetch fundamental summary data for a ticker.
    """
    stock = yf.Ticker(ticker_symbol)
    info = stock.info
    calendar = stock.calendar
    
    # Helper: Convert dates/timestamps to "Month Day, Year"
    def clean_date(val):
        if not val:
            return "N/A"
        # If it's a list (like from calendar['Earnings Date'])
        if isinstance(val, list) and len(val) > 0:
            val = val[0]
        # Convert Unix timestamp or datetime object
        try:
            if isinstance(val, (int, float)):
                return datetime.fromtimestamp(val).strftime('%b %d, %Y')
            return val.strftime('%b %d, %Y')
        except:
            return str(val)

    def fmt_pct(val):
        return f"{val*100:.2f}%" if val else "N/A"

    # Safely get Earnings Date from calendar if info fails
    # calendar can be None or empty
    earn_date = "N/A"
    if calendar and 'Earnings Date' in calendar:
        earn_date = clean_date(calendar['Earnings Date'])

    summary_data = {
        "Attribute": [
            "Previous Close", "Open", "Bid", "Ask", "Day's Range",
            "52 Week Range", "Volume", "Avg. Volume", "Market Cap",
            "Beta (5Y Monthly)", "PE Ratio (TTM)", "EPS (TTM)",
            "Earnings Date (est.)", "Forward Dividend & Yield", "Ex-Dividend Date",
            "1y Target Est"
        ],
        "Value": [
            info.get("previousClose"),
            info.get("open"),
            f"{info.get('bid')} x {info.get('bidSize')}",
            f"{info.get('ask')} x {info.get('askSize')}",
            f"{info.get('dayLow')} - {info.get('dayHigh')}",
            f"{info.get('fiftyTwoWeekLow')} - {info.get('fiftyTwoWeekHigh')}",
            f"{info.get('volume', 0):,}",
            f"{info.get('averageVolume', 0):,}",
            f"{info.get('marketCap', 0):,}",
            info.get("beta"),
            info.get("trailingPE"),
            info.get("trailingEps"),
            earn_date, 
            f"{info.get('dividendRate')} ({fmt_pct(info.get('dividendYield'))})",
            clean_date(info.get("exDividendDate")),
            info.get("targetMeanPrice")
        ]
    }
    
    return pd.DataFrame(summary_data)
