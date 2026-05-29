"""
Endpoints HTTP do módulo Agenda.

A camada HTTP é fina propositalmente — apenas traduz HTTP em chamadas ao
TaskService. Toda lógica de negócio mora no serviço.
"""

from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Response, status

from app.api.deps import get_chain_service, get_task_service
from app.schemas.task import (
    ChainInfo,
    TaskCompletePayload,
    TaskCreate,
    TaskDeferRequest,
    TaskLinkPayload,
    TaskRead,
    TaskUpdate,
    TaskWithPriority,
)
from app.services.chain import ChainService
from app.services.google_sync import push_task_now
from app.services.tasks import (
    TaskNotFoundError,
    TaskService,
)



router = APIRouter(prefix="/tasks", tags=["tasks"])


def _to_read(
    task,
    *,
    chain_svc: ChainService | None = None,
    precomputed_chains: list[dict] | None = None,
) -> TaskRead:
    chains = []
    if precomputed_chains is not None:
        # Dados já carregados em bulk — evita N+1
        for info in precomputed_chains:
            chains.append(ChainInfo(
                chain_id=info["chain_id"],
                position=info["position"],
                total=info["total"],
                task_ids=info["task_ids"],
            ))
    elif chain_svc:
        for info in chain_svc.chain_infos_for_task(task.id):
            chains.append(ChainInfo(
                chain_id=info["chain_id"],
                position=info["position"],
                total=info["total"],
                task_ids=info["task_ids"],
            ))
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
        repeatedly_deferred=task.repeatedly_deferred,
        created_at=task.created_at,
        updated_at=task.updated_at,
        duration_minutes=task.duration_minutes,
        activity_type_slug=task.activity_type_slug,
        culture_slug=task.culture_slug,
        ambiente_slug=task.ambiente_slug,
        lote_slug=task.lote_slug,
        chains=chains,
    )


def _to_with_priority(
    task,
    *,
    score: int,
    chain_svc: ChainService | None = None,
    precomputed_chains: list[dict] | None = None,
) -> TaskWithPriority:
    return TaskWithPriority(
        **_to_read(task, chain_svc=chain_svc, precomputed_chains=precomputed_chains).model_dump(),
        priority_score=score,
    )


@router.post("", response_model=TaskRead, status_code=status.HTTP_201_CREATED)
def create_task(
    payload: TaskCreate,
    background_tasks: BackgroundTasks,
    service: TaskService = Depends(get_task_service),
    chain_svc: ChainService = Depends(get_chain_service),
) -> TaskRead:
    task = service.create(payload)
    background_tasks.add_task(push_task_now, task.id)
    return _to_read(task, chain_svc=chain_svc)


@router.get("/today", response_model=list[TaskWithPriority])
def list_today(
    service: TaskService = Depends(get_task_service),
    chain_svc: ChainService = Depends(get_chain_service),
) -> list[TaskWithPriority]:
    tasks = service.list_today()
    scores = service.compute_priority_for(tasks)
    chains_bulk = chain_svc.chain_infos_bulk([t.id for t in tasks])
    return [
        _to_with_priority(t, score=scores[t.id], precomputed_chains=chains_bulk.get(t.id, []))
        for t in tasks
    ]


@router.get("/completed-today", response_model=list[TaskRead])
def list_completed_today(
    service: TaskService = Depends(get_task_service),
    chain_svc: ChainService = Depends(get_chain_service),
) -> list[TaskRead]:
    tasks = service.list_completed_today()
    chains_bulk = chain_svc.chain_infos_bulk([t.id for t in tasks])
    return [_to_read(t, precomputed_chains=chains_bulk.get(t.id, [])) for t in tasks]


@router.get("/upcoming", response_model=list[TaskWithPriority])
def list_upcoming(
    days: int = Query(default=7, ge=1, le=365),
    service: TaskService = Depends(get_task_service),
    chain_svc: ChainService = Depends(get_chain_service),
) -> list[TaskWithPriority]:
    tasks = service.list_upcoming(days=days)
    scores = service.compute_priority_for(tasks)
    chains_bulk = chain_svc.chain_infos_bulk([t.id for t in tasks])
    return [
        _to_with_priority(t, score=scores[t.id], precomputed_chains=chains_bulk.get(t.id, []))
        for t in tasks
    ]


@router.get("/{task_id}", response_model=TaskRead)
def get_task(
    task_id: UUID,
    service: TaskService = Depends(get_task_service),
    chain_svc: ChainService = Depends(get_chain_service),
) -> TaskRead:
    try:
        task = service.get(task_id)
    except TaskNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    return _to_read(task, chain_svc=chain_svc)


