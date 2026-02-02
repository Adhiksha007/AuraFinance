import sys
import os
import pandas as pd
from app.services.sentiment import SentimentAnalyzer

# Ensure we can import from app
sys.path.append(os.getcwd())

def test_sentiment():
    print("🚀 Initializing Sentiment Analyzer Test...")
    
    # Use a small set of tickers for testing
    tickers = ["AAPL", "NVDA", "SPY"]
    
    try:
        analyzer = SentimentAnalyzer(tickers=tickers)
        
        print(f"📡 Fetching news and scoring for: {tickers}")
        news, sentiment = analyzer.get_latest_sentiment()
        
        print("\n✅ Test Complete!")
        
        if not news.empty:
            print(f"\n📰 News Found: {len(news)} articles")
            print(news[['Ticker', 'Title', 'Sentiment', 'Label', 'Confidence']].head())
        else:
            print("⚠️ No news found.")
            
        if not sentiment.empty:
            print("\n📊 Sentiment Matrix:")
            print(sentiment)
        else:
            print("⚠️ Sentiment matrix is empty.")
            
    except Exception as e:
        print(f"\n❌ Test Failed with error: {e}")

if __name__ == "__main__":
    test_sentiment()
