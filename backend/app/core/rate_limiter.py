from fastapi import Request, HTTPException
from fastapi.responses import JSONResponse
from datetime import datetime, timedelta
from collections import defaultdict
import threading
from typing import Dict, Tuple, List

class RateLimiter:
    """
    Simple in-memory rate limiter using sliding window.
    Limits requests per IP address.
    """
    
    def __init__(self, requests_per_minute: int = 30):  # Increased from 10 to 30
        """
        Initialize rate limiter with sliding window.
        
        Args:
            requests_per_minute: Maximum requests allowed per minute per IP
        """
        self.requests_per_minute = requests_per_minute
        self.window_size = 60  # 60 seconds
        self.requests: Dict[str, List[float]] = defaultdict(list)  # Fixed: use 'requests' not 'request_log'
        self.lock = threading.Lock()
    
    def is_allowed(self, client_ip: str) -> Tuple[bool, int]:
        """
        Check if request is allowed for this IP.
        Returns (is_allowed, remaining_requests).
        """
        with self.lock:
            now = datetime.now()
            cutoff = now - timedelta(minutes=1)
            
            # Remove old requests outside the window
            self.requests[client_ip] = [
                req_time for req_time in self.requests[client_ip]
                if req_time > cutoff
            ]
            
            # Check if limit exceeded
            current_count = len(self.requests[client_ip])
            
            if current_count >= self.requests_per_minute:
                return False, 0
            
            # Add current request
            self.requests[client_ip].append(now)
            remaining = self.requests_per_minute - current_count - 1
            
            return True, remaining
    
    def cleanup_old_entries(self):
        """Remove IPs with no recent requests to prevent memory bloat."""
        with self.lock:
            now = datetime.now()
            cutoff = now - timedelta(minutes=5)
            
            # Remove IPs with no requests in last 5 minutes
            ips_to_remove = [
                ip for ip, times in self.requests.items()
                if not times or max(times) < cutoff
            ]
            
            for ip in ips_to_remove:
                del self.requests[ip]


# Global rate limiter instance
rate_limiter = RateLimiter(requests_per_minute=30)


async def rate_limit_middleware(request: Request, call_next):
    """
    Middleware to enforce rate limiting per IP.
    Returns 429 if limit exceeded.
    """
    # Get client IP
    client_ip = request.client.host if request.client else "unknown"
    
    # Skip rate limiting for health check endpoint and OPTIONS requests (CORS preflight)
    if request.url.path == "/" or request.url.path == "/health" or request.method == "OPTIONS":
        return await call_next(request)
    
    # Check rate limit
    allowed, remaining = rate_limiter.is_allowed(client_ip)
    
    if not allowed:
        return JSONResponse(
            status_code=429,
            content={
                "detail": "Rate limit exceeded. Please try again in a minute.",
                "retry_after": 60
            },
            headers={
                "Retry-After": "60",
                "X-RateLimit-Limit": str(rate_limiter.requests_per_minute),
                "X-RateLimit-Remaining": "0"
            }
        )
    
    # Process request
    response = await call_next(request)
    
    # Add rate limit headers
    response.headers["X-RateLimit-Limit"] = str(rate_limiter.requests_per_minute)
    response.headers["X-RateLimit-Remaining"] = str(remaining)
    
    return response
