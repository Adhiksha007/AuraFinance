from typing import List, Tuple, Dict, Any, Optional
import numpy as np
import pandas as pd
from qiskit_optimization import QuadraticProgram
from qiskit_optimization.converters import QuadraticProgramToQubo
from qiskit_optimization.algorithms import MinimumEigenOptimizer
from qiskit.primitives import Sampler
from qiskit_algorithms import QAOA
from qiskit_algorithms.optimizers import COBYLA

from app.services.sentiment import sentiment_engine

# Constants with documentation
DEFAULT_SENTIMENT_ALPHA = 0.05  # Default sentiment adjustment weight (5% of returns)
LAMBDA_MIN = 0.1  # Minimum risk penalty (high risk tolerance)
LAMBDA_MAX = 10.0  # Maximum risk penalty (low risk tolerance)
MIN_WEIGHT_PCT = 0.01  # Minimum 1% allocation per asset to ensure diversification
MAX_ASSETS = 11  # Maximum number of assets in portfolio (QAOA complexity limit)

def compute_mu_cov(
    returns: pd.DataFrame, 
    tickers: List[str],
    use_sentiment: bool = True,
    sentiment_alpha: float = DEFAULT_SENTIMENT_ALPHA
) -> Tuple[pd.Series, pd.DataFrame]:
    """
    Compute expected returns and covariance matrix with optional sentiment adjustment.
    
    Args:
        returns: Historical returns DataFrame
        tickers: List of ticker symbols
        use_sentiment: Whether to apply sentiment adjustment (default: True)
        sentiment_alpha: Weight for sentiment adjustment (default: 0.05)
    
    Returns:
        Tuple of (expected returns, covariance matrix)
    """
    # 1. Base Stats
    mu = returns.mean(axis=0) * 252.0
    cov = returns.cov() * 252.0
    
    # 2. Optional sentiment adjustment
    if use_sentiment:
        try:
            _, sentiment_wide = sentiment_engine.get_latest_sentiment()
            s = sentiment_wide.iloc[-1].T.reindex(mu.index)
            mu_adjusted = mu + (sentiment_alpha * s)
        except Exception as e:
            mu_adjusted = mu
    else:
        mu_adjusted = mu

    # 3. Clean NaN/Inf values
    mu_clean = np.nan_to_num(mu_adjusted.astype(float), nan=0.0, posinf=0.0, neginf=0.0)
    cov_clean = np.nan_to_num(cov.astype(float), nan=0.0, posinf=0.0, neginf=0.0)
    
    return pd.Series(mu_clean, index=mu.index), pd.DataFrame(cov_clean, index=cov.index, columns=cov.columns)

def build_qubo(mu: pd.Series, cov_matrix: pd.DataFrame, user_risk: float, k: int, assets: List[str]) -> QuadraticProgram:
    """
    Select a subset of assets using QAOA to maximize return and minimize volatility.

    Args:
        mu : pd.Series of expected returns
        cov_matrix : pd.DataFrame covariance matrix
        user_risk : float in [0,1], higher → more risk tolerance
        k : int, number of assets to pick
        assets : list of asset names
        reps : QAOA repetitions
        maxiter : classical optimizer max iterations

    Returns:
        selection_vec : binary vector indicating selected assets
        selected_assets : list of selected asset names
    """
    
    n = len(assets)
    # Validate asset count
    if n > MAX_ASSETS:
        raise ValueError(f"Too many assets ({n}). Maximum allowed: {MAX_ASSETS}")
    
    qp = QuadraticProgram()

    # Create binary variables for each asset
    for t in assets:
        qp.binary_var(name=t)
    
    # Adaptive lambda scaling: lower user_risk → higher penalty on variance
    lam = LAMBDA_MIN + (1 - user_risk)**2 * (LAMBDA_MAX - LAMBDA_MIN)

    # Linear term: reward for return
    linear = {assets[i]: -mu.iloc[i] for i in range(n)}

    # Quadratic term: penalize variance
    quadratic = {(assets[i], assets[j]): lam * cov_matrix.iloc[i, j] for i in range(n) for j in range(n)}

    # Scale linear term by lambda/avg_vol to normalize return vs risk
    avg_vol = np.sqrt(np.mean(np.abs(np.diag(cov_matrix))))
    
    linear_scaled = {}
    for asset, val in linear.items():
        linear_scaled[asset] = float(np.real(val * (lam / avg_vol)))

    quadratic_scaled = {}
    for key, val in quadratic.items():
        quadratic_scaled[key] = float(np.real(val * lam))

    qp.minimize(linear=linear_scaled, quadratic=quadratic_scaled)

    # Constraint: select exactly k assets
    qp.linear_constraint(
        linear={t: 1 for t in assets},
        sense="==",
        rhs=k,
        name="pick_k_assets"
    )

    # Convert to QUBO
    qubo = QuadraticProgramToQubo().convert(qp)

    return qubo

