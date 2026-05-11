from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel
from sqlmodel import Session

from app.api.deps import get_current_user
from app.core.config import settings
from app.db.session import get_session
from app.services import google_oauth

router = APIRouter(prefix="/settings", tags=["settings"], dependencies=[Depends(get_current_user)])


class ConnectPayload(BaseModel):
    code: str


@router.get("/google/auth-url")
def get_google_auth_url() -> dict:
    if not settings.google_client_id:
        raise HTTPException(status_code=503, detail="Integração Google não configurada no servidor")
    redirect_uri = f"{settings.frontend_url.rstrip('/')}/configuracoes/google/callback"
    return {"url": google_oauth.get_auth_url(redirect_uri)}


@router.post("/google/connect")
def connect_google(
    payload: ConnectPayload,
    session: Session = Depends(get_session),
) -> dict:
    redirect_uri = f"{settings.frontend_url.rstrip('/')}/configuracoes/google/callback"
    try:
        email = google_oauth.connect(payload.code, redirect_uri, session)
    except google_oauth.GoogleOAuthError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return {"connected": True, "email": email}


@router.delete("/google/disconnect", status_code=status.HTTP_204_NO_CONTENT)
def disconnect_google(session: Session = Depends(get_session)) -> Response:
    google_oauth.disconnect(session)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/google/status")
def google_status(session: Session = Depends(get_session)) -> dict:
    return google_oauth.get_status(session)
