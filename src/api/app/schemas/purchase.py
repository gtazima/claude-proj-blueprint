from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, HttpUrl


class PurchaseItemLinkRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    url: str
    created_at: datetime


class PurchaseItemCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    notes: str | None = Field(default=None, max_length=2000)
    links: list[str] = Field(default_factory=list)


class PurchaseItemUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    notes: str | None = None


class PurchaseItemRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    name: str
    notes: str | None
    status: str
    created_at: datetime
    bought_at: datetime | None
    links: list[PurchaseItemLinkRead] = Field(default_factory=list)


class AddLinkPayload(BaseModel):
    url: str = Field(min_length=1, max_length=2000)
