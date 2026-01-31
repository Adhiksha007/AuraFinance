from datetime import timedelta
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlmodel import Session, select

from app.core import security
from app.core.config import settings
from app.core.db import get_session
from app.models.user import User, UserCreate, UserRead, Token

router = APIRouter()

@router.post("/login", response_model=Token)
def login_access_token(form_data: OAuth2PasswordRequestForm = Depends(), session: Session = Depends(get_session)) -> Any:
    """
    OAuth2 compatible token login, get an access token for future requests
    """
    # 1. Get user by email or username
    # form_data.username contains the input string (which could be email or username)
    from sqlmodel import or_
    statement = select(User).where(or_(User.email == form_data.username, User.username == form_data.username))
    user = session.exec(statement).first()
    
    # 2. Authenticate
    if not user or not security.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect email/username or password")
    
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
        
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    return {
        "access_token": security.create_access_token(user.id, expires_delta=access_token_expires),
        "token_type": "bearer",
    }

@router.post("/register", response_model=UserRead)
def register_user(user_in: UserCreate, session: Session = Depends(get_session)) -> Any:
    """
    Create new user without the need to be logged in
    """
    from sqlmodel import or_
    # 1. Check if user exists (email or username)
    statement = select(User).where(or_(User.email == user_in.email, User.username == user_in.username))
    item = session.exec(statement).first()
    if item:
        raise HTTPException(
            status_code=400,
            detail="A user with this email or username already exists.",
        )
    
    # 2. Create user
    user_data = user_in.model_dump()
    password = user_data.pop("password")
    user_data["hashed_password"] = security.get_password_hash(password)
    user = User(**user_data)
    session.add(user)
    session.commit()
    session.refresh(user)
    return user
