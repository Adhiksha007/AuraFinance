
import yfinance as yf
import pandas as pd
import numpy as np
from datetime import datetime, time as dt_time, timezone
import asyncio
from typing import Dict, Any, List
import time

# Global indices tickers
INDICES = {
    "S&P 500": {
        "ticker": "^GSPC", 
        "region": "USA",
        "fact": "Tracks the 500 largest US companies."
    },
    "Nasdaq": {
        "ticker": "^IXIC", 
        "region": "USA (Tech)",
        "fact": "Heavily weighted towards technology and innovation."
    },
    "FTSE 100": {
        "ticker": "^FTSE", 
        "region": "UK",
        "fact": "Represents the 100 most capitalized UK companies."
    },
    "Nikkei 225": {
        "ticker": "^N225", 
        "region": "Japan",
        "fact": "The premier index of Japanese stocks."
    }
}

# Sector ETFs
SECTORS = {
    "Technology": "XLK",
    "Communication Services": "XLC",   # Google, Meta, Netflix
    "Consumer Discretionary": "XLY",   # Amazon, Tesla, Starbucks
    "Consumer Staples": "XLP",         # Walmart, Coca-Cola, P&G
    "Energy": "XLE",                   # ExxonMobil, Chevron
    "Financials": "XLF",               # JP Morgan, Visa, Goldman Sachs
    "Health Care": "XLV",              # Pfizer, UnitedHealth
    "Industrials": "XLI",              # Boeing, Caterpillar, UPS
    "Materials": "XLB",                # Chemicals, Mining, Steel
    "Real Estate": "XLRE",             # REITs, Property Management
    "Utilities": "XLU"                 # NextEra Energy, Duke Energy
}

EXTENDED_INDIAN_SECTORS = {
    # --- BROAD SECTORAL INDICES (High Reliability) ---
    "Banking": "^NSEBANK",
    "IT": "^CNXIT",
    "Auto": "^CNXAUTO",
    "Pharma": "^CNXPHARMA",
    "FMCG": "^CNXFMCG",
    "Metal": "^CNXMETAL",
    "Realty": "^CNXREALTY",
    "Energy": "^CNXENERGY",
    "Media": "^CNXMEDIA",
    "Infrastructure": "^CNXINFRA",
    "Financial Services": "NIFTY_FIN_SERVICE.NS",

    # --- SPECIALIZED SECTORS (Using Verified Proxies/Indices) ---
    "Agriculture": "COROMANDEL.NS",      # Coromandel Intl (Fertilizers/Agri)
    "Auto Ancillary": "MOTHERSON.NS",    # Samvardhana Motherson
    "Aviation": "INDIGO.NS",            # InterGlobe Aviation
    "Building Materials": "ULTRACEMCO.NS", # UltraTech Cement
    "Chemicals": "SRF.NS",              # SRF Ltd (Largest Chemical Proxy)
    "Consumer Durables": "VOLTAS.NS",    # Voltas (Appliances)
    "Dairy": "HATSUN.NS",               # Hatsun Agro
    "Education": "NIITLTD.NS",          # NIIT (Edu-tech)
    "Engineering": "LT.NS",             # Larsen & Toubro
    "Fertilizers": "FACT.NS",           # Fertilizers & Chemicals Travancore
    "Logistics": "CONCOR.NS",           # Container Corp
    "NBFC": "BAJFINANCE.NS",            # Bajaj Finance
    "Oil & Gas": "ONGC.NS",             # ONGC (Energy/Oil)
    "Packaging": "POLYPLEX.NS",         # Polyplex Corp
    "Plastic Pipes": "ASTRAL.NS",       # Astral Ltd
    "Retail": "TRENT.NS",               # Trent (Tata Retail)
    "Software Services": "TCS.NS",      # Tata Consultancy Services
    "Solar Energy": "TATAPOWER.NS",     # Tata Power
    "Telecom": "BHARTIARTL.NS",         # Bharti Airtel
    "Textiles": "PAGEIND.NS",           # Page Industries (Jockey)
    "Tourism": "INDHOTEL.NS",           # Indian Hotels (Taj Group)
    "Trading": "ADANIENT.NS"            # Adani Enterprises
}

