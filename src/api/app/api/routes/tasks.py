"""
Endpoints HTTP do módulo Agenda.

A camada HTTP é fina propositalmente — apenas traduz HTTP em chamadas ao
TaskService. Toda lógica de negócio mora no serviço.
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status

from app.api.deps import get_task_service
from app.core.config import settings
from app.schemas.task import (
    TaskCreate,
    TaskDeferRequest,
    TaskRead,
    TaskUpdate,
    TaskWithPriority,
)
from app.services.prioritization import is_within_undo_window
from app.services.tasks import (
    CompletionLockedError,
    TaskNotFoundError,
    TaskService,
)

router = APIRouter(prefix="/tasks", tags=["tasks"])


def _to_read(task) -> TaskRead:
    return TaskRead(
        id=task.id,
        title=task.title,
        description=task.description,
        executor=task.executor,
        scheduled_window_start=task.scheduled_window_start,
        scheduled_window_end=task.scheduled_window_end,
        financial_score=task.financial_score,
        dependency_ids=[UUID(d) for d in task.dependency_ids],
        deferral_count=task.deferral_count,
        last_deferral_reason=task.last_deferral_reason,
        completed_at=task.completed_at,
        completion_locked=task.completion_locked,
        repeatedly_deferred=task.repeatedly_deferred,
        created_at=task.created_at,
        updated_at=task.updated_at,
        is_pending_review=task.is_pending_review,
        duration_minutes=task.duration_minutes,
    )


def _to_with_priority(task, *, score: int) -> TaskWithPriority:
    return TaskWithPriority(
        **_to_read(task).model_dump(),
        priority_score=score,
        can_undo_completion=is_within_undo_window(
            task,
            window_seconds=settings.completion_undo_window_seconds,
        ),
    )


@router.post("", response_model=TaskRead, status_code=status.HTTP_201_CREATED)
def create_task(
    payload: TaskCreate,
    service: TaskService = Depends(get_task_service),
) -> TaskRead:
    task = service.create(payload)
    return _to_read(task)


@router.get("/today", response_model=list[TaskWithPriority])
def list_today(
    service: TaskService = Depends(get_task_service),
) -> list[TaskWithPriority]:
    tasks = service.list_today()
    scores = service.compute_priority_for(tasks)
    return [_to_with_priority(t, score=scores[t.id]) for t in tasks]


@router.get("/completed-today", response_model=list[TaskRead])
def list_completed_today(
    service: TaskService = Depends(get_task_service),
) -> list[TaskRead]:
    return [_to_read(t) for t in service.list_completed_today()]


@router.get("/upcoming", response_model=list[TaskWithPriority])
def list_upcoming(
    days: int = Query(default=7, ge=1, le=365),
    service: TaskService = Depends(get_task_service),
) -> list[TaskWithPriority]:
    tasks = service.list_upcoming(days=days)
    scores = service.compute_priority_for(tasks)
    return [_to_with_priority(t, score=scores[t.id]) for t in tasks]


@router.get("/pending-review", response_model=list[TaskRead])
def list_pending_review(
    service: TaskService = Depends(get_task_service),
) -> list[TaskRead]:
    return [_to_read(t) for t in service.list_pending_review()]


@router.get("/{task_id}", response_model=TaskRead)
def get_task(
    task_id: UUID,
    service: TaskService = Depends(get_task_service),
) -> TaskRead:
    try:
        task = service.get(task_id)
    except TaskNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    return _to_read(task)


@router.patch("/{task_id}", response_model=TaskRead)
def update_task(
    task_id: UUID,
    payload: TaskUpdate,
    service: TaskService = Depends(get_task_service),
) -> TaskRead:
    try:
        task = service.update(task_id, payload)
    except TaskNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    return _to_read(task)


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(
    task_id: UUID,
    service: TaskService = Depends(get_task_service),
) -> Response:
    try:
        service.soft_delete(task_id)
    except TaskNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{task_id}/complete", response_model=TaskRead)
def complete_task(
    task_id: UUID,
    service: TaskService = Depends(get_task_service),
) -> TaskRead:
    try:
        task = service.complete(task_id)
    except TaskNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    return _to_read(task)


@router.post("/{task_id}/uncomplete", response_model=TaskRead)
def uncomplete_task(
    task_id: UUID,
    service: TaskService = Depends(get_task_service),
) -> TaskRead:
    try:
        task = service.undo_completion(task_id)
    except TaskNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except CompletionLockedError as e:
        raise HTTPException(status_code=409, detail=str(e)) from e
    return _to_read(task)


@router.post("/{task_id}/defer", response_model=TaskRead)
def defer_task(
    task_id: UUID,
    payload: TaskDeferRequest,
    service: TaskService = Depends(get_task_service),
) -> TaskRead:
    try:
        task = service.defer(task_id, payload)
    except TaskNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return _to_read(task)


@router.post("/{task_id}/confirm-review", response_model=TaskRead)
def confirm_review(
    task_id: UUID,
    service: TaskService = Depends(get_task_service),
) -> TaskRead:
    try:
        task = service.confirm_review(task_id)
    except TaskNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    return _to_read(task)


@router.post("/{task_id}/discard-review", status_code=status.HTTP_204_NO_CONTENT)
def discard_review(
    task_id: UUID,
    service: TaskService = Depends(get_task_service),
) -> Response:
    try:
        service.discard_review(task_id)
    except TaskNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    return Response(status_code=status.HTTP_204_NO_CONTENT)
