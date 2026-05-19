from datetime import datetime, timezone
from uuid import UUID, uuid4

from sqlmodel import Field, SQLModel


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class PurchaseItem(SQLModel, table=True):
    __tablename__ = "purchase_items"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    name: str = Field(min_length=1, max_length=200, index=True)
    notes: str | None = Field(default=None, max_length=2000)
    status: str = Field(default="to_buy", max_length=20)  # "to_buy" | "bought"
    created_at: datetime = Field(default_factory=utcnow, nullable=False)
    bought_at: datetime | None = Field(default=None)
    google_task_id: str | None = Field(default=None, max_length=200)


class PurchaseItemLink(SQLModel, table=True):
    __tablename__ = "purchase_item_links"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    purchase_item_id: UUID = Field(foreign_key="purchase_items.id", index=True)
    url: str = Field(min_length=1, max_length=2000)
    created_at: datetime = Field(default_factory=utcnow, nullable=False)
