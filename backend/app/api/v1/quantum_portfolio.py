from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from app.services.data_ingestion import fetch_data, calculate_annual_returns, create_table_values, calculate_portfolio_beta
from app.services.quantum_service import compute_mu_cov, build_qubo, solve_qubo_with_qaoa, unified_portfolio_analysis, monte_carlo_simulation
from app.services.tickers import get_tickers
from app.services.sentiment import sentiment_engine
from app.services.cache_manager import cache
from app.services.backtesting_service import run_backtest
import numpy as np
import yfinance as yf
from datetime import datetime, timedelta
from typing import Dict, Any, Tuple, Optional, List
import pandas as pd
import joblib
import os
import json
import asyncio
import threading
from fastapi.responses import StreamingResponse

import logging
logger = logging.getLogger('app.api.v1.quantum_portfolio')

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

class BacktestRequest(BaseModel):
    weights: Dict[str, float] = Field(..., description="Portfolio weights")
    tickers: List[str] = Field(..., description="List of ticker symbols")
    start_date: str = Field(..., description="Start date in YYYY-MM-DD format")
    end_date: str = Field(..., description="End date in YYYY-MM-DD format")
    initial_investment: float = Field(..., gt=0, description="Initial investment amount")

@router.post("/optimize-stream")
async def optimize_portfolio_stream(request: PortfolioRequest):
    """
    Optimizes portfolio using Quantum/QAOA with real-time progress streaming via SSE.
    """
    async def event_generator():
        from app.utils.log_streamer import get_global_streamer
        
        streamer = get_global_streamer()
        result_data = {}
        error_data = {}
        
        try:
            streamer.start()
            yield f"data: {json.dumps({'type': 'info', 'message': 'Starting portfolio optimization...'})}\n\n"
            await asyncio.sleep(0.1)
            
            def run_optimization():
                try:
                    results, table_data, port_beta, sentiment = quantum_portfolio_logic(
                        request.risk_tolerance, request.investment_amount,
                        request.investment_horizon, request.num_assets
                    )
                    result_data['success'] = {
                        "results": results,
                        "table_data": table_data.to_dict(orient="records") if not table_data.empty else [],
                        "beta": port_beta,
                        "sentiment": sentiment.to_dict() if not sentiment.empty else {}
                    }
                except Exception as e:
                    import traceback
                    error_data['error'] = {'message': str(e), 'traceback': traceback.format_exc()}
            
            thread = threading.Thread(target=run_optimization)
            thread.start()
            
            while thread.is_alive():
                log_msg = streamer.get_message(timeout=0.1)
                if log_msg:
                    yield f"data: {json.dumps({'type': 'log', 'message': log_msg})}\n\n"
                await asyncio.sleep(0.05)
            
            thread.join()
            
            while True:
                log_msg = streamer.get_message(timeout=0.1)
                if not log_msg:
                    break
                yield f"data: {json.dumps({'type': 'log', 'message': log_msg})}\n\n"
            
            streamer.stop()
            
            if error_data:
                yield f"data: {json.dumps({'type': 'error', 'message': error_data['error']['message']})}\n\n"
            elif result_data:
                yield f"data: {json.dumps({'type': 'complete', 'data': replace_nan(result_data['success'])})}\n\n" 
                
        except Exception as e:
            streamer.stop()
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
    
    return StreamingResponse(event_generator(), media_type="text/event-stream",
                           headers={"Cache-Control": "no-cache", "Connection": "keep-alive"})




