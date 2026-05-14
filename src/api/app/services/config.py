"""
Serviço de configuração do módulo Agenda:
- Pessoas (responsáveis de tarefas)
- Tipos de atividade
- Culturas

Ao deletar uma tag, o trecho correspondente é removido dos títulos das tarefas.
Ao deletar uma pessoa, o executor das tarefas afetadas volta para "nao_atribuido".
"""

import re
import unicodedata

from sqlmodel import Session, select

from app.models.config import ActivityType, Culture, Person
from app.models.task import Task
from app.schemas.config import PersonCreate, PersonUpdate, TagCreate, TagUpdate

# ─── Separadores (espelhados do frontend activityTags.ts) ─────────────────────
TAG_SEP = " · "
BASE_SEP = " — "


class ConfigNotFoundError(ValueError):
    pass


class SlugConflictError(ValueError):
    pass


# ─── helpers ─────────────────────────────────────────────────────────────────


def _slugify(name: str) -> str:
    normalized = unicodedata.normalize("NFD", name.lower())
    ascii_only = normalized.encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "_", ascii_only).strip("_")


def _strip_tag_from_title(title: str, tag_name: str) -> str:
    """Remove uma tag (por nome) do título, preservando as demais."""
    if BASE_SEP in title:
        tags_part, base = title.split(BASE_SEP, 1)
    else:
        tags_part, base = title, None

    segments = [s.strip() for s in tags_part.split(TAG_SEP)]
    remaining = [s for s in segments if s.lower() != tag_name.lower()]

    if not remaining:
        return base or ""
    tags_str = TAG_SEP.join(remaining)
    if base is None:
        return tags_str
    return f"{tags_str}{BASE_SEP}{base}"


# ─── Seed ────────────────────────────────────────────────────────────────────

_SEED_PEOPLE = [
    ("Produtor", "produtor", "#16A34A"),
    ("Pai", "pai", "#2563EB"),
    ("Funcionário", "funcionario", "#D97706"),
    ("Não atribuído", "nao_atribuido", "#6B7280"),
]

_SEED_TYPES = [
    ("Irrigação", "irrigacao", "#3B82F6"),
    ("Adubação", "adubacao", "#10B981"),
    ("Plantio", "plantio", "#6366F1"),
    ("Colheita", "colheita", "#F59E0B"),
    ("Poda", "poda", "#8B5CF6"),
    ("Manejo", "manejo", "#EC4899"),
    ("Roçar", "rocar", "#14B8A6"),
    ("Limpeza", "limpeza", "#84CC16"),
    ("Manutenção", "manutencao", "#F97316"),
    ("Monitoramento", "monitoramento", "#0EA5E9"),
    ("Controle de pragas", "controle_de_pragas", "#EF4444"),
    ("Venda", "venda", "#A855F7"),
    ("Transporte", "transporte", "#64748B"),
]

_SEED_CULTURES = [
    ("Shiitake", "shiitake", "#92400E"),
    ("Café SAF", "cafe_saf", "#78350F"),
    ("Abelhas", "abelhas", "#F59E0B"),
    ("Cúrcuma", "curcuma", "#D97706"),
    ("Canavial", "canavial", "#16A34A"),
]


def seed_config(session: Session) -> None:
    """Popula as tabelas de configuração se estiverem vazias."""
    if session.exec(select(Person)).first() is None:
        for name, slug, color in _SEED_PEOPLE:
            session.add(Person(name=name, slug=slug, color=color))

    if session.exec(select(ActivityType)).first() is None:
        for name, slug, color in _SEED_TYPES:
            session.add(ActivityType(name=name, slug=slug, color=color))

    if session.exec(select(Culture)).first() is None:
        for name, slug, color in _SEED_CULTURES:
            session.add(Culture(name=name, slug=slug, color=color))

    session.commit()


# ─── PeopleService ───────────────────────────────────────────────────────────


