from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="NORTHLIGHT_",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "Northlight"
    runtime_root: Path = Field(default=Path(".runtime"))
    model_name: str = "deepseek-v4-flash"
    model_base_url: str = "https://api.deepseek.com"
    query_row_limit: int = 5_000
    preview_row_limit: int = 200
    query_timeout_seconds: int = 60
    training_timeout_seconds: int = 1_800
    max_upload_bytes: int = 500 * 1024 * 1024
    max_project_source_bytes: int = 2 * 1024 * 1024 * 1024

    @property
    def projects_root(self) -> Path:
        return self.runtime_root / "projects"


@lru_cache
def get_settings() -> Settings:
    return Settings()
