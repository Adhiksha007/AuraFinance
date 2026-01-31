from typing import Optional, List
from sqlmodel import Field, SQLModel, Relationship
from datetime import datetime

class PortfolioBase(SQLModel):
    name: str = "My Portfolio"
    description: Optional[str] = None

class Portfolio(PortfolioBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Relationships could be added here if needed
    # transactions: List["Transaction"] = Relationship(back_populates="portfolio")

class TransactionBase(SQLModel):
    ticker: str
    quantity: float
    price_at_transaction: float
    transaction_type: str # BUY or SELL
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class Transaction(TransactionBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    portfolio_id: int = Field(foreign_key="portfolio.id")

class AssetRead(SQLModel):
    ticker: str
    total_quantity: float
    avg_price: float
    current_value: float
    pnl: float
