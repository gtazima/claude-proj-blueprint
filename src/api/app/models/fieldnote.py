from datetime import datetime, timezone
from uuid import UUID, uuid4

from sqlmodel import Field, SQLModel


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class FieldNote(SQLModel, table=True):
    __tablename__ = "fieldnote"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    content: str = Field(min_length=1, max_length=5000)
    entry_type: str = Field(default="manual", max_length=30)
    source_task_id: UUID | None = Field(default=None, foreign_key="task.id")
    culture: str | None = Field(default=None, max_length=100)
    management_unit: str | None = Field(default=None, max_length=100)
    executor: str | None = Field(default=None, max_length=60)
    created_at: datetime = Field(default_factory=utcnow, nullable=False)
