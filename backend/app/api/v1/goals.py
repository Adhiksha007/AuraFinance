from fastapi import APIRouter, HTTPException, Depends
from app.schemas.goal import SimulationResult, SimulationRequest
from app.services.goal_service import GoalService

router = APIRouter()

@router.post("/simulate", response_model=SimulationResult)
async def simulate_goal(request: SimulationRequest):
    """
    Simulates a financial goal using Monte Carlo analysis.
    Returns success probability, gap analysis, and recommendations.
    """
    try:
        result = await GoalService.simulate_goal(request)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
