from typing import Optional
from sqlmodel import Field, SQLModel
from datetime import datetime

class WatchlistBase(SQLModel):
    ticker: str = Field(index=True)
    company_name: Optional[str] = None
    sector: Optional[str] = None

class Watchlist(WatchlistBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id")
    added_at: datetime = Field(default_factory=datetime.utcnow)

class WatchlistCreate(WatchlistBase):
    pass

class WatchlistRead(WatchlistBase):
    id: int
    added_at: datetime
