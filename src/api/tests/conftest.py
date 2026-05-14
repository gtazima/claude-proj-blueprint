"""
Fixtures pytest compartilhadas — banco SQLite em memória, cliente HTTP de teste.
"""

from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine

from app.api.deps import get_current_user, get_task_service
from app.db.session import get_session
from app.services.tasks import TaskService
from main import app


@pytest.fixture(name="session")
def session_fixture() -> Generator[Session, None, None]:
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        yield session


@pytest.fixture(name="task_service")
def task_service_fixture(session: Session) -> TaskService:
    return TaskService(session)


@pytest.fixture(name="client")
def client_fixture(session: Session) -> Generator[TestClient, None, None]:
    def get_session_override():
        yield session

    def get_task_service_override():
        yield TaskService(session)

    app.dependency_overrides[get_session] = get_session_override
    app.dependency_overrides[get_task_service] = get_task_service_override
    app.dependency_overrides[get_current_user] = lambda: {"sub": "test-user"}

    with TestClient(app) as client:
        yield client

    app.dependency_overrides.clear()
