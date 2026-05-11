"""
Sincronização de tarefas com Google Tasks e polling do Google Calendar.
Roda como worker assíncrono em background (asyncio.create_task no lifespan).
"""

import logging
from datetime import datetime, timezone
from uuid import UUID

import httpx
from sqlmodel import Session, select

from app.models.property_settings import PropertySettings
from app.models.task import Executor, Task
from app.services.google_oauth import GoogleOAuthError, get_valid_access_token

logger = logging.getLogger(__name__)

TASKS_BASE = "https://tasks.googleapis.com/tasks/v1"
CALENDAR_BASE = "https://www.googleapis.com/calendar/v3"


# ── Google Tasks helpers ────────────────────────────────────────────────────

def _tasks_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def _ensure_task_lists(token: str, prop: PropertySettings, session: Session) -> None:
    """Cria as listas 'AgroecologIA' e 'memória' se ainda não existem."""
    changed = False

    if not prop.google_tasks_list_id:
        resp = httpx.post(f"{TASKS_BASE}/users/@me/lists",
                          headers=_tasks_headers(token),
                          json={"title": "AgroecologIA"}, timeout=10)
        if resp.status_code == 200:
            prop.google_tasks_list_id = resp.json()["id"]
            changed = True

    if not prop.google_memory_list_id:
        resp = httpx.post(f"{TASKS_BASE}/users/@me/lists",
                          headers=_tasks_headers(token),
                          json={"title": "memória"}, timeout=10)
        if resp.status_code == 200:
            prop.google_memory_list_id = resp.json()["id"]
            changed = True

    if changed:
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


# ── Google Calendar polling ────────────────────────────────────────────────

def poll_calendar(token: str, prop: PropertySettings, session: Session) -> list[dict]:
    """Retorna eventos novos/modificados desde o último polling. Atualiza nextSyncToken."""
    params: dict = {
        "singleEvents": "true",
        "maxResults": "50",
    }

    if prop.google_last_poll_token:
        params["syncToken"] = prop.google_last_poll_token
    else:
        # Primeira vez: busca últimas 24h ordenando por atualização
        from datetime import timedelta
        since = (datetime.now(timezone.utc) - timedelta(hours=24)).strftime("%Y-%m-%dT%H:%M:%SZ")
        params["updatedMin"] = since
        params["orderBy"] = "updated"

    resp = httpx.get(
        f"{CALENDAR_BASE}/calendars/primary/events",
        headers={"Authorization": f"Bearer {token}"},
        params=params, timeout=15,
    )

    # syncToken inválido (410 Gone) — recomeça sem token
    if resp.status_code == 410:
        prop.google_last_poll_token = None
        session.add(prop)
        session.commit()
        return poll_calendar(token, prop, session)

    if resp.status_code != 200:
        logger.error("Erro ao fazer polling do Calendar: %s", resp.text)
        return []

    data = resp.json()
    next_token = data.get("nextSyncToken")
    if next_token:
        prop.google_last_poll_token = next_token
        prop.updated_at = datetime.now(timezone.utc)
        session.add(prop)
        session.commit()

    return data.get("items", [])


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

    if not prop.google_tasks_list_id or not prop.google_memory_list_id:
        logger.error("Listas do Google Tasks não encontradas após _ensure_task_lists")
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

    for task in tasks:
        try:
            if task.completed_at:
                if task.google_task_id:
                    list_id = prop.google_tasks_list_id if task.scheduled_window_end else prop.google_memory_list_id
                    complete_task(task.google_task_id, token, list_id)
            else:
                list_id = prop.google_tasks_list_id if task.scheduled_window_end else prop.google_memory_list_id
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
            list_id = prop.google_tasks_list_id if task.scheduled_window_end else prop.google_memory_list_id
            try:
                delete_task(task.google_task_id, token, list_id)
                task.google_task_id = None
                session.add(task)
            except Exception as e:
                logger.error("Erro ao deletar tarefa %s do Google Tasks: %s", task.id, e)

    session.commit()

    # ── Poll: eventos novos do Calendar ──
    try:
        events = poll_calendar(token, prop, session)
        _import_calendar_events(events, session)
    except Exception as e:
        logger.error("Erro ao fazer polling do Calendar: %s", e)

    # Atualiza timestamp do último sync
    prop = session.get(PropertySettings, "default")  # refresh após commits
    if prop:
        prop.google_last_sync_at = now
        session.add(prop)
        session.commit()


def _import_calendar_events(events: list[dict], session: Session) -> None:
    """Cria tarefas pending_review para eventos novos do Calendar."""
    for event in events:
        calendar_event_id = event.get("id")
        if not calendar_event_id:
            continue

        # Ignora eventos cancelados
        if event.get("status") == "cancelled":
            continue

        # Verifica se já existe tarefa com esse calendar_event_id (ativa ou deletada)
        existing = session.exec(
            select(Task).where(Task.calendar_event_id == calendar_event_id)
        ).first()
        if existing:
            continue

        title = event.get("summary", "(sem título)")
        start = event.get("start", {})
        start_dt_str = start.get("dateTime") or start.get("date")
        scheduled_start: datetime | None = None
        if start_dt_str:
            try:
                scheduled_start = datetime.fromisoformat(start_dt_str.replace("Z", "+00:00"))
            except ValueError:
                pass

        task = Task(
            title=title,
            executor=Executor.NAO_ATRIBUIDO,
            scheduled_window_start=scheduled_start,
            is_pending_review=True,
            calendar_event_id=calendar_event_id,
        )
        session.add(task)

    session.commit()
