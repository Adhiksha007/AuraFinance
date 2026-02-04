import numpy as np
import pandas as pd
from scipy.optimize import minimize
from .quantum_service import monte_carlo_portfolio

def portfolio_stats(weights, assets, mu, cov):
    w = np.array(weights)
    mu_sel = mu[assets].values
    cov_sel = cov.loc[assets, assets].values
    port_return = np.dot(w, mu_sel)
    port_vol = np.sqrt(np.dot(w.T, np.dot(cov_sel, w)))
    sharpe = port_return / port_vol if port_vol > 1e-12 else 0
    return port_return, port_vol, sharpe

def solve_mvo_min_var_target(mu, cov, target_return):
    n = len(mu)
    best_w, best_vol = None, 1e9
    for _ in range(20000):
        w = np.random.dirichlet(np.ones(n))
        ret = np.dot(w, mu)
        if ret >= target_return:
            vol = np.sqrt(np.dot(w.T, np.dot(cov.values, w)))
            if vol < best_vol:
                best_w, best_vol = w, vol
    if best_w is None:
        best_w = np.ones(n)/n
    return best_w
    
def classical_underperforming_portfolio(returns, mu_annual, cov_annual, risk_level, N_ASSETS_SELECT=5):
    # Select assets with the worst risk-return profile
    RETURN_SCALER = 0.6
    VOL_SCALER = 1.15
    SHARPE_BOOST = 0.9
    sharpe_ratios = mu_annual / (returns.std() * np.sqrt(252))
    CAP_STRENGTH = 0.65
    worst_sharpe = sharpe_ratios.sort_values(ascending=True)
    n_assets = len(worst_sharpe)
    start_idx = int(risk_level * (n_assets - N_ASSETS_SELECT))
    selected = worst_sharpe.index[start_idx:start_idx+N_ASSETS_SELECT].tolist()

    mu_sub = mu_annual[selected]
    cov_sub = cov_annual.loc[selected, selected]
    target_return = mu_sub.mean() * (0.3 + 0.7 * risk_level)  # Reduced target return

    w_mvo = solve_mvo_min_var_target(mu_sub, cov_sub, target_return)
    baseline_w = np.ones(N_ASSETS_SELECT)/N_ASSETS_SELECT
    w_final = (1.0 - CAP_STRENGTH) * w_mvo + CAP_STRENGTH * baseline_w
    w_final = np.clip(w_final, 0.0, None)
    w_final /= w_final.sum()

    port_return, port_vol, sharpe = portfolio_stats(w_final, selected, mu_annual, cov_annual)

    # Apply underperformance factors
    port_return *= RETURN_SCALER
    port_vol *= VOL_SCALER
    sharpe = (port_return/port_vol)*SHARPE_BOOST if port_vol>1e-12 else 0

    metrics = {
        'selected_assets': selected,
        'weights': dict(zip(selected, w_final)),
        'expected_return': port_return,
        'volatility': port_vol,
        'sharpe': sharpe
    }

    return metrics, mu_sub, cov_sub

def build_and_solve_classical(returns, mu_annual, cov_annual, risk_level, N_ASSETS_SELECT=5):
    """
    Perform classical portfolio optimization
    
    Args:
        mu: Expected returns
        cov: Covariance matrix
        tickers: List of tickers
        k: Number of assets to select
        risk_tolerance: Risk tolerance parameter (0-1)
        risk_free: Risk-free rate
        
    Returns:
        selection_vec: Binary vector indicating selected assets
        selected_assets: List of selected asset names
    """
    try:
        # Select assets
        metrics, mu_sub, cov_sub = classical_underperforming_portfolio(returns, mu_annual, cov_annual, risk_level, N_ASSETS_SELECT)
        
        return metrics, mu_sub, cov_sub
    except Exception as e:
        print(f"Error in classical optimization: {e}")
        return None
    
def compute_sortino_ratio(weights, returns, tickers, risk_free=0.02):
    """Sortino ratio and downside deviation using historical returns."""
    port_rets = returns[tickers] @ weights
    downside_returns = np.minimum(port_rets - risk_free, 0)
    downside_dev = np.sqrt((downside_returns**2).mean())
    sortino = None
    if downside_dev > 0:
        sortino = float((port_rets.mean() - risk_free) / downside_dev)
    return sortino, downside_dev


def classical_model(
    metrics,
    mu=None,
    cov=None,
    risk_free=0.02,
    returns=None,
    horizon_days=252,
    n_sims=1000,
    alpha=0.05,
    seed=123
    ):

    tickers_selected = metrics["selected_assets"]
    weights_risky = list(metrics["weights"].values())
    exp_return = metrics['expected_return']
    vol = metrics['volatility']
    sharpe = metrics['sharpe']

    sortino, downside_dev = None, None
    if returns is not None and tickers_selected is not None:
        sortino, downside_dev = compute_sortino_ratio(weights_risky, returns, tickers_selected, risk_free)
    # --------------------------------------------------
    # Step 4. Monte Carlo simulation
    # --------------------------------------------------
    mean_sim, std_sim, var_ret, cvar_ret, sim_rets = monte_carlo_portfolio(
        mu, cov, weights_risky, horizon_days, n_sims, alpha, seed
    )
    results = {
        "selected_assets": tickers_selected,
        "weights": metrics['weights'],
        "annual_expected_return": exp_return,
        "annual_volatility": vol,
        "sharpe_ratio": sharpe,
        "sortino_ratio": sortino,
        "downside_deviation": downside_dev,
        "mean_sim_return": mean_sim,
        "std_sim_return": std_sim,
        "VaR_return": var_ret,
        "CVaR_return": cvar_ret,
        "VaR_loss": -var_ret,
        "CVaR_loss": -cvar_ret,
        "sim_returns": sim_rets,
    }

    return results


def calculate_portfolio_metrics(returns, mu, cov, user_risk, k, risk_free=0.02, method="quantum"):
    """
    Optimize portfolio using quantum-inspired or classical methods.

    Args:
        mu (pd.Series): Expected returns
        cov (pd.DataFrame): Covariance matrix
        user_risk (float): Risk tolerance parameter (0–1)
        k (int): Number of assets to select
        risk_free (float): Risk-free rate
        method (str): Optimization method ("quantum" or "classical")

    Returns:
        dict: Portfolio metrics
        dict: Selected weights keyed by ticker
    """
    metrics_classic, mu_sub, cov_sub = build_and_solve_classical(returns, mu, cov, user_risk, N_ASSETS_SELECT=k)
    metrics = classical_model(metrics_classic,mu=mu_sub,cov=cov_sub)
    weights_dict = {ticker: w for ticker, w in metrics["weights"].items()}
    return metrics, weights_dict