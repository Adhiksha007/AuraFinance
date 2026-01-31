from typing import Dict, Any

class DebtOptimizerService:
    def __init__(self):
        pass

    def optimize(self, investment_return_rate: float, debt_interest_rate: float, capital_available: float) -> Dict[str, Any]:
        """
        Calculates whether to invest or pay off debt.
        
        Args:
            investment_return_rate (float): Expected annual return rate of investment (percentage, e.g. 7.0 for 7%).
            debt_interest_rate (float): Annual interest rate of the debt (percentage, e.g. 5.0 for 5%).
            capital_available (float): Amount of money available to allocate.
            
        Returns:
            Dict containing recommendation and breakdown.
        """
        
        decision = ""
        rationale = ""
        allocation = {}
        
        # Simple logical comparison
        if debt_interest_rate > investment_return_rate:
            decision = "PAY_OFF_DEBT"
            rationale = (f"The debt interest rate ({debt_interest_rate}%) is higher than the expected investment return "
                         f"({investment_return_rate}%). It is guaranteed savings to pay off the debt first.")
            allocation = {
                "debt_payment": capital_available,
                "investment": 0.0
            }
        elif debt_interest_rate < investment_return_rate:
            decision = "INVEST"
            rationale = (f"The expected investment return ({investment_return_rate}%) outpaces the cost of debt "
                         f"({debt_interest_rate}%). Mathematically, investing yields a higher net worth over time.")
            allocation = {
                "debt_payment": 0.0,
                "investment": capital_available
            }
        else:
            decision = "NEUTRAL"
            rationale = "The rates are identical. You can choose either, but paying debt reduces risk."
            allocation = {
                "debt_payment": capital_available * 0.5,
                "investment": capital_available * 0.5
            }

        return {
            "decision": decision,
            "rationale": rationale,
            "allocation": allocation,
            "inputs": {
                "investment_rate": investment_return_rate,
                "debt_rate": debt_interest_rate,
                "capital": capital_available
            }
        }

debt_optimizer = DebtOptimizerService()
