from datetime import datetime, timezone

from sqlmodel import Field, SQLModel


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class PropertySettings(SQLModel, table=True):
    __tablename__ = "property_settings"

    id: str = Field(default="default", primary_key=True)

    # Google OAuth — tokens armazenados criptografados (Fernet AES-256)
    google_access_token: str | None = Field(default=None)
    google_refresh_token: str | None = Field(default=None)
    google_token_expiry: datetime | None = Field(default=None)
    google_connected_email: str | None = Field(default=None, max_length=200)

    # IDs das listas no Google Tasks (criadas na primeira autenticação)
    google_tasks_list_id: str | None = Field(default=None, max_length=200)
    google_memory_list_id: str | None = Field(default=None, max_length=200)

    # Controle de sync incremental
    google_last_sync_at: datetime | None = Field(default=None)
    google_last_poll_token: str | None = Field(default=None)  # nextSyncToken do Calendar

    updated_at: datetime = Field(default_factory=utcnow, nullable=False)