@router.patch("/{task_id}", response_model=TaskRead)
def update_task(
    task_id: UUID,
    payload: TaskUpdate,
    background_tasks: BackgroundTasks,
    service: TaskService = Depends(get_task_service),
    chain_svc: ChainService = Depends(get_chain_service),
) -> TaskRead:
    try:
        task = service.update(task_id, payload)
    except TaskNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    background_tasks.add_task(push_task_now, task.id)
    return _to_read(task, chain_svc=chain_svc)


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(
    task_id: UUID,
    background_tasks: BackgroundTasks,
    service: TaskService = Depends(get_task_service),
) -> Response:
    try:
        service.soft_delete(task_id)
    except TaskNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    background_tasks.add_task(push_task_now, task_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{task_id}/complete", response_model=TaskRead)
def complete_task(
    task_id: UUID,
    background_tasks: BackgroundTasks,
    service: TaskService = Depends(get_task_service),
    payload: TaskCompletePayload | None = None,
) -> TaskRead:
    try:
        obs = payload.observation if payload else None
        task = service.complete(task_id, observation=obs)
    except TaskNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    background_tasks.add_task(push_task_now, task.id)
    return _to_read(task)


@router.post("/{task_id}/uncomplete", response_model=TaskRead)
def uncomplete_task(
    task_id: UUID,
    background_tasks: BackgroundTasks,
    service: TaskService = Depends(get_task_service),
) -> TaskRead:
    try:
        task = service.undo_completion(task_id)
    except TaskNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    background_tasks.add_task(push_task_now, task.id)
    return _to_read(task)


@router.post("/{task_id}/restore", response_model=TaskRead)
def restore_task(
    task_id: UUID,
    background_tasks: BackgroundTasks,
    service: TaskService = Depends(get_task_service),
) -> TaskRead:
    try:
        task = service.restore(task_id)
    except TaskNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    background_tasks.add_task(push_task_now, task.id)
    return _to_read(task)


@router.post("/{task_id}/defer", response_model=TaskRead)
def defer_task(
    task_id: UUID,
    payload: TaskDeferRequest,
    background_tasks: BackgroundTasks,
    service: TaskService = Depends(get_task_service),
) -> TaskRead:
    try:
        task = service.defer(task_id, payload)
    except TaskNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    background_tasks.add_task(push_task_now, task.id)
    return _to_read(task)


# ------------------------------------------------------------------
# Encadeamento de tarefas
# ------------------------------------------------------------------

@router.get("/chain-tails", response_model=list[TaskRead])
def list_chain_tails(
    chain_svc: ChainService = Depends(get_chain_service),
) -> list[TaskRead]:
    """Retorna a última tarefa de cada cadeia existente (usado no picker do modal)."""
    tails = chain_svc.get_chain_tails()
    return [_to_read(t, chain_svc=chain_svc) for t in tails]


@router.get("/chain/{chain_id}/tasks", response_model=list[TaskRead])
def list_chain_tasks(
    chain_id: UUID,
    chain_svc: ChainService = Depends(get_chain_service),
) -> list[TaskRead]:
    """Retorna todas as tarefas de uma cadeia ordenadas por posição."""
    tasks = chain_svc.get_chain_tasks(chain_id)
    return [_to_read(t, chain_svc=chain_svc) for t in tasks]


@router.post("/{task_id}/link", response_model=TaskRead)
def link_task(
    task_id: UUID,
    payload: TaskLinkPayload,
    service: TaskService = Depends(get_task_service),
    chain_svc: ChainService = Depends(get_chain_service),
) -> TaskRead:
    """Vincula esta tarefa a outra, criando ou estendendo uma cadeia."""
    try:
        task = service.get(task_id)
        service.get(payload.related_task_id)  # valida existência
    except TaskNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    chain_svc.link(task_id, payload.related_task_id)
    task = service.get(task_id)
    return _to_read(task, chain_svc=chain_svc)


@router.delete("/{task_id}/link/{related_id}", response_model=TaskRead)
def unlink_task(
    task_id: UUID,
    related_id: UUID,
    service: TaskService = Depends(get_task_service),
    chain_svc: ChainService = Depends(get_chain_service),
) -> TaskRead:
    """Remove o vínculo de cadeia entre duas tarefas."""
    try:
        service.get(task_id)
    except TaskNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    chain_svc.unlink(task_id, related_id)
    task = service.get(task_id)
    return _to_read(task, chain_svc=chain_svc)
