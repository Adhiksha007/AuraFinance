import os
import datetime
import numpy as np
import pandas as pd
import feedparser
import requests
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import List, Tuple, Dict, Any, Optional
import random
import time
from app.core.config import settings
from app.services.tickers import get_tickers
from app.services.cache_manager import cache


class SentimentAnalyzer:
    def __init__(self, tickers: List[str], model_name: str = "ProsusAI/finbert"):
        # Use free inference API instead of paid router
        self.api_url = f"https://api-inference.huggingface.co/models/{model_name}"
        self.api_token = settings.HF_API_KEY
        self.headers = {"Authorization": f"Bearer {self.api_token}", "X-Wait-For-Model": "true"} if self.api_token else {}

        self.tickers = tickers

        if not self.api_token:
            print("⚠️ WARNING: HF_API_KEY not found. Sentiment analysis may fail or be rate-limited.")

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
            return extracted[:limit] if limit else extracted
        except Exception:
            return []

    def _query_hf_api(self, inputs: List[str]) -> List[List[Dict[str, Any]]]:
        """Send payloads to HF Inference API with wait-for-model logic."""
        if not inputs: return []
        try:
            # Increase timeout to 60s to allow for model loading/processing
            response = requests.post(
                self.api_url,
                headers=self.headers,
                json={"inputs": inputs, "options": {"wait_for_model": True}},
                timeout=90
            )

            # Handle the case where the model is still spinning up
            if response.status_code == 503:
                print("⏳ Model is loading... waiting 20s before retry.")
                time.sleep(20)
                return self._query_hf_api(inputs)  # Single retry

            if response.status_code != 200:
                print(f"❌ HF API Error {response.status_code}: {response.text}")
                return []

            return response.json()
        except requests.exceptions.Timeout:
            print("❌ Request timed out. Model might be too busy or chunk size too large.")
            return []
        except Exception as e:
            print(f"❌ HF API Request Failed: {e}")
            return []

    def _score_texts(self, texts: List[str]) -> pd.DataFrame:
        """Process sentiment and return a DataFrame with Score, Label, and Value."""
        if not texts: return pd.DataFrame()

        # We now pre-fill a list of dictionaries instead of a numpy array
        results = [None] * len(texts)

        def process_single(idx, text):
            time.sleep(random.uniform(0.1, 0.5))
            response = self._query_hf_api([text])

            if response and isinstance(response, list) and len(response) > 0:
                item = response[0]
                if isinstance(item, list):
                    # Sort scores to find the highest confidence label
                    # Example: [{'label': 'positive', 'score': 0.9}, {'label': 'neutral', 'score': 0.1}]
                    score_map = {res['label'].lower(): res['score'] for res in item}

                    # 1. Standard Score (Pos - Neg)
                    pos = score_map.get('positive', 0.0)
                    neg = score_map.get('negative', 0.0)
                    net_score = pos - neg

                    # 2. Get the winning label and its value
                    winning_item = max(item, key=lambda x: x['score'])
                    label = winning_item['label'].capitalize()
                    confidence = winning_item['score']

                    return idx, {"Sentiment": net_score, "Label": label, "Confidence": confidence}

            # Fallback for failures
            return idx, {"Sentiment": 0.0, "Label": "Neutral", "Confidence": 0.0}

        with ThreadPoolExecutor(max_workers=3) as executor:
            future_to_idx = {executor.submit(process_single, i, t): i for i, t in enumerate(texts)}
            for future in as_completed(future_to_idx):
                idx, data = future.result()
                results[idx] = data

        return pd.DataFrame(results)

    def get_news(self, tickers: List[str], timeout: int, limit: Optional[int] = None) -> pd.DataFrame:
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
        Uses persistent cache with 1-hour TTL.
        """
        cache_key = "sentiment_data"
        
        # Check cache first
        cached_data = cache.get(cache_key)
        if cached_data is not None:
            print("✅ Using cached sentiment data")
            return  # Data already in cache

        df = self.get_news(tickers, timeout=12, limit=None)

        if df.empty:
            # Cache empty result to avoid repeated API calls
            cache.set(cache_key, (pd.DataFrame(), pd.DataFrame()), ttl_seconds=3600)
            return

        print("🔥 Waking up the model... please wait.")
        self._query_hf_api(["Just warming up the engine."])
        time.sleep(10)

        # 3. Batch Scoring
        # Get the new sentiment details (Sentiment, Label, Confidence)
        sentiment_df = self._score_texts(df["Title"].tolist())

        # Merge these new columns into our main news_data DataFrame
        df = pd.concat([df.reset_index(drop=True), sentiment_df], axis=1)

        # 4. Data Cleaning & Aggregation
        df["Date"] = df["Published"].dt.date

        # Calculate Daily Sentiment
        df_daily = (
            df.groupby(["Ticker", "Date"])["Sentiment"]
            .mean()
            .reset_index()
        )

        # Pivot to wide format (Dates as Index, Tickers as Columns)
        sentiment_wide = df_daily.pivot(index='Date', columns='Ticker', values='Sentiment')
        news_data = df
        
        # Cache for 1 hour
        cache.set(cache_key, (news_data, sentiment_wide), ttl_seconds=3600)
        print("✅ Sentiment data cached for 1 hour")

    def get_latest_sentiment(self) -> Tuple[pd.DataFrame, pd.DataFrame]:
        """
        Get latest sentiment data from persistent cache.
        Rebuilds if cache is empty or expired.
        """
        cache_key = "sentiment_data"
        
        # Try to get from cache
        cached_data = cache.get(cache_key)
        
        if cached_data is not None:
            news_data, sentiment_wide = cached_data
            return news_data, sentiment_wide
        
        # Cache miss - rebuild
        print("⚠️ Cache miss - rebuilding sentiment data...")
        self.build_dataframe(self.tickers)
        
        # Get from cache after rebuild
        cached_data = cache.get(cache_key)
        if cached_data is not None:
            return cached_data
        
        # Fallback to empty dataframes
        return pd.DataFrame(), pd.DataFrame()


# Global sentiment engine instance
sentiment_engine = SentimentAnalyzer(tickers=get_tickers())