"""
Sincronização de tarefas com Google Tasks.
Roda como worker assíncrono em background (asyncio.create_task no lifespan).
"""

import logging
from datetime import datetime, timezone
from uuid import UUID

import httpx
from sqlmodel import Session, select

from app.core.config import settings
from app.db.session import engine
from app.models.property_settings import PropertySettings
from app.models.task import Task
from app.services.google_oauth import GoogleOAuthError, get_valid_access_token

logger = logging.getLogger(__name__)

TASKS_BASE = "https://tasks.googleapis.com/tasks/v1"


# ── Google Tasks helpers ────────────────────────────────────────────────────

def _tasks_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def _ensure_task_lists(token: str, prop: PropertySettings, session: Session) -> None:
    """Cria a lista 'AgroecologIA' se ainda não existe."""
    if not prop.google_tasks_list_id:
        resp = httpx.post(f"{TASKS_BASE}/users/@me/lists",
                          headers=_tasks_headers(token),
                          json={"title": "AgroecologIA"}, timeout=10)
        if resp.status_code == 200:
            prop.google_tasks_list_id = resp.json()["id"]
            prop.updated_at = datetime.now(timezone.utc)
            session.add(prop)
            session.commit()
            session.refresh(prop)


def _task_to_google_payload(task: Task) -> dict:
    payload: dict = {"title": task.title}
    if task.description:
        payload["notes"] = task.description
    if task.scheduled_window_end:
        due = task.scheduled_window_end
        if due.tzinfo is None:
            due = due.replace(tzinfo=timezone.utc)
        payload["due"] = due.strftime("%Y-%m-%dT%H:%M:%S.000Z")
    payload["notes"] = (
        (task.description or "") +
        f"\n[executor: {task.executor.value}]"
    ).strip()
    return payload


def push_task(task: Task, token: str, list_id: str, session: Session) -> None:
    """Cria ou atualiza task no Google Tasks."""
    payload = _task_to_google_payload(task)

    if task.google_task_id:
        resp = httpx.patch(
            f"{TASKS_BASE}/lists/{list_id}/tasks/{task.google_task_id}",
            headers=_tasks_headers(token),
            json=payload, timeout=10,
        )
        if resp.status_code == 404:
            task.google_task_id = None  # recria abaixo

    if not task.google_task_id:
        resp = httpx.post(
            f"{TASKS_BASE}/lists/{list_id}/tasks",
            headers=_tasks_headers(token),
            json=payload, timeout=10,
        )
        if resp.status_code == 200:
            task.google_task_id = resp.json()["id"]
            session.add(task)
            session.commit()


def delete_task(google_task_id: str, token: str, list_id: str) -> None:
    httpx.delete(
        f"{TASKS_BASE}/lists/{list_id}/tasks/{google_task_id}",
        headers=_tasks_headers(token), timeout=10,
    )


def complete_task(google_task_id: str, token: str, list_id: str) -> None:
    httpx.patch(
        f"{TASKS_BASE}/lists/{list_id}/tasks/{google_task_id}",
        headers=_tasks_headers(token),
        json={"status": "completed"}, timeout=10,
    )


# ── Google Tasks polling (pull) ───────────────────────────────────────────

def poll_tasks(token: str, prop: PropertySettings, session: Session) -> None:
    """Importa tarefas novas criadas diretamente no Google Tasks como pending_review."""
    if not prop.google_tasks_list_id:
        return

    params: dict = {"showCompleted": "false", "showHidden": "false"}
    if prop.google_last_sync_at:
        since = prop.google_last_sync_at
        if since.tzinfo is None:
            since = since.replace(tzinfo=timezone.utc)
        params["updatedMin"] = since.strftime("%Y-%m-%dT%H:%M:%SZ")

    resp = httpx.get(
        f"{TASKS_BASE}/lists/{prop.google_tasks_list_id}/tasks",
        headers=_tasks_headers(token),
        params=params, timeout=15,
    )

    if resp.status_code != 200:
        logger.error("Erro ao fazer polling do Google Tasks: %s", resp.text)
        return

    for item in resp.json().get("items", []):
        google_task_id = item.get("id")
        if not google_task_id:
            continue

        # Tarefa já existe no app — app é fonte da verdade, não sobrescreve
        existing = session.exec(
            select(Task).where(Task.google_task_id == google_task_id)
        ).first()
        if existing:
            continue

        title = (item.get("title") or "").strip()
        if not title:
            continue

        notes = item.get("notes") or None
        due_str = item.get("due")
        scheduled: datetime | None = None
        if due_str:
            try:
                # Parse only the date part — Google Tasks stores due at UTC midnight
                scheduled = datetime.strptime(due_str[:10], "%Y-%m-%d").replace(tzinfo=timezone.utc)
            except ValueError:
                pass

        session.add(Task(
            title=title,
            description=notes,
            executor="nao_atribuido",
            scheduled_window_start=scheduled,
            is_pending_review=True,
            google_task_id=google_task_id,
        ))

    session.commit()


