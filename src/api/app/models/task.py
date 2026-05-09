from datetime import datetime, timezone
from enum import Enum
from typing import Optional
from uuid import UUID, uuid4

from sqlalchemy import Column
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.types import JSON
from sqlmodel import Field, SQLModel


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Executor(str, Enum):
    PRODUTOR = "produtor"
    PAI = "pai"
    FUNCIONARIO = "funcionario"
    NAO_ATRIBUIDO = "nao_atribuido"


class Task(SQLModel, table=True):
    """
    Modelo de tarefa segundo ADR-001 (algoritmo de priorização) e ADR-002 (sync offline).

    Pesos do score de prioridade (ADR-001):
        score = (timing × 1000) + (dependency × 100) + (financial × 10) + recency
    """

    id: UUID = Field(default_factory=uuid4, primary_key=True)

    title: str = Field(min_length=1, max_length=200, index=True)
    description: str | None = Field(default=None, max_length=2000)

    executor: Executor = Field(default=Executor.NAO_ATRIBUIDO, index=True)

    scheduled_window_start: datetime | None = Field(default=None, index=True)
    scheduled_window_end: datetime | None = Field(default=None, index=True)

    financial_score: int = Field(default=0, ge=0, le=5)

    dependency_ids: list[str] = Field(default_factory=list, sa_column=Column(JSON))
    deferral_count: int = Field(default=0, ge=0)
    last_deferral_reason: str | None = Field(default=None, max_length=500)

    completed_at: datetime | None = Field(default=None)
    completion_locked: bool = Field(default=False)

    created_at: datetime = Field(default_factory=utcnow, nullable=False)
    updated_at: datetime = Field(default_factory=utcnow, nullable=False)
    deleted_at: datetime | None = Field(default=None)

    device_id: str | None = Field(default=None, max_length=64)
    version: int = Field(default=1, ge=1)

    @property
    def repeatedly_deferred(self) -> bool:
        return self.deferral_count >= 3
