from fastapi import APIRouter, Depends, HTTPException
from typing import List, Any
from app.services.ml_predictor import predictor
from app.services.xai_explainer import explainer
from pydantic import BaseModel

from app.services.data_ingestion import get_current_price

router = APIRouter()

class RecommendationResponse(BaseModel):
    ticker: str
    price: float
    sentiment: str
    momentum_score: float
    ai_rationale: str

@router.get("/top", response_model=List[RecommendationResponse])
def get_top_recommendations() -> Any:
    """
    Get recommendations for a curated list of popular stocks.
    """
    tickers = ["NVDA", "TSLA", "AAPL", "MSFT"]
    results = []
    for ticker in tickers:
        try:
            results.append(get_recommendation(ticker))
        except Exception:
            continue
    return results

from app.services import stockpicks_service

@router.get("/generate", response_model=List[Any])
async def generate_recommendations(refresh: bool = False) -> Any:
    """
    Generate real-time AI recommendations based on technical analysis (RSI, SMA).
    Optional query param `refresh=true` forces a new data fetch.
    """
    try:
        return await stockpicks_service.get_ai_recommendations(force_refresh=refresh)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{ticker}", response_model=RecommendationResponse)
def get_recommendation(ticker: str) -> Any:
    """
    Get AI-driven recommendation and rationale for a specific stock ticker.
    """
    try:
        # 1. Get Prediction
        prediction = predictor.predict_sentiment(ticker)
        
        # 2. Get Explanation
        rationale = explainer.explain_prediction(prediction)
        
        # 3. Get Real Price
        price = get_current_price(ticker) or 0.0
        
        return {
            "ticker": ticker,
            "price": price,
            "sentiment": prediction["sentiment"],
            "momentum_score": prediction["momentum_score"],
            "ai_rationale": rationale
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


