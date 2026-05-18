from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class FieldNoteCreate(BaseModel):
    content: str = Field(min_length=1, max_length=5000)
    culture: str | None = None
    management_unit: str | None = None
    executor: str | None = None


class FieldNoteRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    content: str
    entry_type: str
    source_task_id: UUID | None
    culture: str | None
    management_unit: str | None
    executor: str | None
    created_at: datetime
