from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import select
from app.api.deps import SessionDep, CurrentUser
from app.models.user import UserSettings, UserSettingsUpdate, RiskLevel, ComplexityLevel

router = APIRouter()

@router.get("/", response_model=UserSettings)
def get_settings(session: SessionDep, current_user: CurrentUser) -> UserSettings:
    """
    Get current user settings.
    If settings do not exist for the user, create default settings.
    """
    statement = select(UserSettings).where(UserSettings.user_id == current_user.id)
    settings = session.exec(statement).first()
    
    if not settings:
        # Create default settings
        settings = UserSettings(user_id=current_user.id)
        session.add(settings)
        session.commit()
        session.refresh(settings)
        
    return settings

@router.patch("/", response_model=UserSettings)
def update_settings(
    settings_in: UserSettingsUpdate,
    session: SessionDep,
    current_user: CurrentUser
) -> UserSettings:
    """
    Update user settings.
    """
    statement = select(UserSettings).where(UserSettings.user_id == current_user.id)
    settings = session.exec(statement).first()
    
    if not settings:
        settings = UserSettings(user_id=current_user.id)
        session.add(settings)
        session.commit()
        session.refresh(settings)
    
    settings_data = settings_in.model_dump(exclude_unset=True)
    settings.sqlmodel_update(settings_data)
    
    session.add(settings)
    session.commit()
    session.refresh(settings)
    
    return settings