def solve_qubo_with_qaoa(qubo: QuadraticProgram, assets: List[str], reps: int=2, maxiter: int=200) -> Tuple[np.ndarray, List[str]]:
    """
    Solve QUBO problem using QAOA quantum algorithm.
    
    Args:
        qubo: Quadratic Unconstrained Binary Optimization problem
        assets: List of asset names
        reps: QAOA repetitions (circuit depth)
        maxiter: Maximum iterations for classical optimizer
    
    Returns:
        Tuple of (selection vector, selected asset names)
    """
    
    optimizer = COBYLA(maxiter=maxiter)
    sampler = Sampler()  # exact expectation-based

    # Initialize QAOA
    qaoa = QAOA(sampler=sampler, reps=reps, optimizer=optimizer)

    # Solve with MinimumEigenOptimizer
    solver = MinimumEigenOptimizer(qaoa)
    result = solver.solve(qubo)

    selection_vec = np.array([int(result[x.name]) for x in qubo.variables])
    selected_assets = [assets[i] for i, v in enumerate(selection_vec) if v > 0]
    return selection_vec, selected_assets


def get_weights_from_selection(selection_vec: np.ndarray, mu: pd.Series, cov: pd.DataFrame, tickers: List[str], user_risk: float=1.0, min_weight: float=0.01) -> Tuple[Optional[np.ndarray], Optional[pd.Series], Optional[pd.DataFrame]]:
    """
    Optimize weights so that all selected assets get non-zero weights, Sharpe ratio is maximized,
    and portfolio volatility scales smoothly with user_risk.

    Args:
        selection_vec : list/array, binary output from QAOA
        mu : pd.Series, expected returns of assets
        cov : pd.DataFrame, covariance matrix
        tickers : list of asset names
        user_risk : float in [0,1], 0 = lowest risk, 1 = highest risk
        min_weight : float, minimum allocation per asset

    Returns:
        np.array : optimized portfolio weights
        pd.Series : selected expected returns
        pd.DataFrame : selected covariance matrix
    """
    import numpy as np
    from scipy.optimize import minimize

    selection = np.array([1 if float(x) > 0 else 0 for x in selection_vec])
    idx = np.where(selection == 1)[0].tolist()
    if len(idx) == 0:
        return None, None, None

    selected_mu = mu.iloc[idx]
    selected_cov = cov.iloc[idx, idx].values
    n = len(idx)

    # Minimum weight for each asset to avoid zero allocation
    bounds = [(MIN_WEIGHT_PCT, 1) for _ in range(n)]

    # Constraint: sum of weights = 1
    cons = [{'type': 'eq', 'fun': lambda w: np.sum(w) - 1}]

    # Starting point: equal weights
    x0 = np.ones(n) / n

    # Soft target volatility based on user_risk
    ones = np.ones(n)
    inv_cov = np.linalg.pinv(selected_cov)
    gmv_weights = inv_cov @ ones / (ones @ inv_cov @ ones)   # global minimum variance
    min_vol = np.sqrt(gmv_weights @ selected_cov @ gmv_weights)
    max_vol = np.sqrt(np.max(np.diag(selected_cov)))
    target_vol = min_vol + user_risk * (max_vol - min_vol)

    # Objective: maximize Sharpe ratio with penalty for deviation from target_vol
    def objective(w):
        port_return = w @ selected_mu.values
        port_vol = np.sqrt(w @ selected_cov @ w)
        sharpe = port_return / port_vol
        vol_penalty = ((port_vol - target_vol) / target_vol)**2  # soft penalty
        return -sharpe + 0.1 * vol_penalty  # minimize negative Sharpe + penalty

    res = minimize(objective, x0, bounds=bounds, constraints=cons)

    if not res.success:
        # Fallback to equal weights instead of returning None
        equal_weights = np.ones(n) / n
        return equal_weights, selected_mu, cov.iloc[idx, idx]
    return res.x, selected_mu, cov.iloc[idx, idx]

