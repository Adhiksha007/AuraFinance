from typing import List, Dict

TICKERS = [
    {"symbol": "AAPL", "name": "Apple Inc."},
    {"symbol": "MSFT", "name": "Microsoft Corporation"},
    {"symbol": "GOOGL", "name": "Alphabet Inc."},
    {"symbol": "AMZN", "name": "Amazon.com Inc."},
    {"symbol": "NVDA", "name": "NVIDIA Corporation"},
    {"symbol": "TSLA", "name": "Tesla Inc."},
    {"symbol": "META", "name": "Meta Platforms Inc."},
    {"symbol": "BRK-B", "name": "Berkshire Hathaway Inc."},
    {"symbol": "LLY", "name": "Eli Lilly and Company"},
    {"symbol": "V", "name": "Visa Inc."},
    {"symbol": "JPM", "name": "JPMorgan Chase & Co."},
    {"symbol": "WMT", "name": "Walmart Inc."},
    {"symbol": "XOM", "name": "Exxon Mobil Corporation"},
    {"symbol": "MA", "name": "Mastercard Incorporated"},
    {"symbol": "UNH", "name": "UnitedHealth Group Incorporated"},
    {"symbol": "PG", "name": "Procter & Gamble Company"},
    {"symbol": "JNJ", "name": "Johnson & Johnson"},
    {"symbol": "AVGO", "name": "Broadcom Inc."},
    {"symbol": "HD", "name": "The Home Depot Inc."},
    {"symbol": "COST", "name": "Costco Wholesale Corporation"},
    {"symbol": "MRK", "name": "Merck & Co. Inc."},
    {"symbol": "ABBV", "name": "AbbVie Inc."},
    {"symbol": "CRM", "name": "Salesforce Inc."},
    {"symbol": "AMD", "name": "Advanced Micro Devices Inc."},
    {"symbol": "INTC", "name": "Intel Corporation"},
    {"symbol": "NFLX", "name": "Netflix Inc."},
    {"symbol": "DIS", "name": "The Walt Disney Company"},
    {"symbol": "NKE", "name": "NIKE Inc."},
    {"symbol": "SPY", "name": "SPDR S&P 500 ETF Trust"},
    {"symbol": "QQQ", "name": "Invesco QQQ Trust"},
    {"symbol": "DIA", "name": "SPDR Dow Jones Industrial Average ETF Trust"},
]

def search_tickers(query: str) -> List[Dict[str, str]]:
    q = query.upper()
    return [
        t for t in TICKERS
        if t["symbol"].startswith(q) or q in t["name"].upper()
    ][:10]

def get_tickers() -> List[str]:
    return [
    "AAPL", "MSFT", "NVDA", "GOOGL", "AMZN", "META",
    "IEF", "HYG", "GLD", "IAU", "BTC-USD"]