from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.api import deps
from app.core.db import get_session
from app.models.watchlist import Watchlist, WatchlistCreate, WatchlistRead
from app.models.user import User

router = APIRouter()

@router.get("/", response_model=List[WatchlistRead])
def read_watchlist(
    session: Session = Depends(get_session),
    current_user: User = Depends(deps.get_current_user),
    skip: int = 0,
    limit: int = 100,
) -> Any:
    """
    Retrieve user's watchlist.
    """
    statement = select(Watchlist).where(Watchlist.user_id == current_user.id).offset(skip).limit(limit)
    watchlist_items = session.exec(statement).all()
    return watchlist_items

@router.post("/", response_model=WatchlistRead)
def add_to_watchlist(
    watchlist_in: WatchlistCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    Add a ticker to the watchlist.
    """
    # Check if already exists
    statement = select(Watchlist).where(
        Watchlist.user_id == current_user.id,
        Watchlist.ticker == watchlist_in.ticker
    )
    existing = session.exec(statement).first()
    if existing:
        return existing # Idempotent

    watchlist = Watchlist.from_orm(watchlist_in, update={"user_id": current_user.id})
    session.add(watchlist)
    session.commit()
    session.refresh(watchlist)
    return watchlist

@router.delete("/{ticker}", response_model=Any)
def remove_from_watchlist(
    ticker: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    Remove a ticker from the watchlist.
    """
    statement = select(Watchlist).where(
        Watchlist.user_id == current_user.id,
        Watchlist.ticker == ticker
    )
    result = session.exec(statement).first()
    if not result:
        raise HTTPException(status_code=404, detail="Ticker not found in watchlist")
    
    session.delete(result)
    session.commit()
    return {"ok": True}
