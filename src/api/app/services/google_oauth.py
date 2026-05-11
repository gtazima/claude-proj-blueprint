"""
Serviço de autenticação OAuth 2.0 com Google.
Tokens armazenados criptografados em PropertySettings (nível da propriedade, não do usuário).
"""

import logging
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode

import httpx
from cryptography.fernet import Fernet, InvalidToken
from sqlmodel import Session, select

from app.core.config import settings
from app.models.property_settings import PropertySettings

logger = logging.getLogger(__name__)

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"

SCOPES = [
    "https://www.googleapis.com/auth/tasks",
    "https://www.googleapis.com/auth/calendar.readonly",
    "openid",
    "email",
]


class GoogleOAuthError(Exception):
    pass


def _fernet() -> Fernet:
    key = settings.google_oauth_encryption_key
    if not key:
        raise GoogleOAuthError("GOOGLE_OAUTH_ENCRYPTION_KEY não configurado")
    return Fernet(key.encode() if isinstance(key, str) else key)


def _encrypt(value: str) -> str:
    return _fernet().encrypt(value.encode()).decode()


def _decrypt(value: str) -> str:
    try:
        return _fernet().decrypt(value.encode()).decode()
    except InvalidToken as e:
        raise GoogleOAuthError("Falha ao descriptografar token — chave incorreta ou token corrompido") from e


def _get_or_create_settings(session: Session) -> PropertySettings:
    prop = session.get(PropertySettings, "default")
    if prop is None:
        prop = PropertySettings(id="default")
        session.add(prop)
        session.commit()
        session.refresh(prop)
    return prop


def get_auth_url(redirect_uri: str) -> str:
    if not settings.google_client_id:
        raise GoogleOAuthError("GOOGLE_CLIENT_ID não configurado")
    params = {
        "client_id": settings.google_client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": " ".join(SCOPES),
        "access_type": "offline",
        "prompt": "consent",
    }
    return f"{GOOGLE_AUTH_URL}?{urlencode(params)}"


def connect(code: str, redirect_uri: str, session: Session) -> str:
    """Troca o authorization code por tokens e persiste criptografado. Retorna o email conectado."""
    if not settings.google_client_id or not settings.google_client_secret:
        raise GoogleOAuthError("Credenciais Google não configuradas")

    resp = httpx.post(GOOGLE_TOKEN_URL, data={
        "code": code,
        "client_id": settings.google_client_id,
        "client_secret": settings.google_client_secret,
        "redirect_uri": redirect_uri,
        "grant_type": "authorization_code",
    }, timeout=15)

    if resp.status_code != 200:
        raise GoogleOAuthError(f"Erro ao trocar código: {resp.text}")

    token_data = resp.json()
    access_token = token_data["access_token"]
    refresh_token = token_data.get("refresh_token")
    expires_in = token_data.get("expires_in", 3600)

    # Busca e-mail da conta conectada
    user_resp = httpx.get(GOOGLE_USERINFO_URL,
                          headers={"Authorization": f"Bearer {access_token}"}, timeout=10)
    email = user_resp.json().get("email", "") if user_resp.status_code == 200 else ""

    prop = _get_or_create_settings(session)
    prop.google_access_token = _encrypt(access_token)
    if refresh_token:
        prop.google_refresh_token = _encrypt(refresh_token)
    prop.google_token_expiry = datetime.now(timezone.utc) + timedelta(seconds=expires_in - 60)
    prop.google_connected_email = email
    prop.updated_at = datetime.now(timezone.utc)

    session.add(prop)
    session.commit()
    return email


def disconnect(session: Session) -> None:
    prop = _get_or_create_settings(session)
    prop.google_access_token = None
    prop.google_refresh_token = None
    prop.google_token_expiry = None
    prop.google_connected_email = None
    prop.google_tasks_list_id = None
    prop.google_memory_list_id = None
    prop.google_last_poll_token = None
    prop.google_last_sync_at = None
    prop.updated_at = datetime.now(timezone.utc)
    session.add(prop)
    session.commit()


def get_valid_access_token(session: Session) -> str:
    """Retorna access token válido, renovando via refresh_token se necessário."""
    prop = session.get(PropertySettings, "default")
    if not prop or not prop.google_access_token:
        raise GoogleOAuthError("Conta Google não conectada")

    now = datetime.now(timezone.utc)
    token_expiry = prop.google_token_expiry
    if token_expiry and token_expiry.tzinfo is None:
        token_expiry = token_expiry.replace(tzinfo=timezone.utc)

    if token_expiry and now < token_expiry:
        return _decrypt(prop.google_access_token)

    # Token expirado — renovar
    if not prop.google_refresh_token:
        raise GoogleOAuthError("Token expirado e sem refresh_token — reconecte a conta Google")

    refresh_token = _decrypt(prop.google_refresh_token)
    resp = httpx.post(GOOGLE_TOKEN_URL, data={
        "client_id": settings.google_client_id,
        "client_secret": settings.google_client_secret,
        "refresh_token": refresh_token,
        "grant_type": "refresh_token",
    }, timeout=15)

    if resp.status_code != 200:
        raise GoogleOAuthError(f"Falha ao renovar token: {resp.text}")

    token_data = resp.json()
    new_access = token_data["access_token"]
    expires_in = token_data.get("expires_in", 3600)

    prop.google_access_token = _encrypt(new_access)
    prop.google_token_expiry = now + timedelta(seconds=expires_in - 60)
    prop.updated_at = now
    session.add(prop)
    session.commit()

    return new_access


def get_status(session: Session) -> dict:
    prop = session.get(PropertySettings, "default")
    if not prop or not prop.google_access_token:
        return {"connected": False, "email": None}
    return {
        "connected": True,
        "email": prop.google_connected_email,
        "sync_enabled": settings.feature_google_sync_enabled,
    }
