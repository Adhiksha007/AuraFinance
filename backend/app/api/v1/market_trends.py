
from fastapi import APIRouter
import asyncio
import json
from app.services.market_service import market_service
from typing import Any

router = APIRouter()

@router.get("/", response_model=Any)
async def get_market_trends():
    """
    Get current market trends data including global indices, sentiment, and sector performance.
    """
    return await market_service.get_combined_data()


