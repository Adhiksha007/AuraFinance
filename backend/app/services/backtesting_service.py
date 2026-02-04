"""
Backtesting service for portfolio performance validation against historical data.

This module provides functionality to:
- Fetch historical price data with caching
- Calculate portfolio returns using fixed weights
- Compare optimized portfolio against equal-weight baseline
- Compute performance metrics (cumulative return, max drawdown, volatility, recovery time)
"""

from typing import Dict, List, Any, Tuple
import pandas as pd
import numpy as np
import yfinance as yf
from datetime import datetime
import hashlib
import json

from app.services.cache_manager import cache


def fetch_historical_prices(tickers: List[str], start_date: str, end_date: str) -> pd.DataFrame:
    """
    Fetch historical closing prices for specified tickers and date range.
    Uses cache to improve performance.
    
    Args:
        tickers: List of ticker symbols
        start_date: Start date in 'YYYY-MM-DD' format
        end_date: End date in 'YYYY-MM-DD' format
    
    Returns:
        DataFrame with dates as index and tickers as columns
    """
    # Create cache key
    sorted_tickers = sorted(tickers)
    cache_key = f"backtest_prices:{':'.join(sorted_tickers)}:{start_date}:{end_date}"
    
    # Check cache first
    cached_data = cache.get(cache_key)
    if cached_data is not None:
        return cached_data
    
    # Fetch from yfinance if cache miss
    prices = pd.DataFrame()
    
    for ticker in tickers:
        try:
            stock = yf.Ticker(ticker)
            hist = stock.history(start=start_date, end=end_date)
            
            if not hist.empty and 'Close' in hist.columns:
                prices[ticker] = hist['Close']
        except Exception as e:
            print(f"Error fetching data for {ticker}: {e}")
            continue
    
    # Align dates and forward-fill missing values
    prices = prices.ffill().bfill()
    
    # Cache for 24 hours (historical data doesn't change)
    cache.set(cache_key, prices, ttl_seconds=86400)
    
    return prices


def calculate_portfolio_returns(
    weights: Dict[str, float], 
    prices: pd.DataFrame,
    initial_investment: float
) -> Tuple[pd.Series, List[float]]:
    """
    Calculate portfolio value evolution using fixed weights.
    
    Args:
        weights: Dictionary mapping ticker to weight
        prices: DataFrame of historical prices
        initial_investment: Starting portfolio value
    
    Returns:
        Tuple of (dates, portfolio_values)
    """
    # Calculate daily returns (fill NaN values after calculation)
    returns = prices.pct_change(fill_method=None).fillna(0)
    
    # Calculate weighted portfolio returns
    portfolio_returns = pd.Series(0.0, index=returns.index)
    
    for ticker, weight in weights.items():
        if ticker in returns.columns:
            portfolio_returns += returns[ticker] * weight
    
    # Calculate portfolio value evolution
    portfolio_values = [initial_investment]
    
    for daily_return in portfolio_returns[1:]:  # Skip first NaN
        new_value = portfolio_values[-1] * (1 + daily_return)
        portfolio_values.append(new_value)
    
    return returns.index, portfolio_values


def calculate_baseline_returns(
    prices: pd.DataFrame,
    initial_investment: float
) -> Tuple[pd.Series, List[float]]:
    """
    Calculate equal-weight baseline portfolio returns.
    
    Args:
        prices: DataFrame of historical prices
        initial_investment: Starting portfolio value
    
    Returns:
        Tuple of (dates, portfolio_values)
    """
    n_assets = len(prices.columns)
    equal_weights = {ticker: 1.0 / n_assets for ticker in prices.columns}
    
    return calculate_portfolio_returns(equal_weights, prices, initial_investment)


