from pydantic import BaseModel
from typing import List, Dict, Optional, Any
from datetime import date

class GoalBase(BaseModel):
    name: str
    target_amount: float
    target_date: date
    current_savings: float = 0.0
    monthly_contribution: float = 0.0
    risk_profile: Optional[str] = "Moderate"

class GoalCreate(GoalBase):
    pass

class GoalResponse(GoalBase):
    id: int
    created_at: date

class YearlyProjection(BaseModel):
    year: int
    amount: float
    contribution: float
    growth: float

class ScenarioProjections(BaseModel):
    median: List[YearlyProjection]
    worst: List[YearlyProjection]
    best: List[YearlyProjection]

class SimulationResult(BaseModel):
    success_probability: float  # 0 to 1
    gap_amount: float # Amount needed to reach goal if behind
    projected_amount_at_deadline: float
    recommended_allocation: Dict[str, float] # e.g. {"Equity": 0.7, "Bonds": 0.3}
    etf_suggestions: Dict[str, Any] # Detailed ETF info
    yearly_projections: List[YearlyProjection] # Deprecated but kept for compatibility
    scenarios: ScenarioProjections
    on_track: bool
    suggestions: Dict[str, float]

class SimulationRequest(GoalBase):
    pass
