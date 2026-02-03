import sqlite3
import json
import pickle
from datetime import datetime, timedelta
from typing import Any, Optional, List
from pathlib import Path
import threading

class CacheManager:
    """
    Persistent SQLite-backed cache that survives Render free tier spin-downs.
    Thread-safe for concurrent access.
    """
    
    def __init__(self, db_path: str = "cache.db"):
        self.db_path = db_path
        self.lock = threading.Lock()
        self._init_db()
    
    def _init_db(self):
        """Initialize cache database with schema."""
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS cache (
                    key TEXT PRIMARY KEY,
                    value BLOB NOT NULL,
                    expires_at REAL NOT NULL,
                    created_at REAL NOT NULL
                )
            """)
            # Index for efficient expiration cleanup
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_expires_at 
                ON cache(expires_at)
            """)
            conn.commit()
    
    def get(self, key: str) -> Optional[Any]:
        """
        Retrieve value from cache if not expired.
        Returns None if key doesn't exist or is expired.
        """
        with self.lock:
            try:
                with sqlite3.connect(self.db_path) as conn:
                    cursor = conn.execute(
                        "SELECT value, expires_at FROM cache WHERE key = ?",
                        (key,)
                    )
                    row = cursor.fetchone()
                    
                    if not row:
                        return None
                    
                    value_blob, expires_at = row
                    
                    # Check if expired
                    if datetime.now().timestamp() > expires_at:
                        # Delete expired entry
                        conn.execute("DELETE FROM cache WHERE key = ?", (key,))
                        conn.commit()
                        return None
                    
                    # Deserialize value
                    return pickle.loads(value_blob)
            except Exception:
                return None
    
    def set(self, key: str, value: Any, ttl_seconds: int = 3600):
        """
        Store value in cache with TTL (time to live).
        Default TTL is 1 hour.
        """
        with self.lock:
            try:
                now = datetime.now().timestamp()
                expires_at = now + ttl_seconds
                value_blob = pickle.dumps(value)
                
                with sqlite3.connect(self.db_path) as conn:
                    conn.execute(
                        """
                        INSERT OR REPLACE INTO cache (key, value, expires_at, created_at)
                        VALUES (?, ?, ?, ?)
                        """,
                        (key, value_blob, expires_at, now)
                    )
                    conn.commit()
            except Exception as e:
                print(f"Cache set error: {e}")
    
    def delete(self, key: str):
        """Delete a specific key from cache."""
        with self.lock:
            try:
                with sqlite3.connect(self.db_path) as conn:
                    conn.execute("DELETE FROM cache WHERE key = ?", (key,))
                    conn.commit()
            except Exception as e:
                print(f"Cache delete error: {e}")
    
    def clear_expired(self):
        """Remove all expired entries from cache."""
        with self.lock:
            try:
                now = datetime.now().timestamp()
                with sqlite3.connect(self.db_path) as conn:
                    cursor = conn.execute(
                        "DELETE FROM cache WHERE expires_at < ?",
                        (now,)
                    )
                    deleted = cursor.rowcount
                    conn.commit()
                    return deleted
            except Exception as e:
                print(f"Cache cleanup error: {e}")
                return 0
    
    def clear_all(self):
        """Clear entire cache (use with caution)."""
        with self.lock:
            try:
                with sqlite3.connect(self.db_path) as conn:
                    conn.execute("DELETE FROM cache")
                    conn.commit()
            except Exception as e:
                print(f"Cache clear error: {e}")
    
    def get_stats(self) -> dict:
        """Get cache statistics."""
        with self.lock:
            try:
                with sqlite3.connect(self.db_path) as conn:
                    cursor = conn.execute("SELECT COUNT(*) FROM cache")
                    total = cursor.fetchone()[0]
                    
                    now = datetime.now().timestamp()
                    cursor = conn.execute(
                        "SELECT COUNT(*) FROM cache WHERE expires_at < ?",
                        (now,)
                    )
                    expired = cursor.fetchone()[0]
                    
                    return {
                        "total_entries": total,
                        "expired_entries": expired,
                        "active_entries": total - expired
                    }
            except Exception:
                return {"error": "Failed to get stats"}
    
    def warm_cache(self, tickers: List[str], fetch_func, ttl_seconds: int = 3600):
        """
        Pre-populate cache with data for popular tickers.
        
        Args:
            tickers: List of ticker symbols to warm
            fetch_func: Function to fetch data for a ticker (takes ticker as arg)
            ttl_seconds: Cache TTL
        """
        for ticker in tickers:
            cache_key = f"ticker_summary:{ticker}"
            
            # Skip if already cached
            if self.get(cache_key) is not None:
                continue
            
            try:
                data = fetch_func(ticker)
                self.set(cache_key, data, ttl_seconds)
            except Exception as e:
                print(f"Failed to warm cache for {ticker}: {e}")


# Global cache instance
cache = CacheManager()