def calculate_performance_metrics(portfolio_values: List[float]) -> Dict[str, Any]:
    """
    Calculate comprehensive performance metrics.
    
    Args:
        portfolio_values: Time series of portfolio values
    
    Returns:
        Dictionary containing performance metrics
    """
    values = np.array(portfolio_values)
    
    # Cumulative return
    cumulative_return = (values[-1] - values[0]) / values[0]
    
    # Maximum drawdown
    running_max = np.maximum.accumulate(values)
    drawdowns = (values - running_max) / running_max
    max_drawdown = np.min(drawdowns)
    
    # Find recovery time (days from max drawdown to recovery)
    max_dd_idx = np.argmin(drawdowns)
    recovery_time = 0
    
    if max_dd_idx < len(values) - 1:
        peak_value = running_max[max_dd_idx]
        for i in range(max_dd_idx + 1, len(values)):
            if values[i] >= peak_value:
                recovery_time = i - max_dd_idx
                break
        else:
            recovery_time = len(values) - max_dd_idx  # Not yet recovered
    
    # Volatility (annualized)
    daily_returns = np.diff(values) / values[:-1]
    volatility = np.std(daily_returns) * np.sqrt(252)
    
    # Sharpe ratio (assuming 2% risk-free rate)
    risk_free_rate = 0.02
    years = len(values) / 252
    annualized_return = (1 + cumulative_return) ** (1 / years) - 1 if years > 0 else cumulative_return
    sharpe_ratio = (annualized_return - risk_free_rate) / volatility if volatility > 0 else 0
    
    return {
        'cumulative_return': float(cumulative_return),
        'max_drawdown': float(max_drawdown),
        'volatility': float(volatility),
        'recovery_time': int(recovery_time),
        'sharpe_ratio': float(sharpe_ratio),
        'final_value': float(values[-1]),
        'values': [float(v) for v in values]
    }


def run_backtest(
    weights: Dict[str, float],
    tickers: List[str],
    start_date: str,
    end_date: str,
    initial_investment: float
) -> Dict[str, Any]:
    """
    Main backtesting orchestration function.
    Compares optimized portfolio against equal-weight baseline.
    
    Args:
        weights: Portfolio weights (must sum to 1.0)
        tickers: List of ticker symbols
        start_date: Start date in 'YYYY-MM-DD' format
        end_date: End date in 'YYYY-MM-DD' format
        initial_investment: Starting portfolio value
    
    Returns:
        Dictionary containing backtest results for both portfolios
    """
    # Create cache key for complete backtest result
    weights_str = json.dumps(weights, sort_keys=True)
    weights_hash = hashlib.md5(weights_str.encode()).hexdigest()[:8]
    sorted_tickers = sorted(tickers)
    cache_key = f"backtest_result:{weights_hash}:{':'.join(sorted_tickers)}:{start_date}:{end_date}"
    
    # Check cache first
    cached_result = cache.get(cache_key)
    if cached_result is not None:
        return cached_result
    
    # Fetch historical prices (with caching)
    prices = fetch_historical_prices(tickers, start_date, end_date)
    
    if prices.empty:
        raise ValueError("No historical data available for the specified period")
    
    # Calculate optimized portfolio performance
    dates, optimized_values = calculate_portfolio_returns(weights, prices, initial_investment)
    optimized_metrics = calculate_performance_metrics(optimized_values)
    
    # Calculate baseline portfolio performance
    _, baseline_values = calculate_baseline_returns(prices, initial_investment)
    baseline_metrics = calculate_performance_metrics(baseline_values)
    
    # Prepare result
    result = {
        'dates': [d.strftime('%Y-%m-%d') for d in dates],
        'optimized_portfolio': optimized_metrics,
        'baseline_portfolio': baseline_metrics,
        'comparison': {
            'return_difference': optimized_metrics['cumulative_return'] - baseline_metrics['cumulative_return'],
            'drawdown_improvement': baseline_metrics['max_drawdown'] - optimized_metrics['max_drawdown'],
            'volatility_reduction': baseline_metrics['volatility'] - optimized_metrics['volatility'],
            'sharpe_improvement': optimized_metrics['sharpe_ratio'] - baseline_metrics['sharpe_ratio']
        }
    }
    
    # Cache for 1 hour
    cache.set(cache_key, result, ttl_seconds=3600)
    
    return result
