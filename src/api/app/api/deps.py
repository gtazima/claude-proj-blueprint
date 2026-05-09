"""
Dependências comuns para as rotas FastAPI.
"""

from collections.abc import Generator

from fastapi import Depends
from sqlmodel import Session

from app.db.session import get_session
from app.services.tasks import TaskService


def get_task_service(session: Session = Depends(get_session)) -> Generator[TaskService, None, None]:
    yield TaskService(session)