@router.post("/monte-carlo-stream")
async def run_monte_carlo_stream(request: MonteCarloRequest):
    """
    Runs Monte Carlo simulation with real-time progress streaming via SSE.
    """
    async def event_generator():
        from app.utils.log_streamer import get_global_streamer
        
        streamer = get_global_streamer()
        result_data = {}
        error_data = {}
        
        try:
            streamer.start()
            yield f"data: {json.dumps({'type': 'info', 'message': 'Starting Monte Carlo simulation...'})}\n\n"
            await asyncio.sleep(0.1)
            
            def run_simulation():
                try:
                    data = monte_carlo_analysis_logic(
                        request.weights,
                        request.investment_amount,
                        request.investment_horizon,
                        request.tickers
                    )
                    result_data['success'] = data
                except Exception as e:
                    import traceback
                    error_data['error'] = {'message': str(e), 'traceback': traceback.format_exc()}
            
            thread = threading.Thread(target=run_simulation)
            thread.start()
            
            while thread.is_alive():
                log_msg = streamer.get_message(timeout=0.1)
                if log_msg:
                    yield f"data: {json.dumps({'type': 'log', 'message': log_msg})}\n\n"
                await asyncio.sleep(0.05)
            
            thread.join()
            
            while True:
                log_msg = streamer.get_message(timeout=0.1)
                if not log_msg:
                    break
                yield f"data: {json.dumps({'type': 'log', 'message': log_msg})}\n\n"
            
            streamer.stop()
            
            if error_data:
                yield f"data: {json.dumps({'type': 'error', 'message': error_data['error']['message']})}\n\n"
            elif result_data:
                yield f"data: {json.dumps({'type': 'complete', 'data': result_data['success']})}\n\n"
                
        except Exception as e:
            streamer.stop()
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
    
    return StreamingResponse(event_generator(), media_type="text/event-stream",
                           headers={"Cache-Control": "no-cache", "Connection": "keep-alive"})

@router.post("/compare")
def compare_portfolios(request: PortfolioRequest):
    """
    Compare quantum vs classical portfolio optimization.
    Returns metrics for both approaches side-by-side.
    """
    try:
        comparison = calculate_comparison_metrics(
            request.risk_tolerance,
            request.num_assets,
            request.investment_amount,
            request.investment_horizon
        )
        return replace_nan(comparison)
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/backtest")
def backtest_portfolio(request: BacktestRequest):
    """
    Backtest a portfolio against historical data.
    Compares optimized weights vs equal-weight baseline.
    """
    try:
        result = run_backtest(
            weights=request.weights,
            tickers=request.tickers,
            start_date=request.start_date,
            end_date=request.end_date,
            initial_investment=request.initial_investment
        )
        return replace_nan(result)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/backtest/cache")
def clear_backtest_cache():
    """
    Clear all cached backtest results and historical price data.
    """
    try:
        import sqlite3
        cleared_count = 0
        
        # Get connection to cache database
        with sqlite3.connect(cache.db_path) as conn:
            # Get all cache keys
            cursor = conn.execute("SELECT key FROM cache")
            all_keys = [row[0] for row in cursor.fetchall()]
            
            # Filter backtest-related keys (both prices and results)
            backtest_keys = [
                key for key in all_keys 
                if key.startswith('backtest_prices:') or key.startswith('backtest_result:')
            ]
            
            # Delete each backtest key
            for key in backtest_keys:
                cache.delete(key)
                cleared_count += 1
        
        return {
            "status": "success",
            "message": f"Cleared {cleared_count} backtest cache entries",
            "cleared_count": cleared_count,
            "types_cleared": ["backtest_prices", "backtest_result"]
        }
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
            if last_date >= today_dt:
                continue

            # FIX: Start from last_date instead of last_date + 1
            # This prevents the "Start date > End date" error if the market hasn't updated yet.
            fetch_start = last_date.strftime('%Y-%m-%d')

            try:
                new_hist = ticker.history(start=fetch_start)

                if not new_hist.empty:
                    new_hist.columns = new_hist.columns.get_level_values(0)
                    new_hist.index = new_hist.index.tz_localize(None).normalize()

                    # Filter: ONLY keep rows strictly newer than our last_date
                    new_rows = new_hist[new_hist.index > last_date]

                    if not new_rows.empty:
                        data[asset]["history"] = pd.concat([existing_hist, new_rows])
                        # Extra safety for duplicates
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
    
    # compute_mu_cov now supports optional parameters:
    # - use_sentiment: bool = True (enable/disable sentiment adjustment)
    # - sentiment_alpha: float = 0.05 (sentiment weight)
    # Using defaults: sentiment enabled with 5% weight
    mu, cov = compute_mu_cov(returns, tickers)

    logger.info("Building QUBO....")
    qubo = build_qubo(mu, cov, risk_tolerance, k, tickers)
    
    logger.info("QAOA optimization....")
    selected_vec, selected_assets = solve_qubo_with_qaoa(qubo, tickers, reps=2, maxiter=150)

    logger.info("Optimizing weights....")
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
    
    logger.info("Calculating portfolio metrics....")
    weights = results['portfolio_config']['weights']
    table_data = create_table_values(weights, investment_amount, investment_horizon, 0.02, results['annualized_stats']['expected_return'], PKL_FILE)
    port_beta = calculate_portfolio_beta(table_data)
    
    logger.info("Fetching sentiment data....")
    # Sentiment data is now cached internally in sentiment.py
    news, sentiment_wide = sentiment_engine.get_latest_sentiment()
    sentiment = sentiment_wide.iloc[-1].T.reindex(mu.index)

    return results, table_data, port_beta, sentiment

    
