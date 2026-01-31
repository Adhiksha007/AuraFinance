from fastapi import APIRouter, Body
from typing import Any
from pydantic import BaseModel
from app.services.debt_optimizer import debt_optimizer

router = APIRouter()

class FinancialAidRequest(BaseModel):
    investment_return_rate: float
    debt_interest_rate: float
    capital_available: float

@router.post("/optimize", response_model=dict)
def optimize_finances(request: FinancialAidRequest) -> Any:
    """
    Calculate whether to invest or pay off debt based on user inputs.
    """
    result = debt_optimizer.optimize(
        request.investment_return_rate,
        request.debt_interest_rate,
        request.capital_available
    )
    return result
