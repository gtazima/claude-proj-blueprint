"""
Algoritmo de priorização do módulo Agenda.

Implementação do ADR-001:
    score = (timing × 1000) + (dependency × 100) + (financial × 10) + recency

Pesos por ordem de grandeza garantem que timing > dependência > financeiro,
sempre — sem possibilidade de inversão por valores extremos.
"""

from collections.abc import Sequence
from datetime import datetime, timedelta, timezone
from uuid import UUID

from app.models.task import Task


TIMING_WEIGHT = 1000
DEPENDENCY_WEIGHT = 100
FINANCIAL_WEIGHT = 10

MAX_DEPENDENCY_SCORE = 10
RECENCY_DECAY_DAYS = 30


def timing_score(task: Task, *, now: datetime | None = None) -> int:
    """
    Score de timing biológico baseado em proximidade da janela de execução.

    Janela fechada (deadline_critical):
        scheduled_window_end < now  → 100
    Janela ativa:
        ≤ 1 dia restante  → 90
        ≤ 3 dias          → 70
        ≤ 7 dias          → 50
        ≤ 14 dias         → 30
        > 14 dias         → 10
    Sem janela definida   → 0
    """
    if task.scheduled_window_end is None:
        return 0

    now = now or datetime.now(timezone.utc)
    end = _ensure_aware(task.scheduled_window_end)
    days_remaining = (end - now).total_seconds() / 86400

    if days_remaining <= 0:
        return 100
    if days_remaining <= 1:
        return 90
    if days_remaining <= 3:
        return 70
    if days_remaining <= 7:
        return 50
    if days_remaining <= 14:
        return 30
    return 10


def dependency_score(task: Task, *, dependents_count: int) -> int:
    """
    Score de dependência: número de tarefas que dependem desta.

    Tarefa que desbloqueia mais coisas tem score maior.
    Limitado a MAX_DEPENDENCY_SCORE para garantir que dependência
    nunca ultrapassa um decimal de timing.
    """
    return min(dependents_count, MAX_DEPENDENCY_SCORE)


def financial_score_value(task: Task) -> int:
    """
    Score financeiro vem do campo manual (0-5) preenchido pelo produtor
    ao criar a tarefa. Validação: 0 ≤ score ≤ 5.

    No futuro pode ser calculado automaticamente cruzando com módulo Financeiro.
    """
    return max(0, min(task.financial_score, 5))


def recency_score(task: Task, *, now: datetime | None = None) -> int:
    """
    Desempate por idade da tarefa.

    Tarefa criada há mais tempo recebe score levemente maior — para evitar
    que tarefas antigas sem timing definido fiquem invisíveis indefinidamente.

    Cresce de 0 a 9 ao longo de RECENCY_DECAY_DAYS dias. Como contribui menos
    de 10, jamais altera a hierarquia entre os componentes principais.
    """
    now = now or datetime.now(timezone.utc)
    created = _ensure_aware(task.created_at)
    age_days = (now - created).total_seconds() / 86400
    if age_days <= 0:
        return 0
    score = int(age_days / RECENCY_DECAY_DAYS * 10)
    return min(score, 9)


def calculate_priority_score(
    task: Task,
    *,
    dependents_count: int = 0,
    now: datetime | None = None,
) -> int:
    """
    Score composto de priorização de uma tarefa.

    Tarefas concluídas e tarefas deletadas (soft delete) recebem score -1
    para serem excluídas naturalmente da lista ordenada.
    """
    if task.completed_at is not None or task.deleted_at is not None:
        return -1

    now = now or datetime.now(timezone.utc)
    return (
        timing_score(task, now=now) * TIMING_WEIGHT
        + dependency_score(task, dependents_count=dependents_count) * DEPENDENCY_WEIGHT
        + financial_score_value(task) * FINANCIAL_WEIGHT
        + recency_score(task, now=now)
    )


def sort_by_priority(
    tasks: Sequence[Task],
    *,
    now: datetime | None = None,
) -> list[Task]:
    """
    Ordena tarefas pelo score, do mais alto para o mais baixo.

    Calcula dependents_count automaticamente — quantas tarefas têm cada
    tarefa como dependência.
    """
    now = now or datetime.now(timezone.utc)

    dependents_count: dict[str, int] = {}
    for t in tasks:
        for dep_id in t.dependency_ids:
            dependents_count[dep_id] = dependents_count.get(dep_id, 0) + 1

    scored = [
        (calculate_priority_score(t, dependents_count=dependents_count.get(str(t.id), 0), now=now), t)
        for t in tasks
    ]
    scored.sort(key=lambda pair: pair[0], reverse=True)
    return [t for _score, t in scored]


def is_within_undo_window(
    task: Task,
    *,
    window_seconds: int,
    now: datetime | None = None,
) -> bool:
    """
    Indica se a tarefa concluída ainda está dentro da janela de undo
    (5 minutos por padrão, configurável via settings).
    """
    if task.completed_at is None or task.completion_locked:
        return False
    now = now or datetime.now(timezone.utc)
    completed = _ensure_aware(task.completed_at)
    return (now - completed) <= timedelta(seconds=window_seconds)


def _ensure_aware(dt: datetime) -> datetime:
    """SQLite armazena datetime sem tzinfo; tratamos como UTC."""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt
