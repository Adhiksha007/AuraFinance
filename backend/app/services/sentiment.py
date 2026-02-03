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
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer


class SentimentAnalyzer:
    def __init__(self, tickers: List[str], model_name: str = "ProsusAI/finbert"):
        # Initialize VADER for fallback
        self.vader = SentimentIntensityAnalyzer()
        
        # HuggingFace API setup
        self.api_url = f"https://router.huggingface.co/hf-inference/models/{model_name}"
        self.api_token = settings.HF_API_KEY
        self.headers = {"Authorization": f"Bearer {self.api_token}", "X-Wait-For-Model": "true"} if self.api_token else {}

        self.tickers = tickers

        if not self.api_token:
            print("⚠️ WARNING: HF_API_KEY not found. Using VADER sentiment only.")

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

    def _vader_sentiment(self, text: str) -> Dict[str, Any]:
        """Get sentiment using VADER (fallback method)."""
        scores = self.vader.polarity_scores(text)
        compound = scores['compound']  # -1 to 1
        
        if compound >= 0.05:
            label = "Positive"
        elif compound <= -0.05:
            label = "Negative"
        else:
            label = "Neutral"
        
        confidence = abs(compound)
        
        return {
            "Sentiment": compound,
            "Label": label,
            "Confidence": confidence
        }

    def _query_hf_api(self, inputs: List[str]) -> List[List[Dict[str, Any]]]:
        """Send payloads to HF Inference API with wait-for-model logic."""
        if not inputs: return []

        try:
            response = requests.post(
                self.api_url,
                headers=self.headers,
                json={"inputs": inputs, "options": {"wait_for_model": True}},
                timeout=90
            )

            if response.status_code == 503:
                time.sleep(20)
                return self._query_hf_api(inputs)

            if response.status_code != 200:
                return []

            return response.json()
        except requests.exceptions.Timeout:
            return []
        except Exception as e:
            return []

    def _score_texts(self, texts: List[str]) -> pd.DataFrame:
        """Process sentiment with HuggingFace API, fallback to VADER if it fails."""
        if not texts: return pd.DataFrame()

        results = [None] * len(texts)

        def process_single(idx, text):
            time.sleep(random.uniform(0.1, 0.5))
            
            # Try HuggingFace API first
            response = self._query_hf_api([text])

            if response and isinstance(response, list) and len(response) > 0:
                item = response[0]
                if isinstance(item, list):
                    try:
                        score_map = {res['label'].lower(): res['score'] for res in item}
                        pos = score_map.get('positive', 0.0)
                        neg = score_map.get('negative', 0.0)
                        net_score = pos - neg

                        winning_item = max(item, key=lambda x: x['score'])
                        label = winning_item['label'].capitalize()
                        confidence = winning_item['score']

                        return idx, {"Sentiment": net_score, "Label": label, "Confidence": confidence}
                    except Exception:
                        pass

            # Fallback to VADER if HuggingFace fails
            vader_result = self._vader_sentiment(text)
            return idx, vader_result

        with ThreadPoolExecutor(max_workers=3) as executor:
            future_to_idx = {executor.submit(process_single, i, t): i for i, t in enumerate(texts)}
            for future in as_completed(future_to_idx):
                idx, data = future.result()
                results[idx] = data

        return pd.DataFrame(results)

    def get_news(self, tickers: List[str], timeout: int, limit: Optional[int] = None) -> pd.DataFrame:
        """Fetch news from Google RSS feeds."""
        all_news_items = []
        with ThreadPoolExecutor(max_workers=min(32, len(tickers) * 2 + 4)) as executor:
            futures = [executor.submit(self._fetch_single_feed, t, timeout, limit) for t in tickers]
            for future in as_completed(futures):
                all_news_items.extend(future.result())

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
            return

        df = self.get_news(tickers, timeout=12, limit=None)

        if df.empty:
            # Cache empty result
            cache.set(cache_key, (pd.DataFrame(), pd.DataFrame()), ttl_seconds=3600)
            return

        print("🔥 Waking up the model... please wait.")
        self._query_hf_api(["Just warming up the engine."])
        time.sleep(15)

        # Batch Scoring (with VADER fallback)
        sentiment_df = self._score_texts(df["Title"].tolist())

        # Merge sentiment into news data
        df = pd.concat([df.reset_index(drop=True), sentiment_df], axis=1)

        # Data Cleaning & Aggregation
        df["Date"] = df["Published"].dt.date

        df_daily = (
            df.groupby(["Ticker", "Date"])["Sentiment"]
            .mean()
            .reset_index()
        )

        sentiment_wide = df_daily.pivot(index='Date', columns='Ticker', values='Sentiment')
        news_data = df
        
        # Cache for 1 hour
        cache.set(cache_key, (news_data, sentiment_wide), ttl_seconds=3600)
        print("✅ Sentiment data cached for 1 hour")

    def get_latest_sentiment(self) -> Tuple[pd.DataFrame, pd.DataFrame]:
        """Get latest sentiment from cache, rebuild if expired."""
        cache_key = "sentiment_data"
        
        # Try cache first
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
        
        # Fallback
        return pd.DataFrame(), pd.DataFrame()


# Global sentiment engine instance
sentiment_engine = SentimentAnalyzer(tickers=get_tickers())