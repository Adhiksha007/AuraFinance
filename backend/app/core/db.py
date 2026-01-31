from sqlmodel import SQLModel, create_engine

from app.core.config import settings

engine = create_engine(settings.DATABASE_URI, connect_args={"check_same_thread": False}) # check_same_thread for sqlite

def create_db_and_tables():
    SQLModel.metadata.create_all(engine)

def get_session():
    from sqlmodel import Session
    with Session(engine) as session:
        yield session
