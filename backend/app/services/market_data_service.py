import pandas as pd
import numpy as np
from datetime import datetime

class MarketDataService:
    """
    Service to provide historical market data and live macro indicators.
    Simulates fetching data from an external provider (Bloomberg/FactSet/AlphaVantage).
    """
    
    _historical_data_cache = None

    @staticmethod
    def get_current_macro_indicators():
        """
        Fetches 'Live' macro data. 
        In a real app, this would call FRED or AlphaVantage APIs.
        """
        return {
            "risk_free_rate": 0.042, # 10-Year Treasury Yield (approx 4.2%)
            "inflation_rate": 0.031,  # Latest CPI YoY
            "sp500_pe_ratio": 24.5    # Current P/E (valuation context)
        }

    @staticmethod
    def _generate_synthetic_history():
        """
        Generates a synthetic dataset of monthly returns mimicking 1970-2024.
        We use 'Regimes' to ensure we capture correlations and volatility correctly.
        """
        # Regimes: (Name, Length Months, Mu_Stock, Sigma_Stock, Mu_Bond, Sigma_Bond, Corr)
        # Note: Monthly Mu/Sigma approximations
        regimes = [
            ("Great Inflation (70s)", 120, 0.005, 0.05, 0.006, 0.02, 0.3),     # Stocks flat, Bonds OK (high yield)
            ("80s/90s Boom", 240, 0.012, 0.04, 0.008, 0.015, 0.2),            # Great bull run
            ("Dot Com Crash", 36, -0.015, 0.07, 0.008, 0.01, -0.4),            # Tech crash, bonds hedge
            ("Recovery/Housing", 60, 0.008, 0.03, 0.004, 0.01, 0.1),
            ("GFC (2008)", 18, -0.03, 0.09, 0.005, 0.01, -0.5),                # Big crash
            ("Bull Market (2010s)", 120, 0.011, 0.035, 0.002, 0.01, 0.0),      # Steady growth, low rates
            ("COVID/Inflation", 60, 0.009, 0.05, -0.003, 0.025, 0.6)           # Volatile, bonds fall with stocks
        ]
        
        all_stocks = []
        all_bonds = []
        all_dates = []
        
        start_date = pd.Timestamp("1970-01-01")
        current_date_pointer = start_date
        
        for name, duration, mu_s, sig_s, mu_b, sig_b, rho in regimes:
            # Generate correlated normal returns for this regime
            mean = [mu_s, mu_b]
            cov = [[sig_s**2, rho*sig_s*sig_b], [rho*sig_s*sig_b, sig_b**2]]
            
            returns = np.random.multivariate_normal(mean, cov, duration)
            
            all_stocks.extend(returns[:, 0])
            all_bonds.extend(returns[:, 1])
            
            # Dates
            dates = pd.date_range(start=current_date_pointer, periods=duration, freq='ME')
            all_dates.extend(dates)
            current_date_pointer = dates[-1] + pd.Timedelta(days=1)
            
        df = pd.DataFrame({
            "Date": all_dates,
            "Stock_Returns": all_stocks,
            "Bond_Returns": all_bonds,
            # Cash is roughly correlated with Fed Funds, simplified as risk-free/low var
            "Cash_Returns": np.random.normal(0.003, 0.001, len(all_stocks)) 
        })
        return df

    @staticmethod
    def get_historical_data():
        """
        Returns a DataFrame of historical results.
        Cols: Date, Stock_Returns, Bond_Returns, Cash_Returns
        """
        if MarketDataService._historical_data_cache is None:
            MarketDataService._historical_data_cache = MarketDataService._generate_synthetic_history()
        return MarketDataService._historical_data_cache

    @staticmethod
    def get_allocation_weights(risk_profile: str, years: float) -> dict:
        """
        Returns simple weight dict {'Equity': X, 'Bonds': Y, 'Cash': Z} based on horizon.
        """
        # Simple Glide Path Logic
        # (Could be expanded to check risk_profile too, e.g. "Aggressive" user stays in Equity longer)
        
        # Determine Phase adjusted by Risk Profile? 
        # For simplicity, we use Time Horizon as primary driver, adjusted slightly by profile?
        # Let's keep it strictly Time Horizon for now as per "Glide Path" definiton.
        
        if years > 10:
             # Aggressive Phase
             return {"Equity": 0.90, "Bonds": 0.10, "Cash": 0.0}
        elif years > 3:
             # Moderate Phase
             return {"Equity": 0.60, "Bonds": 0.40, "Cash": 0.0}
        else:
             # Conservative Phase
             return {"Equity": 0.20, "Bonds": 0.60, "Cash": 0.20}

    @staticmethod
    def get_etf_suggestions(risk_profile: str, years: float):
        """
        Returns relevant ETF suggestions with detailed metadata.
        """
        weights = MarketDataService.get_allocation_weights(risk_profile, years)
        
        # Map generic classes to specific ETFs
        suggestions = {}
        
        if weights.get("Equity", 0) > 0:
            if years > 10:
                suggestions["Equity"] = {"ticker": "VT", "name": "Vanguard Total World Stock", "percent": weights["Equity"], "desc": "Global Growth Engine"}
            elif years > 3:
                suggestions["Equity"] = {"ticker": "VTI", "name": "Vanguard Total Stock Market", "percent": weights["Equity"], "desc": "US Market Core"}
            else:
                suggestions["Equity"] = {"ticker": "VTV", "name": "Vanguard Value ETF", "percent": weights["Equity"], "desc": "Stable Blue Chips"}
                
        if weights.get("Bonds", 0) > 0:
            if years <= 3:
                 suggestions["Bonds"] = {"ticker": "SHY", "name": "iShares 1-3 Year Treasury", "percent": weights["Bonds"], "desc": "Capital Preservation"}
            else:
                 suggestions["Bonds"] = {"ticker": "BND", "name": "Vanguard Total Bond Market", "percent": weights["Bonds"], "desc": "Shock Absorber"}
                 
        if weights.get("Cash", 0) > 0:
            suggestions["Cash"] = {"ticker": "BIL", "name": "SPDR T-Bill ETF", "percent": weights["Cash"], "desc": "Ultra Safe"}
            
        return suggestions
