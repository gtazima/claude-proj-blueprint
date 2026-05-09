"""
Testes da camada de serviço de tarefas (TaskService).

Cobre:
- CRUD básico (create, get, update, soft_delete)
- Conclusão com janela de undo (ADR-002)
- Lock de conclusão expirada
- Adiamento com justificativa (PRD AC-14 a AC-17)
- Listagens (today, completed_today, upcoming) com priorização correta
"""

from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4

import pytest

from app.core.config import settings
from app.models.task import Executor
from app.schemas.task import TaskCreate, TaskDeferRequest, TaskUpdate
from app.services.tasks import (
    CompletionLockedError,
    TaskNotFoundError,
    TaskService,
)


def _make_create(
    *,
    title: str = "Tarefa",
    scheduled_window_end: datetime | None = None,
    scheduled_window_start: datetime | None = None,
    financial_score: int = 0,
    executor: Executor = Executor.PRODUTOR,
    dependency_ids: list[UUID] | None = None,
) -> TaskCreate:
    return TaskCreate(
        title=title,
        executor=executor,
        scheduled_window_start=scheduled_window_start,
        scheduled_window_end=scheduled_window_end,
        financial_score=financial_score,
        dependency_ids=dependency_ids or [],
    )


# --------------------------------------------------------------------------
# CRUD básico
# --------------------------------------------------------------------------


class TestCreate:
    def test_creates_task_with_minimum_fields(self, task_service: TaskService):
        task = task_service.create(_make_create(title="Aplicar calcário"))

        assert task.id is not None
        assert task.title == "Aplicar calcário"
        assert task.deferral_count == 0
        assert task.completed_at is None
        assert task.completion_locked is False
        assert task.deleted_at is None
        assert task.version == 1

    def test_creates_with_dependency_ids_as_uuid(self, task_service: TaskService):
        dep_id = uuid4()
        task = task_service.create(_make_create(dependency_ids=[dep_id]))
        assert task.dependency_ids == [str(dep_id)]


class TestGet:
    def test_returns_existing_task(self, task_service: TaskService):
        created = task_service.create(_make_create())
        fetched = task_service.get(created.id)
        assert fetched.id == created.id

    def test_raises_when_not_found(self, task_service: TaskService):
        with pytest.raises(TaskNotFoundError):
            task_service.get(uuid4())

    def test_raises_when_soft_deleted(self, task_service: TaskService):
        task = task_service.create(_make_create())
        task_service.soft_delete(task.id)
        with pytest.raises(TaskNotFoundError):
            task_service.get(task.id)


class TestUpdate:
    def test_updates_title_and_increments_version(self, task_service: TaskService):
        task = task_service.create(_make_create(title="Original"))
        original_version = task.version

        updated = task_service.update(
            task.id, TaskUpdate(title="Atualizado")
        )
        assert updated.title == "Atualizado"
        assert updated.version == original_version + 1

    def test_partial_update_does_not_overwrite_unset_fields(
        self, task_service: TaskService
    ):
        task = task_service.create(
            _make_create(title="Original", financial_score=3)
        )
        updated = task_service.update(task.id, TaskUpdate(title="Novo título"))
        assert updated.title == "Novo título"
        assert updated.financial_score == 3


# --------------------------------------------------------------------------
# Conclusão e janela de undo
# --------------------------------------------------------------------------


class TestComplete:
    def test_marks_task_as_completed(self, task_service: TaskService):
        task = task_service.create(_make_create())
        completed = task_service.complete(task.id)

        assert completed.completed_at is not None
        assert completed.completion_locked is False

    def test_completing_already_completed_is_idempotent(
        self, task_service: TaskService
    ):
        task = task_service.create(_make_create())
        first = task_service.complete(task.id)
        second = task_service.complete(task.id)
        assert first.completed_at == second.completed_at


class TestUndoCompletion:
    def test_undoes_within_window(self, task_service: TaskService):
        task = task_service.create(_make_create())
        task_service.complete(task.id)
        undone = task_service.undo_completion(task.id)
        assert undone.completed_at is None

    def test_locked_completion_blocks_undo(self, task_service: TaskService):
        task = task_service.create(_make_create())
        completed = task_service.complete(task.id)
        # Simula expiração da janela
        completed.completion_locked = True
        task_service.session.add(completed)
        task_service.session.commit()

        with pytest.raises(CompletionLockedError):
            task_service.undo_completion(task.id)

    def test_undo_on_non_completed_task_is_noop(self, task_service: TaskService):
        task = task_service.create(_make_create())
        result = task_service.undo_completion(task.id)
        assert result.completed_at is None


class TestLockExpiredCompletions:
    def test_locks_only_expired_completions(self, task_service: TaskService):
        # Tarefa concluída agora — dentro da janela, NÃO deve ser lockada
        recent = task_service.create(_make_create(title="recente"))
        task_service.complete(recent.id)

        # Tarefa concluída há mais de 5 minutos — deve ser lockada
        old = task_service.create(_make_create(title="antiga"))
        task_service.complete(old.id)
        old.completed_at = datetime.now(timezone.utc) - timedelta(
            seconds=settings.completion_undo_window_seconds + 60
        )
        task_service.session.add(old)
        task_service.session.commit()

        locked_count = task_service.lock_expired_completions()
        assert locked_count == 1

        recent_after = task_service.get(recent.id)
        old_after = task_service.get(old.id)
        assert recent_after.completion_locked is False
        assert old_after.completion_locked is True


