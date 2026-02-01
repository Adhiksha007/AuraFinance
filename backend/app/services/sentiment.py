from app.services.tickers import get_tickers
import os
import datetime
import numpy as np
import pandas as pd
import feedparser
import requests
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import List, Tuple, Dict, Any, Optional

class SentimentAnalyzer:
    def __init__(self, tickers: List[str], model_name: str = "ProsusAI/finbert"):
        # Updated URL from api-inference to router as per HF 410 Deprecation Error
        self.api_url = f"https://router.huggingface.co/hf-inference/models/{model_name}"
        self.api_token = os.getenv("HF_API_KEY")
        self.headers = {"Authorization": f"Bearer {self.api_token}"} if self.api_token else {}
        
        self.sentiment = None
        self.news_data = None
        self.last_updated = None
        self.tickers = tickers
        self.cache_duration = datetime.timedelta(hours=1)
        
        print(f"--- Initializing Sentiment Analyzer (HF API: {model_name}) ---")
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
        """Send payloads to HF Inference API."""
        if not inputs: return []
        
        # HF API often accepts list of strings
        try:
            response = requests.post(self.api_url, headers=self.headers, json={"inputs": inputs})
            if response.status_code != 200:
                print(f"❌ HF API Error {response.status_code}: {response.text}")
                return []
            return response.json()
        except Exception as e:
            print(f"❌ HF API Request Failed: {e}")
            return []

    def _score_texts(self, texts: List[str]) -> np.ndarray:
        """Batch process sentiment scores via API."""
        if not texts: return np.array([])
        
        # API might reject huge batches, so we might need chunking if list is very long.
        # For now, we'll try sending all, or chunking loosely if needed.
        # Let's chunk safely to 20 items per request to avoid payload limits/timeouts.
        chunk_size = 20
        all_scores = []
        
        for i in range(0, len(texts), chunk_size):
            chunk = texts[i:i+chunk_size]
            api_response = self._query_hf_api(chunk)
            
            # Response format for classification: [[{'label': 'positive', 'score': 0.9}, ...], ...]
            # FinBERT labels: 'positive', 'negative', 'neutral'
            
            # Check for failure or empty response
            if not api_response or not isinstance(api_response, list):
                # Request likely failed
                all_scores.extend([0.0] * len(chunk))
                continue
            
            # Additional check: API sometimes returns a dict on error even with 200 OK (rare but possible)
            if isinstance(api_response, dict) and 'error' in api_response:
                 all_scores.extend([0.0] * len(chunk))
                 continue

            for item in api_response:
                if isinstance(item, list): 
                    # item is list of dicts [{'label': 'positive', 'score': X}, ...]
                    # Map to score: Pos - Neg
                    score_map = {res['label'].lower(): res['score'] for res in item}
                    pos = score_map.get('positive', 0.0)
                    neg = score_map.get('negative', 0.0)
                    # neu = score_map.get('neutral', 0.0)
                    all_scores.append(pos - neg)
                else:
                    # Unexpected format or error dict in list
                    all_scores.append(0.0)
            
            # Safety fill: if for some reason we didn't get enough scores for this chunk
            expected_len = len(all_scores) + (len(chunk) - len(api_response))
            while len(all_scores) < (i + len(chunk)):
                 all_scores.append(0.0)

        return np.array(all_scores)

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

        # 3. Batch Scoring
        print(f"🧠 Scoring {len(df)} headlines via Hugging Face API...")
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