class MarketService:
    def __init__(self):
        self._cache = {}
        self._cache_duration = 300  # 5 minutes

    def _get_from_cache(self, key: str):
        if key in self._cache:
            item = self._cache[key]
            if time.time() < item['expires']:
                return item['data']
        return None

    def _set_cache(self, key: str, data: Any):
        self._cache[key] = {
            'data': data,
            'expires': time.time() + self._cache_duration
        }

    def get_market_status(self) -> Dict[str, str]:
        """Check status based on UTC time."""
        now_utc = datetime.now(timezone.utc)
        weekday = now_utc.weekday()
        
        status = {}
        is_weekend = weekday >= 5
        
        if is_weekend:
            status["New York"] = "WEEKEND"
            status["London"] = "WEEKEND"
            status["Tokyo"] = "WEEKEND"
            status["global_is_open"] = False
            return status

        # UTC Hours
        current_hour = now_utc.hour + now_utc.minute / 60.0
        
        # NY: ~14.5 to 21.0
        status["New York"] = "OPEN" if 14.5 <= current_hour <= 21.0 else "CLOSED"
        # London: ~8.0 to 16.5
        status["London"] = "OPEN" if 8.0 <= current_hour <= 16.5 else "CLOSED"
        # Tokyo: ~0.0 to 6.0
        status["Tokyo"] = "OPEN" if 0.0 <= current_hour <= 6.0 else "CLOSED"

        status["global_is_open"] = (status["New York"] == "OPEN") or (status["London"] == "OPEN") or (status["Tokyo"] == "OPEN")
        return status

    async def get_combined_data(self) -> Dict[str, Any]:
        market_status = self.get_market_status()
        
        # Pass full status to separate indices if needed, or just boolean
        indices_task = self.get_global_indices_data(market_status["global_is_open"])
        sentiment_task = self.get_market_sentiment()
        sectors_task = self.get_sector_performance()
        signals_task = self.get_market_signals(market_status)
        india_task = self.get_india_sectors()

        indices, sentiment, sectors, signals, india_sectors = await asyncio.gather(
            indices_task, sentiment_task, sectors_task, signals_task, india_task
        )

        return {
            "indices": indices, # Now a dict of separate index objects
            "sentiment": sentiment,
            "sectors": sectors,
            "india_sectors": india_sectors,
            "signals": signals,
            "market_status": market_status,
            "timestamp": int(time.time() * 1000)
        }


    async def get_global_indices_data(self, is_market_open: bool) -> Dict[str, Any]:
        """
        Returns separate analysis for each index with Technical Indicators.
        """
        cache_key = f"global_indices_pro_{is_market_open}"
        cached = self._get_from_cache(cache_key)
        if cached: return cached

        try:
            # 1. Prepare Tickers (Adding period for SMA calculation)
            tickers_list = [v["ticker"] for v in INDICES.values()]
            
            # We fetch 60 days to ensure we can calculate a 50-day SMA
            raw_df = yf.download(tickers_list, period="60d", interval="1d", progress=False)['Close']
            
            # Intraday data for the sparkline
            if is_market_open:
                intraday_df = yf.download(tickers_list, period="1d", interval="5m", progress=False)['Close']
            else:
                intraday_df = yf.download(tickers_list, period="5d", interval="1h", progress=False)['Close']

            raw_df = raw_df.ffill().bfill()
            intraday_df = intraday_df.ffill().bfill()
            
            result = {}

            for name, meta in INDICES.items():
                ticker = meta["ticker"]
                if ticker not in intraday_df.columns: continue
                
                # --- Technical Analysis ---
                history = raw_df[ticker].dropna()
                
                # SAFETY CHECK: We need at least 50 points for SMA and 2 points for price change
                if len(history) < 50: 
                    continue

                sma50 = history.rolling(window=50).mean().iloc[-1]
                current_price = float(history.iloc[-1])
                old_price = float(history.iloc[-2])
                
                # Health Score (0-10)
                health_score = 10 if current_price > sma50 * 1.02 else (5 if current_price >= sma50 else 2)
                signal = "Bullish" if current_price > sma50 else "Bearish"

                # --- Chart Processing ---
                series = intraday_df[ticker].dropna()
                if series.empty:
                    series = history[-50:] # Fallback to daily data if intraday missing
                
                if series.empty: continue

                start_price = float(series.iloc[0])

                change_pct = ((current_price - old_price) / old_price) * 100
                
                chart_data = []
                # Sample for performance (50 points)
                step = max(1, len(series) // 50)
                for i in range(0, len(series), step):
                    val = float(series.iloc[i])
                    chart_data.append({
                        "time": series.index[i].strftime("%H:%M"),
                        "value": round(((val - start_price) / start_price) * 100, 2),
                        "price": round(val, 2)
                    })

                # --- Final Assembly ---
                result[name] = {
                    "region": meta["region"],
                    "quick_fact": meta["fact"],
                    "current_price": round(current_price, 2),
                    "percent_change": round(change_pct, 2),
                    "color": "#10b981" if change_pct >= 0 else "#ef4444",
                    "indicator": "🚀" if signal == "Bullish" else "📉",
                    "technical": {
                        "sma50": round(sma50, 2),
                        "health_score": health_score,
                        "signal": signal
                    },
                    "chart_data": chart_data
                }

            self._set_cache(cache_key, result)
            return result

        except Exception as e:
            print(f"❌ Error in get_global_indices_data: {e}")
            return {}

    async def get_market_sentiment(self) -> Dict[str, Any]:
        cache_key = "market_sentiment"
        cached = self._get_from_cache(cache_key)
        if cached: return cached

        try:
            vix = yf.Ticker("^VIX")
            hist = vix.history(period="1d")
            current_vix = hist['Close'].iloc[-1] if not hist.empty else 20.0
            
            score = max(0, min(100, (35 - current_vix) / (35 - 10) * 100))
            score = round(score)
            
            status = "Neutral"
            icon = "⚖️"
            summary = "Investors are cautious."
            color = "#fbbf24"

            if score > 75: 
                status = "Extreme Greed"
                icon = "🚀"
                summary = "Investors are extremely confident."
                color = "#10b981"
            elif score > 60: 
                status = "Greed"
                icon = "🟢"
                summary = "Market sentiment is positive."
                color = "#34d399"
            elif score < 25: 
                status = "Extreme Fear"
                icon = "😱"
                summary = "High panic in the market."
                color = "#ef4444"
            elif score < 40: 
                status = "Fear"
                icon = "🔴"
                summary = "Investors are nervous."
                color = "#f87171"

            result = {
                "score": score,
                "status": status,
                "vix": round(current_vix, 2),
                "frontend_payload": {
                    "color_code": color,
                    "icon": icon,
                    "simple_summary": summary
                }
            }
            self._set_cache(cache_key, result)
            return result
        except Exception as e:
            return {"score": 50, "status": "Neutral", "vix": 20.0}

    async def get_sector_performance(self) -> List[Dict[str, Any]]:
        cache_key = "sector_performance"
        cached = self._get_from_cache(cache_key)
        if cached: return cached

        try:
            tickers = list(SECTORS.values())
            data = yf.download(tickers, period="2d", progress=False)['Close']
            
            results = []
            if len(data) >= 1:
                if len(data) >= 2:
                    current = data.iloc[-1]
                    prev = data.iloc[-2]
                    changes = ((current - prev) / prev) * 100
                else: 
                    changes = pd.Series(0, index=data.columns)

                for name, ticker in SECTORS.items():
                    val = 0.0
                    if ticker in changes:
                        val = round(float(changes[ticker]), 2)
                    
                    results.append({
                        "name": name,
                        "change": val,
                        "ticker": ticker,
                        "frontend_payload": {
                            "color_code": "#10b981" if val > 0 else "#ef4444",
                            "icon": "🟢" if val > 0 else "🔴",
                            "simple_summary": f"{name} is {'up' if val > 0 else 'down'} {abs(val)}%."
                        }
                    })
            self._set_cache(cache_key, results)
            return results
        except Exception:
            return []

    async def get_india_sectors(self) -> List[Dict[str, Any]]:
        """
        Fetches and processes 33+ Indian sectors with safety checks and frontend payloads.
        """
        cache_key = "india_sector_performance"
        cached = self._get_from_cache(cache_key)
        if cached: return cached

        results = []
        
        # We use a loop for India because thematic tickers often fail in batch downloads
        for name, ticker in EXTENDED_INDIAN_SECTORS.items():
            try:
                # Step 1: Download with 1mo period to ensure weekend data is available
                data = yf.download(ticker, period="1mo", interval="1d", progress=False, auto_adjust=True)
                
                # Step 2: Safety Check for empty data
                if data.empty or len(data) < 2:
                    continue

                prices = data['Close']
                
                # Step 3: Safe Extraction (handles Series vs Single Value warnings)
                curr = float(prices.iloc[-1].item()) if hasattr(prices.iloc[-1], 'item') else float(prices.iloc[-1])
                prev = float(prices.iloc[-2].item()) if hasattr(prices.iloc[-2], 'item') else float(prices.iloc[-2])
                
                change = round(((curr - prev) / prev) * 100, 2)
                
                # Step 4: Build the Unified Response Structure
                results.append({
                    "name": name,
                    "change": change,
                    "ticker": ticker,
                    "current_price": round(curr, 2),
                    "frontend_payload": {
                        "color_code": "#10b981" if change >= 0 else "#ef4444",
                        "icon": "🟢" if change >= 0 else "🔴",
                        "simple_summary": f"{name} is {'up' if change >= 0 else 'down'} {abs(change)}% today."
                    }
                })
                
            except Exception as e:
                # Log skipping without crashing the entire loop
                print(f"❌ Skipping {name} ({ticker}): {e}")
                continue

        # Sort results by performance (Top Gainers first) for a better UI experience
        results = sorted(results, key=lambda x: x['change'], reverse=True)

        self._set_cache(cache_key, results)
        return results


    async def get_market_signals(self, market_status: Dict[str, str]) -> List[Dict[str, Any]]:
        cache_key = "market_signals"
        cached = self._get_from_cache(cache_key)
        if cached: return cached

        results = []
        try:
            tickers_list = [v["ticker"] for v in INDICES.values()]
            df = yf.download(tickers_list, period="3mo", progress=False)['Close']
            
            if not df.empty:
                current_prices = df.iloc[-1]
                sma_50 = df.rolling(window=50).mean().iloc[-1]
                
                for name, meta in INDICES.items():
                    ticker = meta["ticker"]
                    region = meta["region"]
                    
                    exc_status = "CLOSED" 
                    if "USA" in region: exc_status = market_status.get("New York", "CLOSED")
                    elif "UK" in region: exc_status = market_status.get("London", "CLOSED")
                    elif "Japan" in region: exc_status = market_status.get("Tokyo", "CLOSED")

                    if ticker in current_prices and ticker in sma_50:
                        price = float(current_prices[ticker])
                        sma = float(sma_50[ticker])
                        
                        if pd.isna(price) or pd.isna(sma) or sma == 0: continue

                        health_score = 5 
                        indicator = "⚠️ Caution"
                        desc = "Testing support levels."
                        
                        if price > sma * 1.02:
                            health_score = 10
                            indicator = "🚀 Bullish"
                            desc = f"{name} is in a healthy uptrend."
                        elif price < sma * 0.98:
                            health_score = 2
                            indicator = "📉 Bearish"
                            desc = f"{name} is in a downtrend zone."
                        else:
                            health_score = 5
                            indicator = "⚖️ Neutral"
                            desc = "Hovering near key support."

                        results.append({
                            "index": name,
                            "price": round(price, 2),
                            "sma_50": round(sma, 2),
                            "health_score": health_score,
                            "summary_card": {
                                "label": name,
                                "region": region,
                                "status": exc_status,
                                "indicator": indicator,
                                "description": desc
                            }
                        })

            self._set_cache(cache_key, results)
            return results
        except Exception as e:
            print(f"❌ Error signals: {e}")
            return []

market_service = MarketService()
