from __future__ import annotations

from collections.abc import Generator
from pathlib import Path

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import Session, sessionmaker

from northlight.models import Base
from northlight.settings import get_settings


def database_url() -> str:
    settings = get_settings()
    settings.runtime_root.mkdir(parents=True, exist_ok=True)
    path = (settings.runtime_root / "northlight.sqlite3").resolve()
    return f"sqlite:///{path}"


engine = create_engine(database_url(), connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)


def initialize_database() -> None:
    Base.metadata.create_all(engine)
    columns = {item["name"] for item in inspect(engine).get_columns("report_versions")}
    if "run_id" not in columns:
        with engine.begin() as connection:
            connection.execute(text("ALTER TABLE report_versions ADD COLUMN run_id VARCHAR(36)"))
    skill_columns = {item["name"] for item in inspect(engine).get_columns("installed_skills")}
    if "default_for_new_projects" not in skill_columns:
        with engine.begin() as connection:
            connection.execute(
                text(
                    "ALTER TABLE installed_skills ADD COLUMN "
                    "default_for_new_projects BOOLEAN NOT NULL DEFAULT 0"
                )
            )


def session_scope() -> Generator[Session, None, None]:
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


def metadata_path() -> Path:
    return get_settings().runtime_root / "northlight.sqlite3"
