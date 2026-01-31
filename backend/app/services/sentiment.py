from app.services.tickers import get_tickers
import os
import datetime
import numpy as np
import pandas as pd
import feedparser
import torch
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import List, Tuple, Dict, Any, Optional
from scipy.special import softmax
from transformers import AutoTokenizer, AutoModelForSequenceClassification

class SentimentAnalyzer:
    def __init__(self, tickers: List[str], model_name: str = "ProsusAI/finbert"):
        self.model_name = model_name
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.sentiment = None
        self.news_data = None
        self.last_updated = None
        self.tickers = tickers
        self.cache_duration = datetime.timedelta(hours=1)
        
        print(f"--- Initializing Sentiment Analyzer on {self.device} ---")
        
        try:
            self.tokenizer = AutoTokenizer.from_pretrained(model_name, local_files_only=True)
            self.model = AutoModelForSequenceClassification.from_pretrained(
                model_name, local_files_only=True
            ).to(self.device)
            print("🚀 Success: Loaded model from local cache.")
        except Exception:
            print("📥 Model not found locally. Downloading...")
            self.tokenizer = AutoTokenizer.from_pretrained(model_name)
            self.model = AutoModelForSequenceClassification.from_pretrained(model_name).to(self.device)
            print("✅ Setup complete.")
        
        self.build_dataframe(tickers)

    @staticmethod
    def _fetch_single_feed(ticker: str, timeout: int, limit: Optional[int] = None) -> List[Dict[str, Any]]:
        """Fetch RSS feed with strict network timeout."""
        try: 
            url = f"https://news.google.com/rss/search?q={ticker}+when:{timeout}h"
            feed = feedparser.parse(url)
            extracted = []
            for entry in feed.entries:
                extracted.append({
                    "Ticker": ticker,
                    "Title": entry.title,
                    "Link": entry.link,
                    "Published": entry.published
                })
            return extracted[:limit]
        except Exception:
            return []

    def _score_texts(self, texts: List[str]) -> np.ndarray:
        """Batch process sentiment scores."""
        if not texts: return np.array([])
        
        inputs = self.tokenizer(texts, return_tensors="pt", padding=True, truncation=True).to(self.device)
        with torch.no_grad():
            outputs = self.model(**inputs)
        
        probs = softmax(outputs.logits.cpu().numpy(), axis=1)
        return probs[:, 2] - probs[:, 0]  # Positive - Negative

    def get_news(self, tickers: List[str], timeout: int, limit: Optional[int] = None) ->pd.DataFrame:
        print(f"🔄 Processing {len(tickers)} tickers...")
        
        # 1. Concurrent Fetching
        all_news_items = []
        with ThreadPoolExecutor(max_workers=min(32, len(tickers) * 2 + 4)) as executor:
            futures = [executor.submit(self._fetch_single_feed, t, timeout=timeout, limit=limit) for t in tickers]
            for future in as_completed(futures):
                all_news_items.extend(future.result())

        # 2. Convert directly to DataFrame
        if not all_news_items:
            return pd.DataFrame()
            
        df = pd.DataFrame(all_news_items)
        if 'Published' in df.columns:
            df['Published'] = pd.to_datetime(df['Published'], errors='coerce')
            df = df.sort_values("Published", ascending=False)
        
        return df

    def build_dataframe(self, tickers: List[str]):
        """
        Streamlined pipeline: Fetch -> DataFrame -> Score -> Aggregate
        """

        df = self.get_news(tickers, timeout=12, limit=None)
        
        if df.empty:
            print("⚠️ No news found for provided tickers.")
            self.news_data, self.sentiment = pd.DataFrame(), pd.DataFrame()
            return

        # 3. Batch Scoring (Only once for the whole DataFrame)
        print(f"🧠 Scoring {len(df)} headlines...")
        df["Sentiment"] = self._score_texts(df["Title"].tolist())

        # 4. Data Cleaning & Aggregation
        df["Date"] = df["Published"].dt.date
        
        # Calculate Daily Sentiment
        df_daily = (
            df.groupby(["Ticker", "Date"])["Sentiment"]
            .mean()
            .reset_index()
        )
        
        # Pivot to wide format (Dates as Index, Tickers as Columns)
        self.sentiment = df_daily.pivot(index='Date', columns='Ticker', values='Sentiment')
        self.news_data = df
        self.last_updated = datetime.datetime.now()
        
        print("✅ Analysis Complete.")

    def get_latest_sentiment(self) -> Tuple[pd.DataFrame, pd.DataFrame]:
        now = datetime.datetime.now()
        if self.last_updated and (now - self.last_updated < self.cache_duration):
            return self.news_data, self.sentiment
        
        self.build_dataframe(self.tickers)
        return self.news_data, self.sentiment

# sentiment_engine = SentimentAnalyzer(tickers=get_tickers())