import numpy as np
import pandas as pd
from datetime import date, datetime
from app.schemas.goal import GoalBase, SimulationResult, YearlyProjection, ScenarioProjections
from app.services.market_data_service import MarketDataService

class GoalService:
    @staticmethod
    def calculate_months_remaining(target_date: date) -> int:
        today = date.today()
        # Simple diff
        return max(1, (target_date.year - today.year) * 12 + (target_date.month - today.month))

    @staticmethod
    def run_bootstrap_simulation(
        current_savings: float,
        monthly_contribution: float,
        months: int,
        allocations: list, # List of dicts, one for each month
        historical_df: pd.DataFrame,
        num_simulations: int = 1000,
        fee_drag_annual: float = 0.0005, # 0.05%
        step_up_annual: float = 0.03     # 3% annual raise
    ) -> np.ndarray:
        """
        Runs Block Bootstrapping Simulation.
        """
        # Prepare Data
        stock_hist = historical_df['Stock_Returns'].values
        bond_hist = historical_df['Bond_Returns'].values
        cash_hist = historical_df['Cash_Returns'].values
        n_history = len(stock_hist)
        
        # Block size for bootstrapping (e.g., 3 months to capture short term momentum)
        block_size = 3
        
        # Initialize
        portfolio_paths = np.zeros((num_simulations, months + 1))
        portfolio_paths[:, 0] = current_savings
        
        # Pre-calculate contribution schedule (with Step-Up)
        contributions = np.zeros(months)
        current_contrib = monthly_contribution
        for t in range(months):
            if t > 0 and t % 12 == 0:
                current_contrib *= (1 + step_up_annual)
            contributions[t] = current_contrib
            
        # Fees monthly
        fee_monthly = fee_drag_annual / 12

        # Simulation Loop
        for sim in range(num_simulations):
            # Generate random start indices for blocks
            # We need enough blocks to cover 'months'
            num_blocks = int(np.ceil(months / block_size))
            start_indices = np.random.randint(0, n_history - block_size, num_blocks)
            
            # Construct the path of returns for this simulation
            sim_stock_returns = []
            sim_bond_returns = []
            sim_cash_returns = []
            
            for start_idx in start_indices:
                sim_stock_returns.extend(stock_hist[start_idx : start_idx + block_size])
                sim_bond_returns.extend(bond_hist[start_idx : start_idx + block_size])
                sim_cash_returns.extend(cash_hist[start_idx : start_idx + block_size])
            
            # Trim to exact length
            sim_stock_returns = np.array(sim_stock_returns[:months])
            sim_bond_returns = np.array(sim_bond_returns[:months])
            sim_cash_returns = np.array(sim_cash_returns[:months])
            
            # Allocations (Dynamic Glide Path Could Go Here, for now Static per sim or simple step)
            # To do true interaction, we need to know allocation at each step. 
            # If passed 'allocations' is static, fine. 
            # If dynamic, we need logic inside loop.
            # Let's support simple static logic for the core bootstrap function 
            # but ideally the caller handles glide path? 
            # Actually, let's implement the Glide Path Logic inside the loop for realism.
            
            # Allocations are now dynamic per month (Glide Path)
            # allocations is a list of dicts: allocations[t]
            
            # Path Construction
            current_val = current_savings
            for t in range(months):
                # Get allocation for this specific month t
                w_month = allocations[t]
                w_stock = w_month.get('Equity', 0.0)
                w_bond = w_month.get('Bonds', 0.0)
                w_cash = w_month.get('Cash', 0.0)

                # Calculate portfolio return for this month
                # r_p = w_s * r_s + w_b * r_b + ...
                port_ret = (w_stock * sim_stock_returns[t] + 
                           w_bond * sim_bond_returns[t] + 
                           w_cash * sim_cash_returns[t])
                
                # Apply Return, Fee, then Contribution
                current_val = current_val * (1 + port_ret - fee_monthly) + contributions[t]
                portfolio_paths[sim, t+1] = current_val

        return portfolio_paths

    @staticmethod
    async def simulate_goal(goal: GoalBase) -> SimulationResult:
        hist_data = MarketDataService.get_historical_data()
        macro_data = MarketDataService.get_current_macro_indicators()
        
        months = GoalService.calculate_months_remaining(goal.target_date)
        years_float = months / 12.0
        
        # Determine Allocation Schedule (Dynamic Glide Path)
        # We calculate the allocation for each month from t=0 to t=months
        allocation_schedule = []
        for t in range(months):
            # Time remaining at start of month t
            remaining_years = (months - t) / 12.0
            # If remaining_years is small, it clamps to conservative
            weights = MarketDataService.get_allocation_weights(goal.risk_profile, remaining_years)
            allocation_schedule.append(weights)

        # Get current ETF suggestions for initial display (t=0)
        etf_recs = MarketDataService.get_etf_suggestions(goal.risk_profile, years_float)
        
        # Initial allocation for result display
        initial_allocation = allocation_schedule[0] if allocation_schedule else MarketDataService.get_allocation_weights(goal.risk_profile, years_float)
        
        # Run Bootstrap
        sim_paths = GoalService.run_bootstrap_simulation(
            current_savings=goal.current_savings,
            monthly_contribution=goal.monthly_contribution,
            months=months,
            allocations=allocation_schedule,
            historical_df=hist_data,
            step_up_annual=0.03,
            fee_drag_annual=0.0005 # 0.05%
        )
        
        final_values = sim_paths[:, -1]
        
        # Inflation Logic (Live Data)
        inflation_rate = macro_data["inflation_rate"]
        future_target_nominal = goal.target_amount * ((1 + inflation_rate) ** years_float)
        
        # Success Probability
        success_count = np.sum(final_values >= future_target_nominal)
        success_prob = success_count / len(final_values)
        
        # Gap Analysis (Approximation via PMT formula using Risk Free Rate)
        gap_monthly = 0.0
        if success_prob < 0.90:
            p10_value = np.percentile(final_values, 10)
            shortfall = future_target_nominal - p10_value
            if shortfall > 0:
                # Use Risk Free Rate for gap filling calculation ( conservative )
                r_safe = macro_data["risk_free_rate"] / 12
                denom = ((1 + r_safe)**months - 1) / r_safe
                gap_monthly = shortfall / denom

        # Projections
        median_path = np.percentile(sim_paths, 50, axis=0)
        worst_path = np.percentile(sim_paths, 10, axis=0)
        best_path = np.percentile(sim_paths, 90, axis=0)
        
        current_year = datetime.now().year
        
        def build_projections(path_data):
            projs = []
            current_monthly_contrib = goal.monthly_contribution
            cum_contrib = goal.current_savings
            prev_val = goal.current_savings
            
            for i in range(1, int(np.ceil(years_float)) + 1):
                idx = min(i * 12, months)
                
                # Annual Contribution for this year
                # We assume step-up happens at start of year
                year_monthly_contrib = current_monthly_contrib * (1.03**(i-1))
                year_total_contrib = year_monthly_contrib * 12
                
                val_end = path_data[idx]
                
                # Growth = Change in Value - Contributions Added
                # This is an approximation
                growth = (val_end - prev_val) - year_total_contrib
                
                projs.append(YearlyProjection(
                    year=current_year + i,
                    amount=round(val_end, 2),
                    contribution=round(year_total_contrib, 2), 
                    growth=round(growth, 2)
                ))
                prev_val = val_end
            return projs

        # Suggestions
        suggestions = {}
        # ... (Similar logic to before but reusing the live rates)

        return SimulationResult(
            success_probability=round(success_prob, 2),
            gap_amount=round(gap_monthly, 2),
            projected_amount_at_deadline=round(np.median(final_values), 2),
            recommended_allocation=initial_allocation,
            etf_suggestions=etf_recs,
            yearly_projections=build_projections(median_path),
            scenarios=ScenarioProjections(
                median=build_projections(median_path),
                worst=build_projections(worst_path),
                best=build_projections(best_path)
            ),
            on_track=success_prob >= 0.80,
            suggestions=suggestions
        )
