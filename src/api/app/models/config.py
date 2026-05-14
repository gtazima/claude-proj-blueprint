from uuid import UUID, uuid4

from sqlmodel import Field, SQLModel


class Person(SQLModel, table=True):
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    name: str = Field(min_length=1, max_length=100)
    slug: str = Field(min_length=1, max_length=60, unique=True, index=True)
    color: str = Field(default="#6B7280", max_length=20)
    supabase_user_id: str | None = Field(default=None, max_length=200)
    whatsapp_number: str | None = Field(default=None, max_length=30)
    is_active: bool = Field(default=True)


class ActivityType(SQLModel, table=True):
    __tablename__ = "activity_types"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    name: str = Field(min_length=1, max_length=100)
    slug: str = Field(min_length=1, max_length=60, unique=True, index=True)
    color: str = Field(default="#6B7280", max_length=20)


class Culture(SQLModel, table=True):
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    name: str = Field(min_length=1, max_length=100)
    slug: str = Field(min_length=1, max_length=60, unique=True, index=True)
    color: str = Field(default="#6B7280", max_length=20)
