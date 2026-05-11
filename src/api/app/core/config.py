from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "sqlite:///./agroecologia.db"
    completion_undo_window_seconds: int = 300
    allowed_origins: str = "http://localhost:5173,http://localhost:5174"
    supabase_url: str = ""
    frontend_url: str = "http://localhost:5173"

    # Google OAuth
    google_client_id: str = ""
    google_client_secret: str = ""
    google_oauth_encryption_key: str = ""  # Fernet key: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

    # Worker de sync
    feature_google_sync_enabled: bool = False
    google_sync_poll_interval_seconds: int = 60

    def get_allowed_origins(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]


settings = Settings()
