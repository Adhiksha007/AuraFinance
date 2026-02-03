import yfinance as yf
import pandas as pd
import numpy as np
import logging
from datetime import datetime, timedelta
from app.services.tickers import TICKERS
import concurrent.futures

logger = logging.getLogger(__name__)

def fetch_bulk_market_data(tickers: list, period="2y", interval="1d") -> pd.DataFrame:
    """
    Fetch historical data for multiple tickers at once using yf.download.
    Returns a MultiIndex DataFrame (level 0 = Ticker, level 1 = OHLCV).
    """
    try:
        # Standardizing ticker format
        # Ensure ^GSPC is included for Market Regime
        symbols = [t if isinstance(t, str) else t['symbol'] for t in tickers]
        if "^GSPC" not in symbols:
            symbols.append("^GSPC")
            
        logger.info(f"Fetching bulk data for {len(symbols)} tickers...")
        
        # group_by='ticker' makes the top level index the ticker symbol
        data = yf.download(
            tickers=symbols, 
            period=period, 
            interval=interval, 
            group_by='ticker', 
            auto_adjust=True, 
            threads=True,
            progress=False
        )
        return data
    except Exception as e:
        logger.error(f"Error fetching bulk data: {e}")
        return pd.DataFrame()

def calculate_technicals(df: pd.DataFrame) -> pd.DataFrame:
    """
    Calculate technical indicators:
    - SMA 50, SMA 200 (for market regime)
    - EMA 20
    - ATR 14
    - RSI 14 (Wilder's Smoothing)
    - Volume SMA 20
    - Daily Range (High - Low)
    """
    if df.empty or len(df) < 50:
        return df
    
    # Fill gaps to prevent NaN streaks from breaking indicators
    df = df.ffill().bfill()
    
    # --- Trend ---
    df['SMA50'] = df['Close'].rolling(window=50).mean()
    df['SMA200'] = df['Close'].rolling(window=200).mean()
    df['EMA20'] = df['Close'].ewm(span=20, adjust=False).mean()
    
    # --- Volume ---
    df['VolSMA20'] = df['Volume'].rolling(window=20).mean()
    
    # --- Volatility (ATR) ---
    high = df['High']
    low = df['Low']
    close_prev = df['Close'].shift(1)
    
    tr1 = high - low
    tr2 = (high - close_prev).abs()
    tr3 = (low - close_prev).abs()
    tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
    
    # ATR 14 (Wilder's uses alpha=1/n)
    df['ATR'] = tr.ewm(alpha=1/14, min_periods=14, adjust=False).mean()

    df['ATR_MA50'] = df['ATR'].rolling(window=50).mean()
    df['Vol_Regime'] = df['ATR'] / df['ATR_MA50']
    
    # Daily Range for Flash Crash check
    df['DailyRange'] = high - low

    # --- Momentum (RSI - Wilder's) ---
    delta = df['Close'].diff()
    gain = delta.where(delta > 0, 0.0)
    loss = -delta.where(delta < 0, 0.0)
    
    avg_gain = gain.ewm(alpha=1/14, min_periods=14, adjust=False).mean()
    avg_loss = loss.ewm(alpha=1/14, min_periods=14, adjust=False).mean()
    
    rs = avg_gain / avg_loss
    df['RSI'] = 100 - (100 / (1 + rs))
    
    return df

