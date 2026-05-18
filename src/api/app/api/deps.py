from collections.abc import Generator

import jwt as pyjwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWKClient
from sqlmodel import Session

from app.core.config import settings
from app.db.session import get_session
from app.services.field_notes import FieldNoteService
from app.services.tasks import TaskService

_bearer = HTTPBearer()
_jwks_client: PyJWKClient | None = None


def _get_jwks_client() -> PyJWKClient:
    global _jwks_client
    if _jwks_client is None:
        jwks_url = f"{settings.supabase_url.rstrip('/')}/auth/v1/.well-known/jwks.json"
        _jwks_client = PyJWKClient(jwks_url, cache_jwk_set=True, lifespan=300)
    return _jwks_client


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
) -> dict:
    if not settings.supabase_url:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="SUPABASE_URL não configurado no servidor",
        )
    try:
        client = _get_jwks_client()
        signing_key = client.get_signing_key_from_jwt(credentials.credentials)
        payload = pyjwt.decode(
            credentials.credentials,
            signing_key.key,
            algorithms=["RS256", "ES256"],
            audience="authenticated",
        )
        return payload
    except pyjwt.ExpiredSignatureError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Sessão expirada") from e
    except pyjwt.InvalidTokenError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido") from e


def get_task_service(session: Session = Depends(get_session)) -> Generator[TaskService, None, None]:
    yield TaskService(session)


def get_field_note_service(session: Session = Depends(get_session)) -> Generator[FieldNoteService, None, None]:
    yield FieldNoteService(session)