# ── Ciclo principal ────────────────────────────────────────────────────────

def run_sync_cycle(session: Session) -> None:
    prop = session.get(PropertySettings, "default")
    if not prop or not prop.google_access_token:
        return

    try:
        token = get_valid_access_token(session)
    except GoogleOAuthError as e:
        logger.warning("Sync abortado — token inválido: %s", e)
        return

    session.refresh(prop)
    _ensure_task_lists(token, prop, session)
    session.refresh(prop)

    if not prop.google_tasks_list_id:
        logger.error("Lista AgroecologIA não encontrada após _ensure_task_lists")
        return

    now = datetime.now(timezone.utc)
    last_sync = prop.google_last_sync_at

    # ── Push: tarefas modificadas desde o último sync ──
    stmt = (
        select(Task)
        .where(Task.deleted_at.is_(None))  # type: ignore[attr-defined]
        .where(Task.is_pending_review == False)  # noqa: E712
    )
    if last_sync:
        if last_sync.tzinfo is None:
            last_sync = last_sync.replace(tzinfo=timezone.utc)
        stmt = stmt.where(Task.updated_at >= last_sync)

    tasks = session.exec(stmt).all()

    list_id = prop.google_tasks_list_id
    for task in tasks:
        try:
            if task.completed_at:
                if task.google_task_id:
                    complete_task(task.google_task_id, token, list_id)
            else:
                push_task(task, token, list_id, session)
        except Exception as e:
            logger.error("Erro ao sincronizar tarefa %s: %s", task.id, e)

    # ── Push: tarefas soft-deletadas com google_task_id ──
    deleted_stmt = (
        select(Task)
        .where(Task.deleted_at.isnot(None))
        .where(Task.google_task_id.isnot(None))
    )
    if last_sync:
        deleted_stmt = deleted_stmt.where(Task.deleted_at >= last_sync)  # type: ignore[arg-type]

    deleted_tasks = session.exec(deleted_stmt).all()
    for task in deleted_tasks:
        if task.google_task_id:
            try:
                delete_task(task.google_task_id, token, list_id)
                task.google_task_id = None
                session.add(task)
            except Exception as e:
                logger.error("Erro ao deletar tarefa %s do Google Tasks: %s", task.id, e)

    session.commit()

    # ── Poll: tarefas novas criadas diretamente no Google Tasks ──
    try:
        poll_tasks(token, prop, session)
    except Exception as e:
        logger.error("Erro ao fazer polling do Google Tasks: %s", e)

    # Atualiza timestamp do último sync
    prop = session.get(PropertySettings, "default")  # refresh após commits
    if prop:
        prop.google_last_sync_at = now
        session.add(prop)
        session.commit()


# ── Sync imediato (fire-and-forget via BackgroundTasks) ───────────────────

def _sync_single_task(session: Session, task_id: UUID) -> None:
    """Sincroniza uma única tarefa — chamado após cada write."""
    prop = session.get(PropertySettings, "default")
    if not prop or not prop.google_access_token or not prop.google_tasks_list_id:
        return

    task = session.get(Task, task_id)
    if not task or task.is_pending_review:
        return

    token = get_valid_access_token(session)
    list_id = prop.google_tasks_list_id

    if task.deleted_at:
        if task.google_task_id:
            delete_task(task.google_task_id, token, list_id)
            task.google_task_id = None
            session.add(task)
            session.commit()
    elif task.completed_at:
        if task.google_task_id:
            complete_task(task.google_task_id, token, list_id)
    else:
        push_task(task, token, list_id, session)


def push_task_now(task_id: UUID) -> None:
    """BackgroundTask: sync imediato. Falha é silenciosa — worker de 60s reconcilia."""
    if not settings.feature_google_sync_enabled:
        return
    try:
        with Session(engine) as session:
            _sync_single_task(session, task_id)
    except Exception:
        logger.warning("Sync imediato falhou para tarefa %s — worker vai reconciliar", task_id)
