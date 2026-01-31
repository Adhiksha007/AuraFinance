import pandas as pd
import numpy as np
import yfinance as yf

def fetch_data(tickers, period='1y', interval='1d'):
  data = yf.download(tickers, period=period, interval=interval)['Close']
  data = data.interpolate(method='time', limit_direction='both', axis=0)
  returns = data.pct_change().dropna()
  return returns

def calculate_technical_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Transforms raw data into clean, machine-learning-ready features.
    Input: df (Pandas DataFrame) - expected to have 'Close' column.
    Output: df with new columns (RSI, MACD, etc.).
    """
    if df.empty or 'Close' not in df.columns:
        return df
    
    # Ensure Close is numeric
    close_prices = df['Close']
    
    # --- RSI Calculation (14 periods) ---
    delta = close_prices.diff()
    gain = (delta.where(delta > 0, 0)).fillna(0)
    loss = (-delta.where(delta < 0, 0)).fillna(0)
    
    window_length = 14
    avg_gain = gain.rolling(window=window_length, min_periods=1).mean()
    avg_loss = loss.rolling(window=window_length, min_periods=1).mean()
    
    try:
        rs = avg_gain / avg_loss
        rsi = 100 - (100 / (1 + rs))
        df['RSI'] = rsi.fillna(50) # default neutral
    except Exception as e:
        print(f"Error calculating RSI: {e}")
        df['RSI'] = 50

    # --- MACD Calculation ---
    try:
        # EMA 12
        ema12 = close_prices.ewm(span=12, adjust=False).mean()
        # EMA 26
        ema26 = close_prices.ewm(span=26, adjust=False).mean()
        
        macd_line = ema12 - ema26
        signal_line = macd_line.ewm(span=9, adjust=False).mean()
        
        df['MACD'] = macd_line
        df['MACD_Signal'] = signal_line
        df['MACD_Hist'] = macd_line - signal_line
        
    except Exception as e:
        print(f"Error calculating MACD: {e}")
        df['MACD'] = 0.0
        df['MACD_Signal'] = 0.0
        df['MACD_Hist'] = 0.0

    return df
