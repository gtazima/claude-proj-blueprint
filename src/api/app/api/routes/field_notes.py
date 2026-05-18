from datetime import date

from fastapi import APIRouter, Depends, Query, status

from app.api.deps import get_field_note_service
from app.schemas.fieldnote import FieldNoteCreate, FieldNoteRead
from app.services.field_notes import FieldNoteService

router = APIRouter(prefix="/field-notes", tags=["field-notes"])


@router.get("", response_model=list[FieldNoteRead])
def list_field_notes(
    culture: str | None = Query(default=None),
    executor: str | None = Query(default=None),
    entry_type: str | None = Query(default=None),
    keyword: str | None = Query(default=None),
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    service: FieldNoteService = Depends(get_field_note_service),
) -> list[FieldNoteRead]:
    notes = service.list(
        culture=culture,
        executor=executor,
        entry_type=entry_type,
        keyword=keyword,
        date_from=date_from,
        date_to=date_to,
        limit=limit,
        offset=offset,
    )
    return [FieldNoteRead.model_validate(n) for n in notes]


@router.post("", response_model=FieldNoteRead, status_code=status.HTTP_201_CREATED)
def create_field_note(
    payload: FieldNoteCreate,
    service: FieldNoteService = Depends(get_field_note_service),
) -> FieldNoteRead:
    note = service.create(payload)
    return FieldNoteRead.model_validate(note)