# --------------------------------------------------------------------------
# Adiamento (deferral)
# --------------------------------------------------------------------------


class TestDefer:
    def test_defers_with_reason_and_increments_count(self, task_service: TaskService):
        original_window = datetime.now(timezone.utc) + timedelta(days=1)
        new_window = datetime.now(timezone.utc) + timedelta(days=5)

        task = task_service.create(
            _make_create(scheduled_window_end=original_window)
        )
        deferred = task_service.defer(
            task.id,
            TaskDeferRequest(
                new_scheduled_window_start=new_window,
                reason="vai chover até sexta",
            ),
        )

        assert deferred.deferral_count == 1
        assert deferred.last_deferral_reason == "vai chover até sexta"
        # Compara timestamps tolerando perda de timezone do SQLite
        assert deferred.scheduled_window_start.replace(tzinfo=None) == new_window.replace(tzinfo=None)

    def test_repeatedly_deferred_after_three_defers(self, task_service: TaskService):
        task = task_service.create(_make_create())
        for i in range(3):
            task_service.defer(
                task.id,
                TaskDeferRequest(
                    new_scheduled_window_start=datetime.now(timezone.utc) + timedelta(days=i + 1),
                    reason=f"adiamento {i}",
                ),
            )

        final = task_service.get(task.id)
        assert final.deferral_count == 3
        assert final.repeatedly_deferred is True

    def test_cannot_defer_completed_task(self, task_service: TaskService):
        task = task_service.create(_make_create())
        task_service.complete(task.id)

        with pytest.raises(ValueError):
            task_service.defer(
                task.id,
                TaskDeferRequest(
                    new_scheduled_window_start=datetime.now(timezone.utc) + timedelta(days=1),
                    reason="qualquer",
                ),
            )


# --------------------------------------------------------------------------
# Listagens
# --------------------------------------------------------------------------


class TestListToday:
    def test_returns_only_active_tasks_with_open_window(
        self, task_service: TaskService
    ):
        now = datetime.now(timezone.utc)

        # Não-atribuída sem janela — entra
        no_window = task_service.create(_make_create(title="sem janela"))

        # Janela aberta (start no passado) — entra
        active = task_service.create(
            _make_create(
                title="ativa",
                scheduled_window_start=now - timedelta(hours=1),
                scheduled_window_end=now + timedelta(days=1),
            )
        )

        # Janela futura (start daqui a uma semana) — NÃO entra na lista de hoje
        future = task_service.create(
            _make_create(
                title="futura",
                scheduled_window_start=now + timedelta(days=7),
                scheduled_window_end=now + timedelta(days=10),
            )
        )

        # Concluída — NÃO entra
        completed = task_service.create(_make_create(title="concluída"))
        task_service.complete(completed.id)

        # Soft-deleted — NÃO entra
        deleted = task_service.create(_make_create(title="deletada"))
        task_service.soft_delete(deleted.id)

        result = task_service.list_today()
        titles = [t.title for t in result]

        assert "ativa" in titles
        assert "sem janela" in titles
        assert "futura" not in titles
        assert "concluída" not in titles
        assert "deletada" not in titles

    def test_orders_by_priority_score(self, task_service: TaskService):
        now = datetime.now(timezone.utc)

        # Critical: janela fechada (timing_score = 100)
        critical = task_service.create(
            _make_create(
                title="critical",
                scheduled_window_end=now - timedelta(hours=1),
            )
        )

        # Soon: janela em 1 dia (timing_score = 90)
        soon = task_service.create(
            _make_create(
                title="soon",
                scheduled_window_end=now + timedelta(hours=12),
            )
        )

        # Plain: sem janela
        plain = task_service.create(_make_create(title="plain"))

        result = task_service.list_today()
        titles = [t.title for t in result]
        assert titles[0] == "critical"
        assert titles[1] == "soon"
        assert titles[-1] == "plain"


class TestListUpcoming:
    def test_returns_tasks_within_window(self, task_service: TaskService):
        now = datetime.now(timezone.utc)

        in_3_days = task_service.create(
            _make_create(
                title="3 dias",
                scheduled_window_start=now + timedelta(days=3),
            )
        )
        in_30_days = task_service.create(
            _make_create(
                title="30 dias",
                scheduled_window_start=now + timedelta(days=30),
            )
        )
        no_window = task_service.create(_make_create(title="sem janela"))

        result_7d = task_service.list_upcoming(days=7)
        titles_7d = [t.title for t in result_7d]
        assert "3 dias" in titles_7d
        assert "30 dias" not in titles_7d
        assert "sem janela" not in titles_7d  # sem start não entra em upcoming

        result_60d = task_service.list_upcoming(days=60)
        titles_60d = [t.title for t in result_60d]
        assert "3 dias" in titles_60d
        assert "30 dias" in titles_60d