def check_earnings_proximity(symbol: str) -> bool:
    """
    Check if earnings are within the next 3 business days.
    """
    # Skip ETFs/Indices/Crypto that don't have earnings
    # Common ETFs in our list: SPY, QQQ, DIA, IEF, HYG, GLD, IAU
    if symbol in ['SPY', 'QQQ', 'DIA', 'IEF', 'HYG', 'GLD', 'IAU', 'BTC-USD', '^GSPC']:
        return False

    try:
        ticker = yf.Ticker(symbol)
        # calendar is usually a dict or dataframe
        cal = ticker.calendar
        if cal is None or (isinstance(cal, pd.DataFrame) and cal.empty):
             return False
        
        # yfinance calendar structure varies, handle safely
        earnings_date = None
        if isinstance(cal, dict) and 'Earnings Date' in cal:
             # If list of dates, take first
             dates = cal['Earnings Date']
             if dates:
                 earnings_date = dates[0]
        elif isinstance(cal, pd.DataFrame):
             # Usually the index or a column
             if 'Earnings Date' in cal.index:
                 earnings_date = cal.loc['Earnings Date'].iloc[0]
             elif not cal.empty:
                 # Some versions return date as index or first row
                 earnings_date = cal.iloc[0, 0]

        if earnings_date:
            # Ensure datetime
            if not isinstance(earnings_date, datetime):
                 earnings_date = pd.to_datetime(earnings_date).to_pydatetime()
            
            # Check proximity
            today = datetime.now()
            days_diff = (earnings_date.date() - today.date()).days
            return 0 <= days_diff <= 3

        return False
    except Exception:
        # If API fails or data missing, assume safe but log silent
        return False