class PeopleService:
    def __init__(self, session: Session) -> None:
        self.session = session

    def list(self) -> list[Person]:
        return list(self.session.exec(select(Person).order_by(Person.name)))

    def get(self, slug: str) -> Person:
        person = self.session.exec(select(Person).where(Person.slug == slug)).first()
        if person is None:
            raise ConfigNotFoundError(f"Person '{slug}' not found")
        return person

    def create(self, payload: PersonCreate) -> Person:
        existing = self.session.exec(select(Person).where(Person.slug == payload.slug)).first()
        if existing:
            raise SlugConflictError(f"Slug '{payload.slug}' already exists")
        person = Person(**payload.model_dump())
        self.session.add(person)
        self.session.commit()
        self.session.refresh(person)
        return person

    def update(self, slug: str, payload: PersonUpdate) -> Person:
        person = self.get(slug)
        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(person, field, value)
        self.session.add(person)
        self.session.commit()
        self.session.refresh(person)
        return person

    def delete(self, slug: str) -> None:
        """Deleta pessoa e redefine executor das tarefas afetadas para 'nao_atribuido'."""
        person = self.get(slug)
        tasks = self.session.exec(select(Task).where(Task.executor == slug, Task.deleted_at.is_(None))).all()  # type: ignore[attr-defined]
        for task in tasks:
            task.executor = "nao_atribuido"
            self.session.add(task)
        self.session.delete(person)
        self.session.commit()


# ─── ActivityTypeService ─────────────────────────────────────────────────────


class ActivityTypeService:
    def __init__(self, session: Session) -> None:
        self.session = session

    def list(self) -> list[ActivityType]:
        return list(self.session.exec(select(ActivityType).order_by(ActivityType.name)))

    def get(self, slug: str) -> ActivityType:
        obj = self.session.exec(select(ActivityType).where(ActivityType.slug == slug)).first()
        if obj is None:
            raise ConfigNotFoundError(f"ActivityType '{slug}' not found")
        return obj

    def create(self, payload: TagCreate) -> ActivityType:
        if self.session.exec(select(ActivityType).where(ActivityType.slug == payload.slug)).first():
            raise SlugConflictError(f"Slug '{payload.slug}' already exists")
        obj = ActivityType(**payload.model_dump())
        self.session.add(obj)
        self.session.commit()
        self.session.refresh(obj)
        return obj

    def update(self, slug: str, payload: TagUpdate) -> ActivityType:
        obj = self.get(slug)
        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(obj, field, value)
        self.session.add(obj)
        self.session.commit()
        self.session.refresh(obj)
        return obj

    def delete(self, slug: str) -> None:
        """Deleta tipo e remove a tag dos títulos de todas as tarefas."""
        obj = self.get(slug)
        tasks = self.session.exec(
            select(Task).where(Task.title.contains(obj.name), Task.deleted_at.is_(None))  # type: ignore[attr-defined]
        ).all()
        for task in tasks:
            task.title = _strip_tag_from_title(task.title, obj.name) or task.title
            self.session.add(task)
        self.session.delete(obj)
        self.session.commit()


# ─── CultureService ───────────────────────────────────────────────────────────


class CultureService:
    def __init__(self, session: Session) -> None:
        self.session = session

    def list(self) -> list[Culture]:
        return list(self.session.exec(select(Culture).order_by(Culture.name)))

    def get(self, slug: str) -> Culture:
        obj = self.session.exec(select(Culture).where(Culture.slug == slug)).first()
        if obj is None:
            raise ConfigNotFoundError(f"Culture '{slug}' not found")
        return obj

    def create(self, payload: TagCreate) -> Culture:
        if self.session.exec(select(Culture).where(Culture.slug == payload.slug)).first():
            raise SlugConflictError(f"Slug '{payload.slug}' already exists")
        obj = Culture(**payload.model_dump())
        self.session.add(obj)
        self.session.commit()
        self.session.refresh(obj)
        return obj

    def update(self, slug: str, payload: TagUpdate) -> Culture:
        obj = self.get(slug)
        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(obj, field, value)
        self.session.add(obj)
        self.session.commit()
        self.session.refresh(obj)
        return obj

    def delete(self, slug: str) -> None:
        obj = self.get(slug)
        tasks = self.session.exec(
            select(Task).where(Task.title.contains(obj.name), Task.deleted_at.is_(None))  # type: ignore[attr-defined]
        ).all()
        for task in tasks:
            task.title = _strip_tag_from_title(task.title, obj.name) or task.title
            self.session.add(task)
        self.session.delete(obj)
        self.session.commit()