def monte_carlo_portfolio(mu: pd.Series, cov: pd.DataFrame, weights: np.ndarray, horizon_days: int=30, n_sims: int=5000, alpha: float=0.05, seed: int=123) -> Tuple[float, float, float, float, np.ndarray]:
    """Monte Carlo simulation of portfolio returns with VaR and CVaR."""
    np.random.seed(seed)
    h = max(1, int(horizon_days))
    mu_h = mu * (h / 252.0)
    cov_h = cov * (h / 252.0)

    sims = np.random.multivariate_normal(mean=mu_h, cov=cov_h, size=n_sims)
    sim_port_rets = sims.dot(weights)

    mean_sim = float(np.mean(sim_port_rets))
    std_sim = float(np.std(sim_port_rets))
    var_ret = float(np.percentile(sim_port_rets, 100 * alpha))
    cvar_ret = float(np.mean(sim_port_rets[sim_port_rets <= var_ret])) if np.any(sim_port_rets <= var_ret) else var_ret

    return mean_sim, std_sim, var_ret, cvar_ret, sim_port_rets

def compute_blended_stats(weights_risky: np.ndarray, mu: pd.Series, cov: pd.DataFrame, user_risk: float, risk_free: float) -> Tuple[float, float, float]:
    """
    Scale a risky portfolio by user_risk via cash mixing (two-fund separation).
    Returns portfolio (exp_return, vol, sharpe) after blending with cash.
    """
    # risky portfolio stats
    mu_risky = float(weights_risky @ mu.values)
    vol_risky = float(np.sqrt(weights_risky @ cov.values @ weights_risky))

    # blend with cash
    exp_return = (1 - user_risk) * risk_free + user_risk * mu_risky
    vol = user_risk * vol_risky
    excess = exp_return - risk_free
    sharpe = excess / vol if vol > 0 else 0.0
    return exp_return, vol, sharpe

