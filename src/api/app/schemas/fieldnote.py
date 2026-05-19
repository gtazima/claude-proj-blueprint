from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class FieldNoteCreate(BaseModel):
    content: str = Field(min_length=1, max_length=5000)
    culture: str | None = None
    management_unit: str | None = None
    executor: str | None = None
    entry_type: str = Field(default="manual", pattern=r"^(manual|feedback)$")


class FieldNoteRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    content: str
    entry_type: str
    source_task_id: UUID | None
    culture: str | None
    management_unit: str | None
    executor: str | None
    activity_type_slug: str | None
    culture_slug: str | None
    ambiente_slug: str | None
    lote_slug: str | None
    created_at: datetime
