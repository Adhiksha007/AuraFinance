from fastapi import APIRouter, HTTPException, Query
from typing import List, Any
from app.services.data_ingestion import get_historical_data, fetch_realtime_news

router = APIRouter()

@router.get("/chart/{ticker}", response_model=Any)
def get_chart_data(ticker: str = "SPY", period: str = "1mo", interval: str = "1d") -> Any:
    """
    Get historical market data for a chart.
    """
    try:
        df = get_historical_data(ticker, period=period, interval=interval)
        if df.empty:
            raise HTTPException(status_code=404, detail="No data found for ticker")
        
        # Format for Recharts: [{name: 'Jan', value: 100}, ...]
        # We'll use Date as name and Close as value
        df.reset_index(inplace=True)
        chart_data = []
        for _, row in df.iterrows():
            chart_data.append({
                "name": row['Date'].strftime('%Y-%m-%d'),
                "value": round(row['Close'], 2)
            })
            
        return chart_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/news", response_model=Any)
def get_market_news(
    tickers: List[str] = Query(["SPY", "AAPL", "NVDA"]),
    timeout: int = 12,
    limit: int = 10
) -> Any:
    """
    Get latest news for specified tickers.
    """
    try:
        news_df = fetch_realtime_news(tickers, timeout=timeout, limit=limit)
        # news_df = fetch_realtime_news(tickers)
        if news_df.empty:
            return []
        return news_df.to_dict(orient='records')
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/search", response_model=Any)
def search_market_tickers(q: str = Query(..., min_length=1)) -> Any:
    """
    Search for tickers for autocomplete.
    """
    from app.services.tickers import search_tickers
    return search_tickers(q)

@router.get("/summary/{ticker}", response_model=Any)
def get_ticker_summary_endpoint(ticker: str) -> Any:
    """
    Get fundamental summary data for a ticker.
    """
    try:
        from app.services.data_ingestion import get_ticker_summary
        df = get_ticker_summary(ticker)
        if df.empty:
            return []
        return df.to_dict(orient='records')
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
