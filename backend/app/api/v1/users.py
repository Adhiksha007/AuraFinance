from typing import Any
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import select
from app.api.deps import SessionDep, CurrentUser
from app.models.user import User, UserRead, UserUpdate

router = APIRouter()

@router.get("/me", response_model=UserRead)
def read_user_me(current_user: CurrentUser) -> Any:
    """
    Get current user.
    """
    return current_user

@router.patch("/me", response_model=UserRead)
def update_user_me(
    *,
    session: SessionDep,
    user_in: UserUpdate,
    current_user: CurrentUser,
) -> Any:
    """
    Update own user.
    """
    user_data = user_in.model_dump(exclude_unset=True)
    if user_data.get("password"):
        # Password updates should probably go through a dedicated endpoint or handle hashing here
        # For now, suppressing password updates via this endpoint to use auth/reset-password flow
        # or implement hashing logic if needed. keeping it safe.
        del user_data["password"]
        
    current_user.sqlmodel_update(user_data)
    session.add(current_user)
    session.commit()
    session.refresh(current_user)
    return current_user
