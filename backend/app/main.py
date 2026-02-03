from fastapi import FastAPI
from fastapi.responses import ORJSONResponse
import threading
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from app.core.config import settings
from app.api.v1 import auth, stockpicks, market, watchlist, market_trends, quantum_portfolio, settings as settings_router, users, goals
from app.core.db import create_db_and_tables
from app.core.rate_limiter import rate_limit_middleware
from app.services.cache_manager import cache

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    default_response_class=ORJSONResponse  # Use orjson for 2-3x faster JSON
)

# Set all CORS enabled origins
if settings.BACKEND_CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

# Add GZip compression middleware (compress responses > 1KB)
app.add_middleware(GZipMiddleware, minimum_size=1000)

# Add rate limiting middleware
app.middleware("http")(rate_limit_middleware)

def background_load():
    # This thread puts these heavy libraries into the global sys.modules cache
    import qiskit.primitives
    import qiskit_algorithms
    import qiskit_optimization.algorithms
    import qiskit_optimization.converters

@app.on_event("startup")
async def startup_event():
    create_db_and_tables()
    
    # Clean expired cache entries
    cache.clear_expired()
    
    # Background load heavy libraries
    threading.Thread(target=background_load, daemon=True).start()

app.include_router(auth.router, prefix=f"{settings.API_V1_STR}/auth", tags=["auth"])
app.include_router(stockpicks.router, prefix=f"{settings.API_V1_STR}/recommendations", tags=["recommendations"])
app.include_router(market.router, prefix=f"{settings.API_V1_STR}/market", tags=["market"])
app.include_router(watchlist.router, prefix=f"{settings.API_V1_STR}/watchlist", tags=["watchlist"])
app.include_router(market_trends.router, prefix=f"{settings.API_V1_STR}/market-trends", tags=["market-trends"])
app.include_router(quantum_portfolio.router, prefix=f"{settings.API_V1_STR}/quantum", tags=["quantum"])
app.include_router(settings_router.router, prefix=f"{settings.API_V1_STR}/settings", tags=["settings"])
app.include_router(users.router, prefix=f"{settings.API_V1_STR}/users", tags=["users"])
app.include_router(goals.router, prefix=f"{settings.API_V1_STR}/goals", tags=["goals"])

@app.get("/")
def read_root():
    return {"message": "Welcome to AuraFinance API"}

@app.get("/health")
def health_check():
    """Health check endpoint for monitoring."""
    stats = cache.get_stats()
    return {
        "status": "healthy",
        "cache": stats
    }
