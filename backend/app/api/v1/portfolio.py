from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from typing import List, Any

from app.core.db import get_session
from app.models.financial import Portfolio, PortfolioBase, Transaction, AssetRead
from app.models.user import User

router = APIRouter()

@router.post("/", response_model=Portfolio)
def create_portfolio(
    portfolio: PortfolioBase,
    session: Session = Depends(get_session)
) -> Any:
    """
    Create a new portfolio.
    """
    db_portfolio = Portfolio.from_orm(portfolio)
    session.add(db_portfolio)
    session.commit()
    session.refresh(db_portfolio)
    return db_portfolio

@router.get("/", response_model=List[Portfolio])
def read_portfolios(
    skip: int = 0,
    limit: int = 100,
    session: Session = Depends(get_session)
) -> Any:
    """
    Retrieve portfolios.
    """
    statement = select(Portfolio).offset(skip).limit(limit)
    portfolios = session.exec(statement).all()
    return portfolios