def generate_signal(row, is_market_bullish: bool, earnings_impending: bool) -> dict:
    """
    Generate BUY/SELL/HOLD signal based on professional strategy.
    RESILIENT VERSION:
    - Calculates Risk metrics (SL/TP) if Price & ATR are available, even if other signals missing.
    - Provides detailed info on missing data.
    """
    price = row['Close']
    sma50 = row.get('SMA50')
    ema20 = row.get('EMA20')
    rsi = row.get('RSI')
    vol = row.get('Volume')
    vol_regime = row.get('Vol_Regime', 1.0)
    vol_avg = row.get('VolSMA20')
    atr = row.get('ATR')
    range_day = row.get('DailyRange')
    
    # --- 1. Absolute Criticals (Price & ATR) ---
    # Need ATR for risk calc. Need Price for... well, everything.
    if pd.isna(price) or pd.isna(atr):
        return {
            "signal": "HOLD", 
            "confidence": 0, 
            "rationale": "Insufficient Critical Data: Missing Price or ATR.", 
            "stop_loss": 0, "take_profit": 0, "risk_reward": 0, "volume_status": "Neutral",
            "trend_strength": 0, "vol_regime": 0
        }

    # --- 2. Calculate Risk Logic (We have Price + ATR) ---
    # Base multipliers
    base_sl_mult = 2.0
    base_tp_mult = 3.0

    # Adjust multipliers based on volatility
    # If regime > 1.2 (High Vol), widen the stop. If < 0.8 (Low Vol), tighten it.
    dynamic_sl_mult = base_sl_mult * vol_regime
    dynamic_tp_mult = base_tp_mult * vol_regime

    stop_loss = price - (atr * dynamic_sl_mult)
    take_profit = price + (atr * dynamic_tp_mult)
    risk = price - stop_loss
    reward = take_profit - price
    
    rr_ratio = 0
    if risk > 0.00001: # Avoid ZeroDivision
        rr_ratio = round(reward / risk, 2)
    
    # --- 3. Check Metric Availability for Signal Logic ---
    # Variables required for the strategy: SMA50, EMA20, RSI, Volume, VolAvg
    required_vars = {
        'SMA50': sma50, 'EMA20': ema20, 'RSI': rsi, 
        'Volume': vol, 'VolAvg': vol_avg, 'DailyRange': range_day
    }
    
    missing_vars = [k for k, v in required_vars.items() if pd.isna(v)]
    
    if missing_vars:
        return {
            "signal": "HOLD",
            "confidence": 0,
            "rationale": f"Insufficient Signal Data. Missing: {missing_vars}",
            "stop_loss": round(stop_loss, 2), # Return these!
            "take_profit": round(take_profit, 2),
            "risk_reward": rr_ratio,
            "volume_status": "Unknown",
            "trend_strength": 0,
            "vol_regime": round(vol_regime, 2)
        }

    # --- 4. Logic Execution (All Data Present) ---

    volume_status = "Neutral"
    if vol > (vol_avg * 1.1):
        volume_status = "High (Above Avg)"
    elif vol < (vol_avg * 0.9):
        volume_status = "Low (Below Avg)"
    
    trend_strength = ((ema20 - sma50) / sma50) * 100

    # Liquidity Filter
    daily_dollar_vol = price * vol_avg
    if price < 5.0 or daily_dollar_vol < 1_000_000:
        return {
            "signal": "HOLD",
            "confidence": 0,
            "rationale": "Liquidity Filter: Price < $5 or Daily Volume < $1M.",
            "stop_loss": round(stop_loss, 2), 
            "take_profit": round(take_profit, 2), 
            "risk_reward": rr_ratio, 
            "volume_status": volume_status,
            "trend_strength": round(trend_strength, 2),
            "vol_regime": round(vol_regime, 2)
        }

    # Volatility Filter
    if range_day > (4 * atr):
        return {
            "signal": "HOLD",
            "confidence": 0,
            "rationale": "Volatility Alert: Daily Range exceeds 4x ATR.",
            "stop_loss": round(stop_loss, 2), 
            "take_profit": round(take_profit, 2), 
            "risk_reward": rr_ratio, 
            "volume_status": volume_status,
            "trend_strength": round(trend_strength, 2),
            "vol_regime": round(vol_regime, 2)
        }

    # BUY Signal
    if (is_market_bullish and 
        price > sma50 and 
        ema20 > sma50 and 
        rsi < 60 and 
        vol > (vol_avg * 1.1)):
        
        confidence = 85
        rationale = (f"Market Bullish. Price (${price:.2f}) > SMA50. "
                     f"Momentum (EMA20 > SMA50) aligned. "
                     f"Volume breakout ({volume_status}).")

        if earnings_impending:
            confidence = 40
            rationale += " WARNING: Earnings pending within 3 days."
        
        return {
            "signal": "BUY" if confidence > 50 else "HOLD",
            "confidence": confidence,
            "rationale": rationale,
            "stop_loss": round(stop_loss, 2),
            "take_profit": round(take_profit, 2),
            "risk_reward": rr_ratio,
            "volume_status": volume_status,
            "trend_strength": round(trend_strength, 2),
            "vol_regime": round(vol_regime, 2)
        }

    # SELL Signal
    elif rsi > 70:
        return {
            "signal": "SELL",
            "confidence": 90,
            "rationale": f"Overbought (RSI {rsi:.1f}).",
            "stop_loss": round(stop_loss, 2),
            "take_profit": round(take_profit, 2),
            "risk_reward": rr_ratio,
            "volume_status": volume_status,
            "trend_strength": round(trend_strength, 2),
            "vol_regime": round(vol_regime, 2)
        }
        
    # HOLD Signal
    else:
        return {
            "signal": "HOLD",
            "confidence": 50,
            "rationale": (f"Market {'Bullish' if is_market_bullish else 'Bearish/Neutral'}. "
                          f"Trend Strength: {trend_strength:.2f}%. RSI: {rsi:.1f}."),
            "stop_loss": round(stop_loss, 2),
            "take_profit": round(take_profit, 2),
            "risk_reward": rr_ratio,
            "volume_status": volume_status,
            "trend_strength": round(trend_strength, 2),
            "vol_regime": round(vol_regime, 2)
        }

# --- Cache Storage ---
_MARKET_CACHE = {
    "data": [],
    "last_updated": None
}

