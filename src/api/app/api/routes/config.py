"""
Endpoints de configuração do módulo Agenda:
  /api/config/people        — responsáveis de tarefas
  /api/config/activity-types — tipos de atividade
  /api/config/cultures       — culturas
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from app.api.deps import get_current_user
from app.db.session import get_session
from app.schemas.config import (
    PersonCreate,
    PersonRead,
    PersonUpdate,
    TagCreate,
    TagRead,
    TagUpdate,
)
from app.services.config import (
    ActivityTypeService,
    ConfigNotFoundError,
    CultureService,
    PeopleService,
    SlugConflictError,
)

router = APIRouter(prefix="/config", dependencies=[Depends(get_current_user)])


def _people_svc(session: Session = Depends(get_session)) -> PeopleService:
    return PeopleService(session)


def _type_svc(session: Session = Depends(get_session)) -> ActivityTypeService:
    return ActivityTypeService(session)


def _culture_svc(session: Session = Depends(get_session)) -> CultureService:
    return CultureService(session)


# ─── People ──────────────────────────────────────────────────────────────────


@router.get("/people", response_model=list[PersonRead])
def list_people(svc: PeopleService = Depends(_people_svc)) -> list[PersonRead]:
    return svc.list()  # type: ignore[return-value]


@router.post("/people", response_model=PersonRead, status_code=201)
def create_person(payload: PersonCreate, svc: PeopleService = Depends(_people_svc)) -> PersonRead:
    try:
        return svc.create(payload)  # type: ignore[return-value]
    except SlugConflictError as e:
        raise HTTPException(status_code=409, detail=str(e)) from e


@router.patch("/people/{slug}", response_model=PersonRead)
def update_person(slug: str, payload: PersonUpdate, svc: PeopleService = Depends(_people_svc)) -> PersonRead:
    try:
        return svc.update(slug, payload)  # type: ignore[return-value]
    except ConfigNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e


@router.delete("/people/{slug}", status_code=204)
def delete_person(slug: str, svc: PeopleService = Depends(_people_svc)) -> None:
    try:
        svc.delete(slug)
    except ConfigNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e


# ─── Activity types ───────────────────────────────────────────────────────────


@router.get("/activity-types", response_model=list[TagRead])
def list_activity_types(svc: ActivityTypeService = Depends(_type_svc)) -> list[TagRead]:
    return svc.list()  # type: ignore[return-value]


@router.post("/activity-types", response_model=TagRead, status_code=201)
def create_activity_type(payload: TagCreate, svc: ActivityTypeService = Depends(_type_svc)) -> TagRead:
    try:
        return svc.create(payload)  # type: ignore[return-value]
    except SlugConflictError as e:
        raise HTTPException(status_code=409, detail=str(e)) from e


@router.patch("/activity-types/{slug}", response_model=TagRead)
def update_activity_type(slug: str, payload: TagUpdate, svc: ActivityTypeService = Depends(_type_svc)) -> TagRead:
    try:
        return svc.update(slug, payload)  # type: ignore[return-value]
    except ConfigNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e


@router.delete("/activity-types/{slug}", status_code=204)
def delete_activity_type(slug: str, svc: ActivityTypeService = Depends(_type_svc)) -> None:
    try:
        svc.delete(slug)
    except ConfigNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e


# ─── Cultures ────────────────────────────────────────────────────────────────


@router.get("/cultures", response_model=list[TagRead])
def list_cultures(svc: CultureService = Depends(_culture_svc)) -> list[TagRead]:
    return svc.list()  # type: ignore[return-value]


@router.post("/cultures", response_model=TagRead, status_code=201)
def create_culture(payload: TagCreate, svc: CultureService = Depends(_culture_svc)) -> TagRead:
    try:
        return svc.create(payload)  # type: ignore[return-value]
    except SlugConflictError as e:
        raise HTTPException(status_code=409, detail=str(e)) from e


@router.patch("/cultures/{slug}", response_model=TagRead)
def update_culture(slug: str, payload: TagUpdate, svc: CultureService = Depends(_culture_svc)) -> TagRead:
    try:
        return svc.update(slug, payload)  # type: ignore[return-value]
    except ConfigNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e


@router.delete("/cultures/{slug}", status_code=204)
def delete_culture(slug: str, svc: CultureService = Depends(_culture_svc)) -> None:
    try:
        svc.delete(slug)
    except ConfigNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
