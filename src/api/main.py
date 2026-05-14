import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.deps import get_current_user
from app.api.routes import config as config_router
from app.api.routes import settings as settings_router
from app.api.routes import tasks
from app.core.config import settings
from app.db.session import Session, engine, init_db
from app.services.config import seed_config
from app.services.google_sync import run_sync_cycle

logger = logging.getLogger(__name__)


async def _google_sync_loop() -> None:
    while True:
        try:
            with Session(engine) as session:
                run_sync_cycle(session)
        except Exception:
            logger.exception("Erro no ciclo de sync Google")
        await asyncio.sleep(settings.google_sync_poll_interval_seconds)


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    with Session(engine) as session:
        seed_config(session)
    sync_task = None
    if settings.feature_google_sync_enabled:
        sync_task = asyncio.create_task(_google_sync_loop())
    yield
    if sync_task:
        sync_task.cancel()


app = FastAPI(title="AgroecologIA API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(tasks.router, prefix="/api", dependencies=[Depends(get_current_user)])
app.include_router(settings_router.router, prefix="/api")
app.include_router(config_router.router, prefix="/api")


@app.get("/health")
def health():
    return {"status": "ok"}
