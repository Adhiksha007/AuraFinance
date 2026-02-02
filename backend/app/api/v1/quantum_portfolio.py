from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from app.services.data_ingestion import fetch_data, calculate_annual_returns, create_table_values, calculate_portfolio_beta
from app.services.quantum_service import compute_mu_cov, build_qubo, solve_qubo_with_qaoa, unified_portfolio_analysis, monte_carlo_simulation
from app.services.tickers import get_tickers
from app.services.sentiment import sentiment_engine
import numpy as np
import yfinance as yf
from datetime import datetime, timedelta
from typing import Dict, Any, Tuple, Optional, List
import pandas as pd
import joblib
import os


router = APIRouter()

ALPHA = 0.05
SEED = 42
PKL_FILE = "assets_data.pkl"
cached_returns = None

class PortfolioRequest(BaseModel):
    risk_tolerance: float = Field(..., ge=0, le=1, description="User risk tolerance (0-1)")
    investment_amount: float = Field(..., gt=0, description="Investment amount in USD")
    investment_horizon: int = Field(..., gt=0, description="Investment horizon in years")
    num_assets: int = Field(..., gt=0, description="Number of assets to select")

class MonteCarloRequest(BaseModel):
    weights: Dict[str, float]
    investment_amount: float
    investment_horizon: int
    tickers: List[str]

@router.post("/optimize")
def optimize_portfolio(request: PortfolioRequest):
    """
    Optimizes portfolio using Quantum/QAOA and returns comprehensive analysis.
    """
    try:
        results, table_data, port_beta, sentiment = quantum_portfolio_logic(
            request.risk_tolerance,
            request.investment_amount,
            request.investment_horizon,
            request.num_assets
        )
        # Convert table_data (DataFrame) to dict records for JSON response
        table_data_json = table_data.to_dict(orient="records") if not table_data.empty else []
        sentiment_json = sentiment.to_dict() if not sentiment.empty else []
        response_data = {
            "results": results,
            "table_data": table_data_json,
            "beta": port_beta,
            "sentiment": sentiment_json
        }
        return  replace_nan(response_data)
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/monte-carlo")
def run_monte_carlo(request: MonteCarloRequest):
    """
    Runs Monte Carlo simulation for a specific portfolio configuration.
    """
    try:
        data = monte_carlo_analysis_logic(
            request.weights,
            request.investment_amount,
            request.investment_horizon,
            request.tickers
        )
        return data
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

