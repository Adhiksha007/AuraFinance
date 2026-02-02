from app.services.tickers import get_tickers
from app.core.config import settings
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

class SentimentAnalyzer:
    def __init__(self, tickers: List[str], model_name: str = "ProsusAI/finbert"):
        # Updated URL from api-inference to router as per HF 410 Deprecation Error
        self.api_url = f"https://router.huggingface.co/hf-inference/models/{model_name}"
        self.api_token = settings.HF_API_KEY
        self.headers = {"Authorization": f"Bearer {self.api_token}"} if self.api_token else {}

        self.sentiment = None
        self.news_data = None
        self.last_updated = None
        self.tickers = tickers
        self.cache_duration = datetime.timedelta(hours=1)

        if not self.api_token:
            print("⚠️ WARNING: HF_API_KEY not found. Sentiment analysis may fail or be rate-limited.")

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

    def _query_hf_api(self, inputs: List[str]) -> List[List[Dict[str, Any]]]:
      """Send payloads to HF Inference API with wait-for-model logic."""
      if not inputs: return []

      try:
          payload = {
                "inputs": inputs, 
                "options": {"wait_for_model": True, "use_cache": True}
            }
          # Increase timeout to 60s to allow for model loading/processing
          response = requests.post(
              self.api_url,
              headers=self.headers,
              json=payload,
              timeout=90
          )

          # Handle the case where the model is still spinning up
          if response.status_code == 402:
                print("❌ Credit limit reached on the Router. Ensure you aren't using router.huggingface.co")
                return []

          if response.status_code == 503:
              import time
              print("⏳ Model is loading... waiting 20s before retry.")
              time.sleep(20)
              return self._query_hf_api(inputs) # Single retry

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

    def get_news(self, tickers: List[str], timeout: int, limit: Optional[int] = None) ->pd.DataFrame:
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
            self.news_data, self.sentiment = pd.DataFrame(), pd.DataFrame()
            return

        print("🔥 Waking up the model... please wait.")
        self._query_hf_api(["Just warming up the engine."])

        import time
        time.sleep(15)

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
        self.sentiment = df_daily.pivot(index='Date', columns='Ticker', values='Sentiment')
        self.news_data = df
        self.last_updated = datetime.datetime.now()

    def get_latest_sentiment(self) -> Tuple[pd.DataFrame, pd.DataFrame]:
        now = datetime.datetime.now()
        if self.last_updated and (now - self.last_updated < self.cache_duration):
            return self.news_data, self.sentiment

        self.build_dataframe(self.tickers)
        return self.news_data, self.sentiment


sentiment_engine = SentimentAnalyzer(tickers=get_tickers())