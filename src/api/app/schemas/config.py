from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class PersonCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    slug: str = Field(min_length=1, max_length=60, pattern=r"^[a-z0-9_]+$")
    color: str = Field(default="#6B7280", max_length=20)
    supabase_user_id: str | None = None
    whatsapp_number: str | None = None


class PersonRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    slug: str
    color: str
    supabase_user_id: str | None
    whatsapp_number: str | None
    is_active: bool


class PersonUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    color: str | None = Field(default=None, max_length=20)
    supabase_user_id: str | None = None
    whatsapp_number: str | None = None
    is_active: bool | None = None


class TagCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    slug: str = Field(min_length=1, max_length=60, pattern=r"^[a-z0-9_]+$")
    color: str = Field(default="#6B7280", max_length=20)


class TagRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    slug: str
    color: str


class TagUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    color: str | None = Field(default=None, max_length=20)