def replace_nan(obj):
    """
    Recursively replace NaN and Infinite values with 0.0 (or None) to ensure JSON compliance.
    """
    if isinstance(obj, float):
        if np.isnan(obj) or np.isinf(obj):
            return 0.0
        return obj
    elif isinstance(obj, dict):
        return {k: replace_nan(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [replace_nan(i) for i in obj]
    return obj

def fetch_and_update_data(assets, force_refresh=False):
    data = {}
    global PKL_FILE
    
    # 1. Load existing data
    if os.path.exists(PKL_FILE) and not force_refresh:
        data = joblib.load(PKL_FILE)    

    today_dt = datetime.today().replace(hour=0, minute=0, second=0, microsecond=0)
    today_str = today_dt.strftime('%Y-%m-%d')

    for asset in assets:
        if asset not in data:
            data[asset] = {"info": None, "history": None}

        ticker = yf.Ticker(asset)

        # 2. Update Info
        if data[asset]["info"] is None or force_refresh:
            try:
                data[asset]["info"] = ticker.info
            except Exception as e:
                print(f"⚠️ Info error for {asset}: {e}")

        # 3. Update History
        if data[asset]["history"] is None or force_refresh:
            # Full 20-year download
            start_date = (today_dt - timedelta(days=365*20)).strftime('%Y-%m-%d')
            try:
                hist = ticker.history(start=start_date)
                if not hist.empty:
                    hist.columns = hist.columns.get_level_values(0)
                    hist.index = hist.index.tz_localize(None).normalize()
                    data[asset]["history"] = hist
            except Exception as e:
                print(f"⚠️ Download error for {asset}: {e}")
        
        else:
            # Incremental Update Logic
            existing_hist = data[asset]["history"]
            last_date = existing_hist.index.max()
            
            # If the last date in our file is already Today, don't even call the API
            if last_date >= today_dt:
                continue

            # Attempt to fetch from the day after our last record
            fetch_start = (last_date + timedelta(days=1)).strftime('%Y-%m-%d')
            
            try:
                # We fetch without an 'end' date to get everything up to the current moment
                new_hist = ticker.history(start=fetch_start)
                
                if not new_hist.empty:
                    new_hist.columns = new_hist.columns.get_level_values(0)
                    new_hist.index = new_hist.index.tz_localize(None).normalize()
                    
                    # Filter: Only keep rows that are actually NEWER than our last_date
                    new_rows = new_hist[new_hist.index > last_date]
                    
                    if not new_rows.empty:
                        data[asset]["history"] = pd.concat([existing_hist, new_rows])
                        # Safety: remove any accidental duplicates
                        data[asset]["history"] = data[asset]["history"][~data[asset]["history"].index.duplicated(keep='last')]
                    
            except Exception as e:
                print(f"⚠️ Update error for {asset}: {e}")

    # 4. Save
    joblib.dump(data, PKL_FILE)
    return data

def fetch_and_cache_data(force_refresh=False):
    """Fetch stock data once and store in global cache."""
    global cached_returns
    tickers = get_tickers()
    data = fetch_and_update_data(tickers)
    if cached_returns is None or force_refresh:
        # Fetch live stock data
        returns= fetch_data(PKL_FILE)
        cached_returns = returns

    return cached_returns



def quantum_portfolio_logic(risk_tolerance: float, investment_amount: float, investment_horizon: int, k: int) -> Tuple[Dict[str, Any], pd.DataFrame, Optional[float]]:
    tickers = get_tickers()
    returns = fetch_and_cache_data()
    mu, cov = compute_mu_cov(returns, tickers)
    qubo = build_qubo(mu, cov, risk_tolerance, k, tickers)
    selected_vec, selected_assets = solve_qubo_with_qaoa(qubo, tickers, reps=2, maxiter=150)

    results = unified_portfolio_analysis(
        selection_vec=selected_vec,
        selected_assets=selected_assets,
        mu=mu,
        cov=cov,
        tickers=list(mu.index),
        user_risk=risk_tolerance,
        investment_amount=investment_amount,
        investment_horizon_years=investment_horizon,
        alpha=ALPHA,
        seed=SEED
    )
    weights = results['portfolio_config']['weights']
    table_data = create_table_values(weights, investment_amount, investment_horizon, 0.02, results['annualized_stats']['expected_return'], PKL_FILE)
    port_beta = calculate_portfolio_beta(table_data)

    news, sentiment_wide = sentiment_engine.get_latest_sentiment()
    print(news['Ticker'].value_counts())
    sentiment = sentiment_wide.iloc[-1].T.reindex(mu.index) 
    print(sentiment)

    return results, table_data, port_beta, sentiment

    
def monte_carlo_analysis_logic(weights_dict: Dict[str, float], investment_amount: float, investment_horizon: int, tickers: List[str]) -> Dict[str, Any]:
    tickers = get_tickers() 
    returns = fetch_and_cache_data()

    _, cov = compute_mu_cov(returns, tickers)
    # Filter cov for selected assets only
    selected_assets = list(weights_dict.keys())

    selected_cov = cov.loc[selected_assets, selected_assets]
    
    annualized_returns = calculate_annual_returns(selected_assets, PKL_FILE)["Annualized Return"]
    aligned_returns = annualized_returns.reindex(selected_assets).fillna(0) # Assuming simple series, but calculate_annual_returns returns DF
    sim_results = monte_carlo_simulation(
        np.array(list(weights_dict.values())),
        annualized_returns, # passing raw values
        selected_cov,
        initial_investment=investment_amount,
        time_horizon=investment_horizon * 252, # Horizon in years -> days
        num_simulations=1000,
        percentiles=[5, 25, 50, 75, 95]
    )
    return sim_results['visualization']
