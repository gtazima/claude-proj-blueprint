"""
Schemas Pydantic para entrada e saída da API de tarefas.

Separados dos modelos SQLModel para distinguir o que é persistido (todos os
campos) do que é exposto na API (campos validados, computados, restritos).
"""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class TaskCreate(BaseModel):
    """Payload para criar uma tarefa."""

    title: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    executor: str = Field(default="nao_atribuido", max_length=60)
    scheduled_window_start: datetime | None = None
    scheduled_window_end: datetime | None = None
    financial_score: int = Field(default=0, ge=0, le=5)
    dependency_ids: list[UUID] = Field(default_factory=list)
    duration_minutes: int | None = Field(default=None, ge=1)
    activity_type_slug: str | None = Field(default=None, max_length=60)
    culture_slug: str | None = Field(default=None, max_length=60)
    ambiente_slug: str | None = Field(default=None, max_length=60)
    lote_slug: str | None = Field(default=None, max_length=60)


class TaskUpdate(BaseModel):
    """Payload para atualizar campos editáveis de uma tarefa."""

    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    executor: str | None = Field(default=None, max_length=60)
    scheduled_window_start: datetime | None = None
    scheduled_window_end: datetime | None = None
    financial_score: int | None = Field(default=None, ge=0, le=5)
    dependency_ids: list[UUID] | None = None
    duration_minutes: int | None = Field(default=None, ge=1)
    activity_type_slug: str | None = None
    culture_slug: str | None = None
    ambiente_slug: str | None = None
    lote_slug: str | None = None


class TaskDeferRequest(BaseModel):
    """Payload para adiar uma tarefa com justificativa."""

    new_scheduled_window_start: datetime
    new_scheduled_window_end: datetime | None = None
    reason: str = Field(min_length=1, max_length=500)


class TaskRead(BaseModel):
    """Representação de uma tarefa retornada pela API."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    title: str
    description: str | None
    executor: str
    scheduled_window_start: datetime | None
    scheduled_window_end: datetime | None
    financial_score: int
    dependency_ids: list[UUID]
    deferral_count: int
    last_deferral_reason: str | None
    completed_at: datetime | None
    repeatedly_deferred: bool
    created_at: datetime
    updated_at: datetime
    is_pending_review: bool
    duration_minutes: int | None
    activity_type_slug: str | None
    culture_slug: str | None
    ambiente_slug: str | None
    lote_slug: str | None


class TaskWithPriority(TaskRead):
    """Tarefa enriquecida com o score de priorização computado."""

    priority_score: int


class TaskCompletePayload(BaseModel):
    """Payload opcional ao concluir tarefa — observação para o caderno de campo."""

    observation: str | None = Field(default=None, max_length=2000)
