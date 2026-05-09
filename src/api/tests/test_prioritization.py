"""
Testes do algoritmo de priorização (ADR-001).

Garantia central: a hierarquia timing > dependência > financeiro
nunca pode ser invertida por valores extremos de componentes inferiores.
"""

from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest

from app.models.task import Executor, Task
from app.services.prioritization import (
    calculate_priority_score,
    dependency_score,
    financial_score_value,
    is_within_undo_window,
    recency_score,
    sort_by_priority,
    timing_score,
)


NOW = datetime(2026, 5, 8, 12, 0, 0, tzinfo=timezone.utc)


def make_task(
    *,
    title: str = "Tarefa",
    scheduled_window_end: datetime | None = None,
    financial_score: int = 0,
    dependency_ids: list[str] | None = None,
    completed_at: datetime | None = None,
    deleted_at: datetime | None = None,
    created_at: datetime | None = None,
    deferral_count: int = 0,
) -> Task:
    return Task(
        title=title,
        scheduled_window_end=scheduled_window_end,
        financial_score=financial_score,
        dependency_ids=dependency_ids or [],
        completed_at=completed_at,
        deleted_at=deleted_at,
        created_at=created_at or NOW,
        deferral_count=deferral_count,
    )


class TestTimingScore:
    def test_no_window_returns_zero(self):
        task = make_task(scheduled_window_end=None)
        assert timing_score(task, now=NOW) == 0

    def test_window_closed_returns_max(self):
        task = make_task(scheduled_window_end=NOW - timedelta(hours=1))
        assert timing_score(task, now=NOW) == 100

    def test_within_one_day(self):
        task = make_task(scheduled_window_end=NOW + timedelta(hours=12))
        assert timing_score(task, now=NOW) == 90

    def test_within_three_days(self):
        task = make_task(scheduled_window_end=NOW + timedelta(days=2))
        assert timing_score(task, now=NOW) == 70

    def test_within_seven_days(self):
        task = make_task(scheduled_window_end=NOW + timedelta(days=5))
        assert timing_score(task, now=NOW) == 50

    def test_within_two_weeks(self):
        task = make_task(scheduled_window_end=NOW + timedelta(days=10))
        assert timing_score(task, now=NOW) == 30

    def test_distant_window(self):
        task = make_task(scheduled_window_end=NOW + timedelta(days=60))
        assert timing_score(task, now=NOW) == 10


class TestDependencyScore:
    def test_no_dependents(self):
        task = make_task()
        assert dependency_score(task, dependents_count=0) == 0

    def test_some_dependents(self):
        task = make_task()
        assert dependency_score(task, dependents_count=4) == 4

    def test_capped_at_max(self):
        task = make_task()
        assert dependency_score(task, dependents_count=999) == 10


class TestFinancialScore:
    def test_default_zero(self):
        task = make_task(financial_score=0)
        assert financial_score_value(task) == 0

    def test_max_score(self):
        task = make_task(financial_score=5)
        assert financial_score_value(task) == 5

    def test_clamps_above_max(self):
        task = make_task(financial_score=10)
        assert financial_score_value(task) == 5


class TestRecencyScore:
    def test_just_created(self):
        task = make_task(created_at=NOW)
        assert recency_score(task, now=NOW) == 0

    def test_old_task_capped_at_nine(self):
        task = make_task(created_at=NOW - timedelta(days=365))
        assert recency_score(task, now=NOW) == 9

    def test_recency_never_exceeds_one_decimal_of_financial_weight(self):
        """Recency só desempata — nunca ultrapassa 9 (uma ordem abaixo do financeiro)."""
        task = make_task(created_at=NOW - timedelta(days=10000))
        assert recency_score(task, now=NOW) <= 9


class TestPriorityHierarchy:
    """
    Garantia inviolável: timing > dependência > financeiro.

    Mesmo no pior caso (timing baixo + dependência/financeiro máximos contra
    timing máximo + nada), a tarefa com timing maior deve sempre vencer.
    """

    def test_timing_always_beats_dependency_and_financial(self):
        timing_critical = make_task(scheduled_window_end=NOW - timedelta(hours=1))
        no_timing_max_others = make_task(financial_score=5)

        score_timing = calculate_priority_score(timing_critical, dependents_count=0, now=NOW)
        score_others = calculate_priority_score(no_timing_max_others, dependents_count=10, now=NOW)

        assert score_timing > score_others

    def test_timing_beats_max_dependency_with_minimum_difference(self):
        """Mesmo timing distante (10) vence dependência máxima (10)."""
        distant_timing = make_task(scheduled_window_end=NOW + timedelta(days=60))
        no_timing_high_dep = make_task(financial_score=5)

        score_timing = calculate_priority_score(distant_timing, dependents_count=0, now=NOW)
        score_dep = calculate_priority_score(no_timing_high_dep, dependents_count=10, now=NOW)

        assert score_timing > score_dep

    def test_dependency_always_beats_financial(self):
        single_dep = make_task()
        max_financial = make_task(financial_score=5)

        score_dep = calculate_priority_score(single_dep, dependents_count=1, now=NOW)
        score_fin = calculate_priority_score(max_financial, dependents_count=0, now=NOW)

        assert score_dep > score_fin


class TestExcludeCompletedAndDeleted:
    def test_completed_task_returns_negative(self):
        task = make_task(completed_at=NOW)
        assert calculate_priority_score(task, now=NOW) == -1

    def test_deleted_task_returns_negative(self):
        task = make_task(deleted_at=NOW)
        assert calculate_priority_score(task, now=NOW) == -1


class TestSortByPriority:
    def test_orders_by_score_descending(self):
        critical = make_task(title="critical", scheduled_window_end=NOW - timedelta(hours=1))
        soon = make_task(title="soon", scheduled_window_end=NOW + timedelta(days=2))
        no_timing_with_dep = make_task(title="dep")
        plain = make_task(title="plain", financial_score=2)

        result = sort_by_priority([plain, soon, no_timing_with_dep, critical], now=NOW)

        assert result[0].title == "critical"
        assert result[1].title == "soon"

    def test_dependents_count_calculated_correctly(self):
        """Tarefa B depende de A. A deve receber dependency_score = 1."""
        task_a = make_task(title="A")
        task_b = make_task(title="B", dependency_ids=[str(task_a.id)])

        result = sort_by_priority([task_a, task_b], now=NOW)
        assert result[0].title == "A"

    def test_excludes_completed_naturally(self):
        active = make_task(title="active", scheduled_window_end=NOW + timedelta(days=2))
        done = make_task(title="done", completed_at=NOW, scheduled_window_end=NOW - timedelta(hours=1))

        result = sort_by_priority([active, done], now=NOW)
        # ambas aparecem mas a concluída fica no fim com score -1
        assert result[0].title == "active"
        assert result[-1].title == "done"


class TestUndoWindow:
    def test_within_window(self):
        task = make_task(completed_at=NOW - timedelta(seconds=60))
        assert is_within_undo_window(task, window_seconds=300, now=NOW) is True

    def test_after_window(self):
        task = make_task(completed_at=NOW - timedelta(seconds=600))
        assert is_within_undo_window(task, window_seconds=300, now=NOW) is False

    def test_locked_completion_blocks_undo(self):
        task = make_task(completed_at=NOW - timedelta(seconds=60))
        task.completion_locked = True
        assert is_within_undo_window(task, window_seconds=300, now=NOW) is False

    def test_not_completed_returns_false(self):
        task = make_task()
        assert is_within_undo_window(task, window_seconds=300, now=NOW) is False
