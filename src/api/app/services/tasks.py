"""
Camada de serviço do módulo Agenda.

Concentra a lógica de negócio das tarefas (criação, edição, conclusão com
janela de undo, adiamento com justificativa, soft delete). A camada HTTP
em `app/api/routes/tasks.py` apenas traduz HTTP em chamadas a este serviço.
"""

from collections.abc import Sequence
from datetime import datetime, timezone
from uuid import UUID

from sqlmodel import Session, select

from app.core.config import settings
from app.models.task import Task
from app.schemas.task import TaskCreate, TaskDeferRequest, TaskUpdate
from app.services.prioritization import (
    calculate_priority_score,
    is_within_undo_window,
    sort_by_priority,
)


class TaskNotFoundError(Exception):
    """Tarefa não existe ou está soft-deleted."""


class CompletionLockedError(Exception):
    """Tentativa de undo após a janela de 5 minutos — operação bloqueada."""


class TaskService:
    """
    Serviço de tarefas.

    Recebe a sessão SQLModel via injeção — facilita teste com SQLite em memória
    e permite trocar para PostgreSQL sem alterar o serviço.
    """

    def __init__(self, session: Session):
        self.session = session

    # ------------------------------------------------------------------
    # CRUD básico
    # ------------------------------------------------------------------

    def create(self, payload: TaskCreate, *, device_id: str | None = None) -> Task:
        task = Task(
            title=payload.title,
            description=payload.description,
            executor=payload.executor,
            scheduled_window_start=payload.scheduled_window_start,
            scheduled_window_end=payload.scheduled_window_end,
            financial_score=payload.financial_score,
            dependency_ids=[str(dep_id) for dep_id in payload.dependency_ids],
            device_id=device_id,
        )
        self.session.add(task)
        self.session.commit()
        self.session.refresh(task)
        return task

    def get(self, task_id: UUID) -> Task:
        task = self.session.get(Task, task_id)
        if task is None or task.deleted_at is not None:
            raise TaskNotFoundError(f"Task {task_id} not found")
        return task

    def update(
        self,
        task_id: UUID,
        payload: TaskUpdate,
        *,
        device_id: str | None = None,
    ) -> Task:
        task = self.get(task_id)

        update_data = payload.model_dump(exclude_unset=True)
        if "dependency_ids" in update_data and update_data["dependency_ids"] is not None:
            update_data["dependency_ids"] = [str(d) for d in update_data["dependency_ids"]]

        for field, value in update_data.items():
            setattr(task, field, value)

        self._touch(task, device_id=device_id)
        self.session.add(task)
        self.session.commit()
        self.session.refresh(task)
        return task

    def soft_delete(self, task_id: UUID, *, device_id: str | None = None) -> None:
        task = self.get(task_id)
        task.deleted_at = _utcnow()
        self._touch(task, device_id=device_id)
        self.session.add(task)
        self.session.commit()

    # ------------------------------------------------------------------
    # Conclusão com janela de undo (ADR-002)
    # ------------------------------------------------------------------

    def complete(self, task_id: UUID, *, device_id: str | None = None) -> Task:
        task = self.get(task_id)

        if task.completed_at is not None:
            return task

        task.completed_at = _utcnow()
        self._touch(task, device_id=device_id)
        self.session.add(task)
        self.session.commit()
        self.session.refresh(task)
        return task

    def undo_completion(self, task_id: UUID, *, device_id: str | None = None) -> Task:
        """
        Desfaz a conclusão se ainda dentro da janela de undo.

        ADR-002: janela de 5 minutos (configurável). Após esse prazo, a
        conclusão fica `completion_locked = True` e este método falha.
        Reabrir uma tarefa locked é operação distinta (ainda não implementada).
        """
        task = self.get(task_id)

        if task.completed_at is None:
            return task

        if not is_within_undo_window(
            task,
            window_seconds=settings.completion_undo_window_seconds,
        ):
            raise CompletionLockedError(
                f"Task {task_id} completion is locked (window expired)"
            )

        task.completed_at = None
        self._touch(task, device_id=device_id)
        self.session.add(task)
        self.session.commit()
        self.session.refresh(task)
        return task

    def lock_expired_completions(self) -> int:
        """
        Job em background: aplica `completion_locked = True` em tarefas
        cuja janela de undo expirou. Retorna o número de tarefas bloqueadas.

        Será chamado periodicamente (job agendado) — ver ADR-010.
        """
        now = _utcnow()
        statement = select(Task).where(
            Task.completed_at.is_not(None),
            Task.completion_locked.is_(False),
            Task.deleted_at.is_(None),
        )
        candidates = self.session.exec(statement).all()

        locked = 0
        for task in candidates:
            if not is_within_undo_window(
                task,
                window_seconds=settings.completion_undo_window_seconds,
                now=now,
            ):
                task.completion_locked = True
                self.session.add(task)
                locked += 1

        if locked:
            self.session.commit()
        return locked

    # ------------------------------------------------------------------
    # Adiamento (ADR-001 + PRD AC-14 a AC-17)
    # ------------------------------------------------------------------

    def defer(
        self,
        task_id: UUID,
        payload: TaskDeferRequest,
        *,
        device_id: str | None = None,
    ) -> Task:
        task = self.get(task_id)

        if task.completed_at is not None:
            raise ValueError("Cannot defer a completed task")

        task.scheduled_window_start = payload.new_scheduled_window_start
        task.scheduled_window_end = payload.new_scheduled_window_end
        task.last_deferral_reason = payload.reason
        task.deferral_count += 1

        self._touch(task, device_id=device_id)
        self.session.add(task)
        self.session.commit()
        self.session.refresh(task)
        return task

    # ------------------------------------------------------------------
    # Listagem priorizada
    # ------------------------------------------------------------------

    def list_today(self, *, now: datetime | None = None) -> list[Task]:
        """
        Tarefas que devem aparecer na ordem do dia hoje:
        - não concluídas (ou concluídas hoje, mostradas em "concluído hoje")
        - não soft-deleted
        - com janela de execução já aberta OU sem janela
        """
        now = now or _utcnow()
        statement = select(Task).where(Task.deleted_at.is_(None))
        tasks = list(self.session.exec(statement).all())

        active = [
            t
            for t in tasks
            if t.completed_at is None
            and not t.is_pending_review
            and (
                t.scheduled_window_start is None
                or _ensure_aware(t.scheduled_window_start) <= now
            )
        ]
        return sort_by_priority(active, now=now)

    def list_completed_today(self, *, now: datetime | None = None) -> list[Task]:
        now = now or _utcnow()
        start_of_day = now.replace(hour=0, minute=0, second=0, microsecond=0)
        statement = (
            select(Task)
            .where(Task.deleted_at.is_(None))
            .where(Task.completed_at.is_not(None))
        )
        tasks = list(self.session.exec(statement).all())
        return [t for t in tasks if _ensure_aware(t.completed_at) >= start_of_day]

    def list_pending_review(self) -> list[Task]:
        stmt = (
            select(Task)
            .where(Task.deleted_at.is_(None))
            .where(Task.is_pending_review == True)  # noqa: E712
        )
        return list(self.session.exec(stmt).all())

    def confirm_review(self, task_id: UUID) -> Task:
        task = self.get(task_id)
        task.is_pending_review = False
        self._touch(task, device_id=None)
        self.session.add(task)
        self.session.commit()
        self.session.refresh(task)
        return task

    def discard_review(self, task_id: UUID) -> None:
        """Soft delete preservando calendar_event_id para evitar reimportação."""
        task = self.get(task_id)
        task.deleted_at = _utcnow()
        self._touch(task, device_id=None)
        self.session.add(task)
        self.session.commit()

    def list_upcoming(self, days: int, *, now: datetime | None = None) -> list[Task]:
        """Agenda futura: tarefas com janela começando dentro dos próximos N dias."""
        now = now or _utcnow()
        statement = select(Task).where(Task.deleted_at.is_(None))
        tasks = list(self.session.exec(statement).all())

        upcoming = []
        for t in tasks:
            if t.completed_at is not None or t.scheduled_window_start is None:
                continue
            start = _ensure_aware(t.scheduled_window_start)
            days_ahead = (start - now).total_seconds() / 86400
            if 0 <= days_ahead <= days:
                upcoming.append(t)

        return sort_by_priority(upcoming, now=now)

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _touch(self, task: Task, *, device_id: str | None) -> None:
        """Atualiza updated_at, version e device_id da última modificação."""
        task.updated_at = _utcnow()
        task.version += 1
        if device_id is not None:
            task.device_id = device_id

    def compute_priority_for(
        self,
        tasks: Sequence[Task],
        *,
        now: datetime | None = None,
    ) -> dict[UUID, int]:
        """
        Calcula score de cada tarefa retornando um mapa id → score.

        Usado pela camada HTTP para serializar `priority_score` em `TaskWithPriority`.
        """
        now = now or _utcnow()
        dependents_count: dict[str, int] = {}
        for t in tasks:
            for dep_id in t.dependency_ids:
                dependents_count[dep_id] = dependents_count.get(dep_id, 0) + 1
        return {
            t.id: calculate_priority_score(
                t,
                dependents_count=dependents_count.get(str(t.id), 0),
                now=now,
            )
            for t in tasks
        }


# --------------------------------------------------------------------------
# Helpers globais (não pertencem ao serviço)
# --------------------------------------------------------------------------


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _ensure_aware(dt: datetime) -> datetime:
    """SQLite armazena datetime sem tzinfo; tratamos como UTC."""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt
