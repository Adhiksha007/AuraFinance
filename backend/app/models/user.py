from typing import Optional
from sqlmodel import Field, SQLModel
from datetime import datetime

class UserBase(SQLModel):
    full_name: Optional[str] = None
    email: str = Field(unique=True, index=True)
    username: str = Field(unique=True, index=True)
    phone_number: Optional[str] = None
    profile_image: Optional[str] = None
    is_active: bool = True
    is_superuser: bool = False
    is_2fa_enabled: bool = Field(default=False)
    is_phone_verified: bool = Field(default=False)
    is_email_verified: bool = Field(default=False)

class User(UserBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    hashed_password: str

class UserCreate(UserBase):
    password: str

class UserRead(UserBase):
    id: int

class UserUpdate(SQLModel):
    email: Optional[str] = None
    username: Optional[str] = None
    full_name: Optional[str] = None
    phone_number: Optional[str] = None
    profile_image: Optional[str] = None
    password: Optional[str] = None
    is_active: Optional[bool] = None
    is_2fa_enabled: Optional[bool] = None
    is_phone_verified: Optional[bool] = None
    is_email_verified: Optional[bool] = None

class Token(SQLModel):
    access_token: str
    token_type: str

class TokenData(SQLModel):
    email: Optional[str] = None
    sub: Optional[str] = None

from enum import Enum

class RiskLevel(str, Enum):
    CONSERVATIVE = "Conservative"
    MODERATE = "Moderate"
    AGGRESSIVE = "Aggressive"

class ComplexityLevel(str, Enum):
    BEGINNER = "Beginner"
    EXPERT = "Expert"

class UserSettings(SQLModel, table=True):
    __tablename__ = "user_settings"
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id")
    risk_level: RiskLevel = Field(default=RiskLevel.MODERATE)
    risk_score: int = Field(default=50)
    theme: str = Field(default="light")
    notifications_enabled: bool = Field(default=True)
    complexity_level: ComplexityLevel = Field(default=ComplexityLevel.BEGINNER)

class UserSettingsUpdate(SQLModel):
    risk_level: Optional[RiskLevel] = None
    risk_score: Optional[int] = None
    theme: Optional[str] = None
    notifications_enabled: Optional[bool] = None
    complexity_level: Optional[ComplexityLevel] = None
