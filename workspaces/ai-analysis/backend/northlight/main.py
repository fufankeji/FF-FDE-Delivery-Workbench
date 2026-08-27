from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from northlight.agent_runtime import close_agent_checkpointer
from northlight.api import router
from northlight.connection_settings import (
    load_runtime_credentials,
    restore_legacy_local_mysql_aliases,
)
from northlight.database import SessionLocal, initialize_database
from northlight.model_jobs import model_job_manager
from northlight.models import Source
from northlight.repository import Repository
from northlight.skill_service import SkillService


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    load_runtime_credentials()
    initialize_database()
    with SessionLocal() as session:
        repository = Repository(session)
        SkillService(repository).install_builtins()
        restore_legacy_local_mysql_aliases(
            [*repository.list_data_assets(), *session.query(Source).all()]
        )
    try:
        yield
    finally:
        model_job_manager.shutdown()
        close_agent_checkpointer()


app = FastAPI(title="Northlight API", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_origin_regex=(
        r"https?://(?:localhost|127\.0\.0\.1|10(?:\.\d{1,3}){3}|"
        r"192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2})"
        r"(?::\d{1,5})?"
    ),
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Content-Type", "Authorization"],
)
app.include_router(router)
