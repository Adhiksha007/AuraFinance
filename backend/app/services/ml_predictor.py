import yfinance as yf
import pandas as pd
from typing import Dict, Any

class MLPredictor:
    def __init__(self):
        pass

    def get_stock_data(self, ticker: str, period: str = "1mo") -> pd.DataFrame:
        """
        Fetches stock data using yfinance
        """
        stock = yf.Ticker(ticker)
        hist = stock.history(period=period)
        return hist

    def calculate_momentum(self, hist: pd.DataFrame) -> float:
        """
        Simple momentum calculation: (Current Price - Price n days ago) / Price n days ago
        """
        if len(hist) < 2:
            return 0.0
        
        start_price = hist['Close'].iloc[0]
        end_price = hist['Close'].iloc[-1]
        
        return (end_price - start_price) / start_price

    def predict_sentiment(self, ticker: str) -> Dict[str, Any]:
        """
        Returns a mock sentiment and momentum score for now.
        Real implementation would use NLP on news.
        """
        hist = self.get_stock_data(ticker)
        momentum = self.calculate_momentum(hist)
        
        # Mock sentiment logic based on momentum
        sentiment = "Bullish" if momentum > 0 else "Bearish"
        score = min(max((momentum * 100) + 50, 0), 100) # Normalize around 50

        return {
            "ticker": ticker,
            "momentum_score": round(score, 2),
            "sentiment": sentiment,
            "raw_momentum_pct": round(momentum * 100, 2)
        }

predictor = MLPredictor()
