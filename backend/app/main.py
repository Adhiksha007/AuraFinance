from fastapi import FastAPI
import threading
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.v1 import auth, portfolio, stockpicks, financial_aid, market, watchlist
from app.core.db import create_db_and_tables

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
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

# def background_load():
#     # This thread puts these heavy libraries into the global sys.modules cache
#     import qiskit.primitives
#     import qiskit_algorithms
#     import qiskit_optimization.algorithms
#     import qiskit_optimization.converters
#     print("✅ Heavy libraries pre-warmed in background.")

@app.on_event("startup")
async def startup_event():
    create_db_and_tables()
    # threading.Thread(target=background_load, daemon=True).start()

app.include_router(auth.router, prefix=f"{settings.API_V1_STR}/auth", tags=["auth"])
app.include_router(portfolio.router, prefix=f"{settings.API_V1_STR}/portfolio", tags=["portfolio"])
app.include_router(stockpicks.router, prefix=f"{settings.API_V1_STR}/recommendations", tags=["recommendations"])
app.include_router(financial_aid.router, prefix=f"{settings.API_V1_STR}/financial-aid", tags=["financial_aid"])
app.include_router(market.router, prefix=f"{settings.API_V1_STR}/market", tags=["market"])
app.include_router(watchlist.router, prefix=f"{settings.API_V1_STR}/watchlist", tags=["watchlist"])
from app.api.v1 import market_trends
app.include_router(market_trends.router, prefix=f"{settings.API_V1_STR}/market-trends", tags=["market-trends"])
# from app.api.v1 import quantum_portfolio
# app.include_router(quantum_portfolio.router, prefix=f"{settings.API_V1_STR}/quantum", tags=["quantum"])
from app.api.v1 import settings as settings_router
app.include_router(settings_router.router, prefix=f"{settings.API_V1_STR}/settings", tags=["settings"])
from app.api.v1 import users
app.include_router(users.router, prefix=f"{settings.API_V1_STR}/users", tags=["users"])
from app.api.v1 import goals
app.include_router(goals.router, prefix=f"{settings.API_V1_STR}/goals", tags=["goals"])

@app.get("/")
def read_root():
    return {"message": "Welcome to AuraFinance API"}