async def get_ai_recommendations(force_refresh: bool = False):
    global _MARKET_CACHE
    
    # Check cache validity (15 minutes)
    now = datetime.now()
    if (not force_refresh and 
        _MARKET_CACHE["data"] and 
        _MARKET_CACHE["last_updated"] and 
        (now - _MARKET_CACHE["last_updated"]) < timedelta(minutes=15)):
        
        logger.info("Returning cached market recommendations.")
        return _MARKET_CACHE["data"]
        
    logger.info("Cache expired or empty. Fetching fresh market data...")
    recommendations = []
    
    try:
        # 1. Fetch ALL data in bulk
        target_tickers = TICKERS 
        bulk_df = fetch_bulk_market_data(target_tickers, period="2y") 
        
        if bulk_df.empty:
            logger.error("Bulk fetch returned empty DataFrame.")
            return []
            
        # 2. Determine Dynamic Market Regime (^GSPC)
        is_market_bullish = False
        # Use .xs for robustness if MultiIndex (Ticker, PriceFields)
        if "^GSPC" in bulk_df.columns.levels[0]:
            try:
                sp500_df = bulk_df.xs("^GSPC", level=0, axis=1).copy()
                sp500_df = calculate_technicals(sp500_df)
                
                if not sp500_df.empty and len(sp500_df) > 10:
                    last_sp = sp500_df.iloc[-1]
                    prev_sp_10 = sp500_df.iloc[-10] # 10 days ago
                    
                    # Regime: Price > SMA200 AND Slope Positive (Current SMA200 > SMA200_10daysAgo)
                    if (not pd.isna(last_sp['SMA200']) and 
                        last_sp['Close'] > last_sp['SMA200'] and 
                        last_sp['SMA200'] > prev_sp_10['SMA200']):
                        is_market_bullish = True
            except Exception as e:
                logger.error(f"Error calculating market regime: {e}")
        
        # 3. Process each ticker
        for t_obj in target_tickers:
            symbol = t_obj['symbol']
            name = t_obj['name']
            
            # Skip if symbol not in bulk data
            if symbol not in bulk_df.columns.levels[0]:
                print(f"DEBUG: {symbol} not found in bulk data.")
                continue
                
            # Robust extraction
            try:
                df = bulk_df.xs(symbol, level=0, axis=1).copy()
            except Exception:
                continue
            
            # Skip if empty or too short
            if df.empty or len(df) < 50:
                continue
                
            df.dropna(how='all', inplace=True) 
            df = calculate_technicals(df)
            
            if len(df) < 2:
                 continue

            latest = df.iloc[-1]
            prev = df.iloc[-2]
            
            # Check Earnings (Optional: Make async in future for speed)
            earnings_impending = check_earnings_proximity(symbol)
            
            # Generate Signal
            sig_data = generate_signal(latest, is_market_bullish, earnings_impending)
            
            # Calculate change
            change_p = 0.0
            if prev['Close'] != 0:
                change_p = ((latest['Close'] - prev['Close']) / prev['Close']) * 100
                
            # History
            history = df.tail(30).reset_index()
            history_data = []
            for idx, row_h in history.iterrows():
                date_val = row_h['Date'] 
                close_val = row_h['Close']
                if pd.notna(close_val):
                    history_data.append({
                        "date": date_val.strftime("%Y-%m-%d"), 
                        "value": float(close_val)
                    })
            
            rec = {
                "symbol": symbol,
                "name": name,
                "price": float(latest['Close']),
                "change_percent": float(change_p),
                "signal": sig_data['signal'],
                "confidence": sig_data['confidence'],
                "rationale": sig_data['rationale'],
                "history": history_data,
                "stop_loss": sig_data['stop_loss'],
                "take_profit": sig_data['take_profit'],
                "risk_reward": sig_data['risk_reward'],
                "is_market_bullish": is_market_bullish,
                "volume_status": sig_data['volume_status'],
                
                # New Metadata
                "trend_strength": sig_data['trend_strength'],
                "vol_regime": sig_data.get('vol_regime', 1.0),
                "last_updated": datetime.now().isoformat()
            }
            recommendations.append(rec)
        
        # Update Cache
        if recommendations:
            _MARKET_CACHE["data"] = recommendations
            _MARKET_CACHE["last_updated"] = datetime.now()
            
    except Exception as e:
        logger.error(f"Error in get_ai_recommendations: {e}")
        import traceback
        traceback.print_exc()
        # Return stale cache if available and fetch failed
        if _MARKET_CACHE["data"]:
             logger.warning("Returning stale cache due to fetch error.")
             return _MARKET_CACHE["data"]
        
    return recommendations