def unified_portfolio_analysis(
    selection_vec: Optional[np.ndarray]=None,
    selected_assets: Optional[List[str]]=None,
    mu: Optional[pd.Series]=None,
    cov: Optional[pd.DataFrame]=None,
    tickers: Optional[List[str]]=None,
    user_risk: float=1.0,
    risk_free: float=0.02,
    investment_amount: float=10000,
    investment_horizon_years: int=1,
    n_sims: int=5000,
    alpha: float=0.05,
    seed: int=123
) -> Dict[str, Any]:
    """
    Combines Portfolio selection, Risk Metrics (VaR/CVaR), and 
    Future Value Projections into a single comprehensive analysis.
    """

    # --- 1. Weight Derivation & Normalization ---
    if selection_vec is not None and selected_assets is not None:
        # Assumes get_weights_from_selection handles the math for weights
        weights_risky, mu_subset, cov_subset = get_weights_from_selection(
            selection_vec, mu, cov, tickers, user_risk
        )
        tickers_selected = selected_assets
    else:
        raise ValueError("Both selection_vec and selected_assets must be provided.")

    # Force 100% allocation (Full investment)
    total_w = weights_risky.sum()
    if total_w <= 0:
        raise ValueError("Sum of weights is zero.")
    weights_risky = weights_risky / total_w
    
    # Map weights to tickers for clarity
    weights_final = {t: float(w) for t, w in zip(tickers_selected, weights_risky)}

    # --- 2. Core Statistical Metrics ---
    exp_return, vol, sharpe = compute_blended_stats(
        weights_risky, mu_subset, cov_subset, user_risk, risk_free
    )

    # --- 3. Risk Engine (Monte Carlo) ---
    horizon_days = int(investment_horizon_years * 252)
    
    mean_sim, std_sim, var_ret, cvar_ret, sim_rets = monte_carlo_portfolio(
        mu_subset, cov_subset, weights_risky, 30, n_sims, alpha, seed
    )

    # --- 4. Value Projections ---
    projected_value = investment_amount * ((1 + exp_return) ** investment_horizon_years)
    
    upper_value = investment_amount * ((1 + exp_return + vol) ** investment_horizon_years)
    lower_value = investment_amount * ((1 + exp_return - vol) ** investment_horizon_years)

    roi = (projected_value - investment_amount) / investment_amount
    cagr = (projected_value / investment_amount) ** (1 / investment_horizon_years) - 1
    
    asset_values_usd = {t: float(w * projected_value) for t, w in weights_final.items()}

    # --- 5. Consolidated Results ---
    results = {
        "portfolio_config": {
            "selected_assets": tickers_selected,
            "weights": weights_final,
            "investment_amount": investment_amount,
            "horizon_years": investment_horizon_years
        },
        "annualized_stats": {
            "expected_return": float(exp_return),
            "volatility": float(vol),
            "sharpe_ratio": float(sharpe)
        },
        "risk_metrics": {
            "VaR_return": float(var_ret),
            "CVaR_return": float(cvar_ret),
            "VaR_loss": float(abs(var_ret * investment_amount)),
            "CVaR_loss": float(abs(cvar_ret * investment_amount)),
            "sim_mean_return": float(mean_sim),
            "std_sim_return": float(std_sim),
            "sim_raw_data": sim_rets.tolist()
        },
        "projections": {
            "projected_final_value": projected_value,
            "range_lower": lower_value,
            "range_upper": upper_value,
            "ROI": roi,
            "CAGR": cagr,
            "asset_distribution_usd": asset_values_usd
        }
    }
    
    def replace_nan(obj):
        if isinstance(obj, float):
            return 0.0 if np.isnan(obj) or np.isinf(obj) else obj
        elif isinstance(obj, dict):
            return {k: replace_nan(v) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [replace_nan(i) for i in obj]
        return obj

    return replace_nan(results)

def monte_carlo_simulation(weights: np.ndarray, returns: np.ndarray, cov_matrix: pd.DataFrame, initial_investment: float,
                          time_horizon: int=252, num_simulations: int=1000, percentiles: List[int]=[5, 25, 50, 75, 95], risk_free: int=0.02) -> Dict[str, Any]:
    """
    Perform Monte Carlo simulation for portfolio performance with enhanced risk metrics.

    Args:
        weights (np.array): Portfolio weights
        returns (np.array): Expected returns for each asset
        cov_matrix (np.array): Covariance matrix of returns
        initial_investment (float): Initial investment amount
        time_horizon (int): Time horizon in days
        num_simulations (int): Number of simulations to run
        percentiles (list): Percentiles to calculate for the final portfolio value

    Returns:
        dict: Simulation results with enhanced risk metrics
    """
    daily_returns = returns / 252
    daily_cov = cov_matrix / 252
    
    # Regularization to prevent SVD convergence errors
    daily_cov = daily_cov + np.eye(daily_cov.shape[0]) * 1e-6

    # Vectorized simulation - generate all paths at once
    # Shape: (num_simulations, time_horizon, num_assets)
    all_random_returns = np.random.multivariate_normal(
        daily_returns, 
        daily_cov, 
        size=(num_simulations, time_horizon)
    )
    
    # Portfolio returns for each simulation: (num_simulations, time_horizon)
    portfolio_daily_returns = np.sum(all_random_returns * weights, axis=2)
    
    # Calculate cumulative portfolio values using vectorized operations
    # Start with initial investment
    simulation_results = np.zeros((time_horizon, num_simulations))
    simulation_results[0, :] = initial_investment
    
    # Vectorized cumulative product for all simulations at once
    for t in range(1, time_horizon):
        simulation_results[t, :] = simulation_results[t-1, :] * (1 + portfolio_daily_returns[:, t])
    
    # Calculate daily returns for all simulations
    daily_returns_results = np.zeros((time_horizon-1, num_simulations))
    daily_returns_results = (simulation_results[1:, :] / simulation_results[:-1, :]) - 1

    final_values = simulation_results[-1, :]
    percentile_values = np.percentile(final_values, percentiles)

    # Vectorized drawdown calculation (much faster than nested loops)
    running_max = np.maximum.accumulate(simulation_results, axis=0)
    drawdowns = (simulation_results - running_max) / running_max
    max_drawdowns = np.abs(np.min(drawdowns, axis=0)).tolist()
    
    # Recovery time calculation (still needs loop but optimized)
    recovery_times = []
    underwater_periods = []
    
    for i in range(num_simulations):
        simulation = simulation_results[:, i]
        sim_drawdowns = drawdowns[:, i]
        peak = simulation[0]
        in_drawdown = False
        drawdown_start = 0
        current_underwater = 0
        underwater_periods_sim = []

        for t, value in enumerate(simulation):
            if value > peak:
                peak = value
                if in_drawdown:
                    recovery_time = t - drawdown_start
                    recovery_times.append(recovery_time)
                    in_drawdown = False
                    underwater_periods_sim.append(current_underwater)
                    current_underwater = 0
            else:
                if not in_drawdown and sim_drawdowns[t] < -0.05:
                    in_drawdown = True
                    drawdown_start = t

                if in_drawdown:
                    current_underwater += 1

        if in_drawdown and current_underwater > 0:
            underwater_periods_sim.append(current_underwater)

        if underwater_periods_sim:
            underwater_periods.extend(underwater_periods_sim)

    daily_returns_mean = np.mean(daily_returns_results, axis=1)
    daily_volatility = np.std(daily_returns_results, axis=1)

    var_levels = [0.95, 0.99]
    var_results = {}
    cvar_results = {}

    for level in var_levels:
        var_threshold = np.percentile(final_values, 100 * (1 - level))
        var_results[str(int(level * 100))] = float(initial_investment - var_threshold)

        tail_values = final_values[final_values <= var_threshold]
        if len(tail_values) > 0:
            cvar = np.mean(tail_values)
            cvar_results[str(int(level * 100))] = float(initial_investment - cvar)
        else:
            cvar_results[str(int(level * 100))] = float(var_results[str(int(level * 100))])

    annualized_returns = []
    daily_rf = risk_free / 252
    path_sharpe_ratios = []

    for i in range(num_simulations):
        final_value = simulation_results[-1, i]
        years = time_horizon / 252
        annualized_return = ((final_value / initial_investment) ** (1 / years)) - 1
        annualized_returns.append(annualized_return)

        path_returns = daily_returns_results[:, i]
        excess_returns = path_returns - daily_rf
        if np.std(path_returns) > 0:
            s_ratio = (np.mean(excess_returns) / np.std(path_returns)) * np.sqrt(252)
            path_sharpe_ratios.append(s_ratio)
        else:
            path_sharpe_ratios.append(0)
    avg_sharpe = np.mean(path_sharpe_ratios)

    prob_profit = np.mean(final_values > initial_investment) * 100
    prob_doubling = np.mean(final_values >= (initial_investment * 2)) * 100

    avg_max_dd = np.mean(max_drawdowns)
    risk_score = "Low"
    if avg_max_dd > 0.25 or avg_sharpe < 0.5:
        risk_score = "High"
    elif avg_max_dd > 0.15 or avg_sharpe < 1.0:
        risk_score = "Medium"
    # --- ADDED CODE END ---

    results = {
        'percentiles': {
            str(p): float(v) for p, v in zip(percentiles, percentile_values)
        },
        'max_drawdown': {
            'mean': float(np.mean(max_drawdowns)),
            'median': float(np.median(max_drawdowns)),
            'max': float(np.max(max_drawdowns)),
            'min': float(np.min(max_drawdowns)),
            'percentiles': {
                str(p): float(np.percentile(max_drawdowns, p)) for p in [5, 25, 50, 75, 95]
            }
        },
        'recovery_time': {
            'mean': float(np.mean(recovery_times)) if recovery_times else None,
            'median': float(np.median(recovery_times)) if recovery_times else None,
            'max': float(np.max(recovery_times)) if recovery_times else None
        },
        'underwater_periods': {
            'mean': float(np.mean(underwater_periods)) if underwater_periods else None,
            'median': float(np.median(underwater_periods)) if underwater_periods else None,
            'max': float(np.max(underwater_periods)) if underwater_periods else None
        },
        'final_value': {
            'mean': float(np.mean(final_values)),
            'median': float(np.median(final_values)),
            'min': float(np.min(final_values)),
            'max': float(np.max(final_values)),
            'std': float(np.std(final_values))
        },
        'annualized_return': {
            'mean': float(np.mean(annualized_returns)),
            'median': float(np.median(annualized_returns)),
            'min': float(np.min(annualized_returns)),
            'max': float(np.max(annualized_returns))
        },
        'var': var_results,
        'cvar': cvar_results,
        'initial_investment': float(initial_investment),
        'time_horizon_days': int(time_horizon),
        'num_simulations': int(num_simulations)
    }

    # Sample of the simulation paths (for visualization)
    sample_indices = np.random.choice(num_simulations, min(10, num_simulations), replace=False)
    sample_paths = simulation_results[:, sample_indices]

    # Create time points for x-axis (days)
    time_points = list(range(time_horizon))

    # Prepare visualization data
    visualization_data = {
        'time_points': time_points,
        'paths': sample_paths.tolist(),
        'percentile_paths': {
            str(p): np.percentile(simulation_results, p, axis=1).tolist() for p in [5, 25, 50, 75, 95]
        }
    }
    # Add these new keys to your existing 'results' dictionary
    results.update({
        'sharpe_ratio': {
            'mean': float(avg_sharpe),
            'score': "Excellent" if avg_sharpe > 2 else "Good" if avg_sharpe > 1 else "Sub-optimal"
        },
        'probabilities': {
            'profit': float(prob_profit),
            'doubling': float(prob_doubling)
        },
        'risk_rating': risk_score,
        'return_percentage': ((results['final_value']['median'] / initial_investment) - 1) * 100,
        'summary_metrics': {
            'lower_bound': float(percentile_values[0]), # 5th percentile
            'median_bound': float(percentile_values[2]), # 50th percentile
            'upper_bound': float(percentile_values[4]), # 95th percentile
        }
    })

    results['visualization'] = visualization_data

    def replace_nan(obj):
        if isinstance(obj, float):
            return 0.0 if np.isnan(obj) or np.isinf(obj) else obj
        elif isinstance(obj, dict):
            return {k: replace_nan(v) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [replace_nan(i) for i in obj]
        return obj

    return replace_nan(results)
