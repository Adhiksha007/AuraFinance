# import os
# import datetime
# import numpy as np
# import pandas as pd
# import feedparser
# import torch
# from concurrent.futures import ThreadPoolExecutor, as_completed
# from typing import List, Tuple, Dict, Any, Optional
# from scipy.special import softmax
# from transformers import AutoTokenizer, AutoModelForSequenceClassification
# from app.core.config import settings
# from app.services.tickers import get_tickers
# from app.services.cache_manager import cache


# class SentimentAnalyzer:
#     def __init__(self, tickers: List[str], model_name: str = "ProsusAI/finbert"):
#         self.model_name = model_name
#         self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
#         self.tickers = tickers

#         print(f"--- Initializing Sentiment Analyzer on {self.device} ---")

#         try:
#             self.tokenizer = AutoTokenizer.from_pretrained(model_name, local_files_only=True)
#             self.model = AutoModelForSequenceClassification.from_pretrained(
#                 model_name, local_files_only=True
#             ).to(self.device)
#             print("🚀 Success: Loaded model from local cache.")
#         except Exception:
#             print("📥 Model not found locally. Downloading...")
#             self.tokenizer = AutoTokenizer.from_pretrained(model_name)
#             self.model = AutoModelForSequenceClassification.from_pretrained(model_name).to(self.device)
#             print("✅ Setup complete.")

#         # Set model to evaluation mode
#         self.model.eval()

#     @staticmethod
#     def _fetch_single_feed(ticker: str, timeout: int, limit: Optional[int] = None) -> List[Dict[str, Any]]:
#         """Fetch RSS feed with timeout and limit support."""
#         try:
#             url = f"https://news.google.com/rss/search?q={ticker}+when:{timeout}h"
#             feed = feedparser.parse(url)
#             extracted = []
#             for entry in feed.entries:
#                 extracted.append({
#                     "Ticker": ticker,
#                     "Title": entry.title,
#                     "Link": entry.link,
#                     "Published": entry.published
#                 })
#             return extracted[:limit] if limit else extracted
#         except Exception:
#             return []

#     def _score_texts(self, texts: List[str]) -> pd.DataFrame:
#         """
#         Batch process sentiment scores with labels and confidence.
#         Returns DataFrame with Sentiment, Label, and Confidence columns.
#         """
#         if not texts:
#             return pd.DataFrame()

#         # Process in batches to avoid memory issues
#         batch_size = 16
#         all_results = []

#         for i in range(0, len(texts), batch_size):
#             batch = texts[i:i + batch_size]

#             inputs = self.tokenizer(
#                 batch,
#                 return_tensors="pt",
#                 padding=True,
#                 truncation=True,
#                 max_length=512
#             ).to(self.device)

#             with torch.no_grad():
#                 outputs = self.model(**inputs)

#             # Get probabilities: [positive, negative, neutral]
#             probs = softmax(outputs.logits.cpu().numpy(), axis=1)

#             # Process each result
#             for prob in probs:
#                 positive = float(prob[0])
#                 negative = float(prob[1])
#                 neutral = float(prob[2])

#                 # Sentiment score: positive - negative
#                 sentiment_score = positive - negative

#                 # Determine label
#                 max_idx = prob.argmax()
#                 labels = ['Positive', 'Negative', 'Neutral']
#                 label = labels[max_idx]
#                 confidence = float(prob[max_idx])

#                 all_results.append({
#                     'Sentiment': sentiment_score,
#                     'Label': label,
#                     'Confidence': confidence
#                 })

#         return pd.DataFrame(all_results)

#     def get_news(self, tickers: List[str], timeout: int, limit: Optional[int] = None) -> pd.DataFrame:
#         """Fetch news from Google RSS feeds with concurrent processing."""
#         all_news_items = []
#         with ThreadPoolExecutor(max_workers=min(32, len(tickers) * 2 + 4)) as executor:
#             futures = [executor.submit(self._fetch_single_feed, t, timeout, limit) for t in tickers]
#             for future in as_completed(futures):
#                 all_news_items.extend(future.result())

#         if not all_news_items:
#             return pd.DataFrame()

#         df = pd.DataFrame(all_news_items)
#         if 'Published' in df.columns:
#             df['Published'] = pd.to_datetime(df['Published'], errors='coerce')
#             df = df.sort_values("Published", ascending=False)

#         return df

#     def build_dataframe(self, tickers: List[str]):
#         """
#         Build sentiment data with persistent caching.
#         Uses 1-hour TTL cache.
#         """
#         cache_key = "sentiment_data"

#         # Check cache first
#         cached_data = cache.get(cache_key)
#         if cached_data is not None:
#             print("✅ Using cached sentiment data")
#             return

#         print(f"🔄 Processing {len(tickers)} tickers...")
#         df = self.get_news(tickers, timeout=12, limit=None)

#         if df.empty:
#             print("⚠️ No news found for provided tickers.")
#             cache.set(cache_key, (pd.DataFrame(), pd.DataFrame()), ttl_seconds=3600)
#             return

#         # Batch scoring with labels and confidence
#         print(f"🧠 Scoring {len(df)} headlines...")
#         sentiment_df = self._score_texts(df["Title"].tolist())

#         # Merge sentiment data into news DataFrame
#         df = pd.concat([df.reset_index(drop=True), sentiment_df], axis=1)

#         # Data aggregation
#         df["Date"] = df["Published"].dt.date

#         # Calculate daily sentiment
#         df_daily = (
#             df.groupby(["Ticker", "Date"])["Sentiment"]
#             .mean()
#             .reset_index()
#         )

#         # Pivot to wide format
#         sentiment_wide = df_daily.pivot(index='Date', columns='Ticker', values='Sentiment')
#         news_data = df

#         # Cache for 1 hour
#         cache.set(cache_key, (news_data, sentiment_wide), ttl_seconds=3600)
#         print("✅ Sentiment data cached for 1 hour")

#     def get_latest_sentiment(self) -> Tuple[pd.DataFrame, pd.DataFrame]:
#         """Get latest sentiment from cache, rebuild if expired."""
#         cache_key = "sentiment_data"

#         # Try cache first
#         cached_data = cache.get(cache_key)
#         if cached_data is not None:
#             news_data, sentiment_wide = cached_data
#             return news_data, sentiment_wide

#         # Cache miss - rebuild
#         print("⚠️ Cache miss - rebuilding sentiment data...")
#         self.build_dataframe(self.tickers)

#         # Get from cache after rebuild
#         cached_data = cache.get(cache_key)
#         if cached_data is not None:
#             return cached_data

#         # Fallback
#         return pd.DataFrame(), pd.DataFrame()


# # Global sentiment engine instance
# # sentiment_engine = SentimentAnalyzer(tickers=get_tickers())