from __future__ import annotations

import os
import shutil
import tempfile
from collections.abc import Generator
from pathlib import Path

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

TEST_RUNTIME = Path(tempfile.mkdtemp(prefix="northlight-tests-"))
os.environ["NORTHLIGHT_RUNTIME_ROOT"] = str(TEST_RUNTIME)

from northlight.models import Base  # noqa: E402


@pytest.fixture
def session() -> Generator[Session, None, None]:
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    with Session(engine, expire_on_commit=False) as value:
        yield value
    engine.dispose()


def pytest_sessionfinish() -> None:
    shutil.rmtree(TEST_RUNTIME, ignore_errors=True)