def monte_carlo_analysis_logic(weights_dict: Dict[str, float], investment_amount: float, investment_horizon: int, tickers: List[str]) -> Dict[str, Any]:
    tickers = get_tickers() 
    returns = fetch_and_cache_data()

    # Using default sentiment settings (enabled with 5% weight)
    _, cov = compute_mu_cov(returns, tickers)
    # Filter cov for selected assets only
    selected_assets = list(weights_dict.keys())

    selected_cov = cov.loc[selected_assets, selected_assets]
    logger.info("Calculating Annualized returns....")
    annualized_returns = calculate_annual_returns(selected_assets, PKL_FILE)["Annualized Return"]
    aligned_returns = annualized_returns.reindex(selected_assets).fillna(0) # Assuming simple series, but calculate_annual_returns returns DF
    logger.info("Monte Carlo simulation....")
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


def calculate_comparison_metrics(user_risk, k, investment_amount, investment_horizon, risk_free=0.02):
        """
        Calculate and compare portfolio metrics using both quantum and classical methods.

        Args:
            returns (pd.DataFrame): Stock returns
            mu (pd.Series): Expected returns
            cov (pd.DataFrame): Covariance matrix
            user_risk (float): Risk tolerance parameter (0–1)
            k (int): Number of assets to select
            risk_free (float): Risk-free rate

        Returns:
            dict: Comparison of quantum and classical portfolio metrics
        """
        # Calculate quantum portfolio metrics
        quantum_metrics, _, port_beta, _ = quantum_portfolio_logic(user_risk, investment_amount, investment_horizon, k)
        quantum_weights = {ticker : w for ticker, w in quantum_metrics['portfolio_config']['weights'].items()}
        

        # Calculate classical portfolio metrics
        tickers = get_tickers()
        returns = fetch_and_cache_data()
        
        # Using default sentiment settings for classical comparison
        mu, cov = compute_mu_cov(returns, tickers)

        from app.services.classical_service import build_and_solve_classical, classical_model
        raw_metrics, mu_sub, cov_sub = build_and_solve_classical(
            returns, mu, cov, user_risk, k
        )
        classical_metrics = classical_model(
            raw_metrics, mu_sub, cov_sub
        )
        classical_weights = {ticker : w for ticker, w in classical_metrics['weights'].items()}
        table_data = create_table_values(classical_weights, investment_amount, investment_horizon, risk_free, classical_metrics['annual_expected_return'], PKL_FILE)
        classical_port_beta = calculate_portfolio_beta(table_data)
        
        # Prepare comparison response
        comparison = {
            "quantum": {
                "selected_assets": quantum_metrics.get("portfolio_config", {}).get("selected_assets", []),
                "weights": quantum_weights,
                "expected_return": quantum_metrics.get("annualized_stats", {}).get("expected_return", 0),
                "volatility": quantum_metrics.get("annualized_stats", {}).get("volatility", 0),
                "sharpe_ratio": quantum_metrics.get("annualized_stats", {}).get("sharpe_ratio", 0),
                "portfolio_beta": port_beta,
                "var": quantum_metrics.get("risk_metrics", {}).get("VaR_return", 0),
            },
            "classical": {
                "selected_assets": classical_metrics.get("selected_assets", []),
                "weights": classical_metrics.get("weights", {}),
                "expected_return": classical_metrics.get("annual_expected_return", 0),
                "volatility": classical_metrics.get("annual_volatility", 0),
                "sharpe_ratio": classical_metrics.get("sharpe_ratio", 0),
                "portfolio_beta": classical_port_beta,
                "var": classical_metrics.get("VaR_loss", 0),
            }
        }
        
        return comparison
