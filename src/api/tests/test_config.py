"""
Testes do serviço de configuração (pessoas, tipos de atividade, culturas).
"""

import pytest
from sqlmodel import Session

from app.services.config import (
    ActivityTypeService,
    ConfigNotFoundError,
    CultureService,
    PeopleService,
    SlugConflictError,
    seed_config,
)
from app.schemas.config import PersonCreate, TagCreate, TagUpdate, PersonUpdate


# ─── Fixtures ────────────────────────────────────────────────────────────────


@pytest.fixture
def people_svc(session: Session) -> PeopleService:
    return PeopleService(session)


@pytest.fixture
def type_svc(session: Session) -> ActivityTypeService:
    return ActivityTypeService(session)


@pytest.fixture
def culture_svc(session: Session) -> CultureService:
    return CultureService(session)


@pytest.fixture
def seeded(session: Session):
    seed_config(session)
    return session


# ─── Seed ────────────────────────────────────────────────────────────────────


class TestSeedConfig:
    def test_creates_default_people(self, seeded: Session):
        svc = PeopleService(seeded)
        slugs = {p.slug for p in svc.list()}
        assert {"produtor", "pai", "funcionario", "nao_atribuido"}.issubset(slugs)

    def test_creates_default_types(self, seeded: Session):
        svc = ActivityTypeService(seeded)
        assert len(svc.list()) == 13

    def test_creates_default_cultures(self, seeded: Session):
        svc = CultureService(seeded)
        assert len(svc.list()) == 5

    def test_seed_is_idempotent(self, seeded: Session):
        seed_config(seeded)  # second call must not duplicate
        svc = PeopleService(seeded)
        slugs = [p.slug for p in svc.list()]
        assert len(slugs) == len(set(slugs))


# ─── People ──────────────────────────────────────────────────────────────────


class TestPeopleService:
    def test_create_person(self, people_svc: PeopleService):
        p = people_svc.create(PersonCreate(name="Ana", slug="ana"))
        assert p.slug == "ana"
        assert p.is_active is True

    def test_slug_conflict_raises(self, people_svc: PeopleService):
        people_svc.create(PersonCreate(name="Ana", slug="ana"))
        with pytest.raises(SlugConflictError):
            people_svc.create(PersonCreate(name="Ana 2", slug="ana"))

    def test_get_unknown_raises(self, people_svc: PeopleService):
        with pytest.raises(ConfigNotFoundError):
            people_svc.get("nao_existe")

    def test_update_person(self, people_svc: PeopleService):
        people_svc.create(PersonCreate(name="Ana", slug="ana"))
        updated = people_svc.update("ana", PersonUpdate(name="Ana Clara"))
        assert updated.name == "Ana Clara"

    def test_delete_resets_task_executor(self, session: Session):
        from app.services.tasks import TaskService
        from app.schemas.task import TaskCreate

        svc = PeopleService(session)
        svc.create(PersonCreate(name="Temp", slug="temp"))

        tsvc = TaskService(session)
        task = tsvc.create(TaskCreate(title="Tarefa", executor="temp"))

        svc.delete("temp")
        session.refresh(task)
        assert task.executor == "nao_atribuido"


# ─── Activity types ───────────────────────────────────────────────────────────


class TestActivityTypeService:
    def test_create_and_list(self, type_svc: ActivityTypeService):
        type_svc.create(TagCreate(name="Rega", slug="rega"))
        names = [t.name for t in type_svc.list()]
        assert "Rega" in names

    def test_delete_strips_tag_from_titles(self, session: Session):
        from app.services.tasks import TaskService
        from app.schemas.task import TaskCreate

        tsvc = TaskService(session)
        tsvc.create(TaskCreate(title="Irrigação · Shiitake — Lote 07"))
        tsvc.create(TaskCreate(title="Irrigação — Tarefa sem cultura"))
        tsvc.create(TaskCreate(title="Tarefa sem tipo"))

        type_svc = ActivityTypeService(session)
        type_svc.create(TagCreate(name="Irrigação", slug="irrigacao"))
        type_svc.delete("irrigacao")

        tasks = tsvc.list_today()
        titles = {t.title for t in tasks}
        assert any("Shiitake" in t for t in titles)
        assert not any(t.startswith("Irrigação") for t in titles)
        assert "Tarefa sem tipo" in titles

    def test_slug_conflict_raises(self, type_svc: ActivityTypeService):
        type_svc.create(TagCreate(name="Rega", slug="rega"))
        with pytest.raises(SlugConflictError):
            type_svc.create(TagCreate(name="Rega 2", slug="rega"))


# ─── Cultures ─────────────────────────────────────────────────────────────────


class TestCultureService:
    def test_create_and_delete(self, culture_svc: CultureService):
        culture_svc.create(TagCreate(name="Ervas", slug="ervas"))
        culture_svc.delete("ervas")
        with pytest.raises(ConfigNotFoundError):
            culture_svc.get("ervas")

    def test_delete_strips_culture_from_titles(self, session: Session):
        from app.services.tasks import TaskService
        from app.schemas.task import TaskCreate

        tsvc = TaskService(session)
        tsvc.create(TaskCreate(title="Irrigação · Shiitake — Lote 07"))
        tsvc.create(TaskCreate(title="Shiitake — Checagem de umidade"))

        culture_svc = CultureService(session)
        culture_svc.create(TagCreate(name="Shiitake", slug="shiitake"))
        culture_svc.delete("shiitake")

        tasks = tsvc.list_today()
        titles = {t.title for t in tasks}
        assert not any("Shiitake" in t for t in titles)
        assert any("Irrigação" in t for t in titles)
