from __future__ import annotations

import json
import os
import sqlite3
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import duckdb
import pandas as pd
from sqlalchemy import create_engine, inspect, text

from northlight.domain import SourceType
from northlight.models import Source
from northlight.repository import Repository
from northlight.serialization import frame_records
from northlight.settings import get_settings
from northlight.workspace import copy_source, project_root, sha256


def frame_profile(frame: pd.DataFrame, sample_rows: int = 5) -> dict[str, Any]:
    return {
        "rows": int(len(frame)),
        "columns": int(len(frame.columns)),
        "fields": [
            {
                "name": str(column),
                "dtype": str(frame[column].dtype),
                "nulls": int(frame[column].isna().sum()),
                "unique": int(frame[column].nunique(dropna=True)),
            }
            for column in frame.columns
        ],
        "sample": frame_records(frame, sample_rows),
    }


def profile_metadata(sample_strategy: str) -> dict[str, str]:
    return {
        "profiled_at": datetime.now(UTC).isoformat(),
        "sample_strategy": sample_strategy,
    }


def profile_csv(path: Path) -> dict[str, Any]:
    relation = duckdb.read_csv(str(path), sample_size=100_000)
    frame = relation.limit(10_000).df()
    profile = frame_profile(frame)
    count_row = relation.aggregate("count(*) as count").fetchone()
    if count_row is None:
        raise ValueError("CSV row count query returned no result")
    profile["rows"] = int(count_row[0])
    profile["format"] = "csv"
    profile.update(profile_metadata("full row count; field statistics over first 10,000 rows"))
    return profile


def profile_excel(path: Path) -> dict[str, Any]:
    workbook = pd.ExcelFile(path)
    sheets: list[dict[str, Any]] = []
    for name in workbook.sheet_names:
        frame = pd.read_excel(path, sheet_name=name)
        sheets.append({"name": name, **frame_profile(frame)})
    return {
        "format": "excel",
        "sheets": sheets,
        "sheet_count": len(sheets),
        **profile_metadata("full workbook profile; first 5 rows per sheet retained as preview"),
    }


def profile_sqlite(path: Path) -> dict[str, Any]:
    uri = f"file:{path.resolve()}?mode=ro"
    connection = sqlite3.connect(uri, uri=True)
    try:
        tables = [
            row[0]
            for row in connection.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
            )
        ]
        result = []
        for table in tables:
            escaped = table.replace('"', '""')
            schema_rows = list(connection.execute(f'PRAGMA table_info("{escaped}")'))
            fields = []
            for row in schema_rows:
                column = str(row[1])
                quoted_column = column.replace('"', '""')
                nulls, unique = connection.execute(
                    f'SELECT SUM(CASE WHEN "{quoted_column}" IS NULL THEN 1 ELSE 0 END), '
                    f'COUNT(DISTINCT "{quoted_column}") FROM "{escaped}"'
                ).fetchone()
                fields.append(
                    {
                        "name": column,
                        "dtype": row[2],
                        "nullable": not bool(row[3]),
                        "pk": bool(row[5]),
                        "nulls": int(nulls or 0),
                        "unique": int(unique or 0),
                    }
                )
            count = connection.execute(f'SELECT COUNT(*) FROM "{escaped}"').fetchone()[0]
            sample = pd.read_sql_query(f'SELECT * FROM "{escaped}" LIMIT 5', connection)
            result.append(
                {
                    "name": table,
                    "rows": int(count),
                    "fields": fields,
                    "sample": frame_records(sample, 5),
                }
            )
        return {
            "format": "sqlite",
            "tables": result,
            "table_count": len(result),
            **profile_metadata("full null and distinct counts; first 5 rows per table retained"),
        }
    finally:
        connection.close()


def inspect_mysql_catalog(url: str) -> dict[str, Any]:
    engine = create_engine(url, pool_pre_ping=True)
    inspector = inspect(engine)
    tables: list[dict[str, Any]] = []
    try:
        with engine.connect() as connection:
            connection.execute(text("SET SESSION TRANSACTION READ ONLY"))
            for table in inspector.get_table_names():
                quoted = f"`{table.replace('`', '``')}`"
                count = connection.execute(text(f"SELECT COUNT(*) FROM {quoted}")).scalar_one()
                columns = [
                    {
                        "name": str(column["name"]),
                        "dtype": str(column["type"]),
                        "nullable": bool(column["nullable"]),
                    }
                    for column in inspector.get_columns(table)
                ]
                tables.append({"name": table, "rows": int(count), "columns": columns})
        return {"database": str(engine.url.database or ""), "tables": tables}
    finally:
        engine.dispose()


def profile_mysql(url: str, table_names: list[str] | None = None) -> dict[str, Any]:
    engine = create_engine(url, pool_pre_ping=True)
    inspector = inspect(engine)
    tables = []
    available = inspector.get_table_names()
    selected = list(dict.fromkeys(table_names or available))
    unknown = sorted(set(selected) - set(available))
    if unknown:
        engine.dispose()
        raise ValueError(f"MySQL tables do not exist: {unknown}")
    if not selected:
        engine.dispose()
        raise ValueError("Select at least one MySQL table")
    try:
        with engine.connect() as connection:
            connection.execute(text("SET SESSION TRANSACTION READ ONLY"))
            for table in selected:
                quoted = f"`{table.replace('`', '``')}`"
                count = connection.execute(text(f"SELECT COUNT(*) FROM {quoted}")).scalar_one()
                fields = []
                for column in inspector.get_columns(table):
                    name = str(column["name"])
                    quoted_column = f"`{name.replace('`', '``')}`"
                    statistics = connection.execute(
                        text(
                            f"SELECT SUM(CASE WHEN {quoted_column} IS NULL THEN 1 ELSE 0 END), "
                            f"COUNT(DISTINCT {quoted_column}) FROM {quoted}"
                        )
                    ).one()
                    fields.append(
                        {
                            "name": name,
                            "dtype": str(column["type"]),
                            "nullable": bool(column["nullable"]),
                            "nulls": int(statistics[0] or 0),
                            "unique": int(statistics[1] or 0),
                        }
                    )
                sample = pd.read_sql_query(text(f"SELECT * FROM {quoted} LIMIT 5"), connection)
                tables.append(
                    {
                        "name": table,
                        "rows": int(count),
                        "fields": fields,
                        "sample": frame_records(sample, 5),
                    }
                )
    finally:
        engine.dispose()
    return {
        "format": "mysql",
        "database": engine.url.database,
        "tables": tables,
        "table_count": len(tables),
        **profile_metadata("full null and distinct counts; first 5 rows per table retained"),
    }


class DataSourceService:
    def __init__(self, repository: Repository):
        self.repository = repository

    def attach_file(
        self,
        project_id: str,
        source_type: SourceType,
        upload: Path,
        original_name: str | None = None,
    ) -> Source:
        if source_type not in {SourceType.CSV, SourceType.EXCEL, SourceType.SQLITE}:
            raise ValueError(f"File attachment does not support {source_type}")
        expected_suffixes = {
            SourceType.CSV: {".csv"},
            SourceType.EXCEL: {".xlsx", ".xls"},
            SourceType.SQLITE: {".sqlite", ".sqlite3", ".db"},
        }[source_type]
        suffix = Path(original_name or upload.name).suffix.lower()
        if suffix not in expected_suffixes:
            raise ValueError(
                f"File extension {suffix or '<none>'} does not match {source_type.value}"
            )
        existing_bytes = sum(
            source_bytes(source.baseline)
            for source in self.repository.list_sources(project_id)
            if source.type
            in {SourceType.CSV.value, SourceType.EXCEL.value, SourceType.SQLITE.value}
        )
        if existing_bytes + upload.stat().st_size > get_settings().max_project_source_bytes:
            raise ValueError("Project source files exceed the configured 2 GB default limit")
        copied = copy_source(project_id, upload, original_name)
        fingerprint = sha256(copied)
        source = self.repository.add_source(
            project_id,
            source_type.value,
            copied.name,
            fingerprint,
            {"path": str(copied)},
            {
                "format": source_type.value,
                "bytes": copied.stat().st_size,
                "profiled_at": None,
            },
            status="pending",
        )
        source.status = "profiling"
        self.repository.session.commit()
        try:
            baseline = {
                SourceType.CSV: profile_csv,
                SourceType.EXCEL: profile_excel,
                SourceType.SQLITE: profile_sqlite,
            }[source_type](copied)
            baseline["source_sha256"] = fingerprint
            baseline["bytes"] = copied.stat().st_size
            source.baseline = baseline
            source.status = "ready"
            self.repository.session.commit()
            return source
        except Exception as exc:
            source.status = "failed"
            source.baseline = {
                **source.baseline,
                "profile_error": type(exc).__name__,
                "failed_at": datetime.now(UTC).isoformat(),
            }
            self.repository.session.commit()
            raise

    def attach_mysql(
        self,
        project_id: str,
        name: str,
        connection_url: str,
        table_names: list[str] | None = None,
    ) -> Source:
        # Store only an environment alias; never persist a password-bearing URL.
        source = self.repository.add_source(
            project_id,
            SourceType.MYSQL.value,
            name,
            "",
            {"connection_env": "pending"},
            {"format": "mysql", "profiled_at": None},
            status="pending",
        )
        connection_env = f"NORTHLIGHT_MYSQL_SOURCE_{source.id.replace('-', '_').upper()}"
        os.environ[connection_env] = connection_url
        source.config = {"connection_env": connection_env, "tables": table_names or []}
        source.status = "profiling"
        self.repository.session.commit()
        try:
            baseline = (
                profile_mysql(connection_url, table_names)
                if table_names
                else profile_mysql(connection_url)
            )
            fingerprint = sha256_text(
                str([(table["name"], table["rows"]) for table in baseline["tables"]])
            )
            source.baseline = baseline
            source.fingerprint = fingerprint
            source.status = "ready"
            self.repository.session.commit()
            return source
        except Exception as exc:
            source.status = "failed"
            source.baseline = {
                **source.baseline,
                "profile_error": type(exc).__name__,
                "failed_at": datetime.now(UTC).isoformat(),
            }
            self.repository.session.commit()
            raise

    def check_change(self, project_id: str, source_id: str) -> Source:
        source = self.repository.get_source(project_id, source_id)
        _, fingerprint = self._profile_and_fingerprint(source)
        source.status = "ready" if fingerprint == source.fingerprint else "changed"
        source.config = {**source.config, "latest_fingerprint": fingerprint}
        self.repository.session.commit()
        return source

    def reprofile(self, project_id: str, source_id: str) -> Source:
        source = self.repository.get_source(project_id, source_id)
        baseline, fingerprint = self._profile_and_fingerprint(source)
        root = project_root(project_id)
        snapshot = root / "sources" / f"{source.id}-{source.fingerprint[:12]}.baseline.json"
        snapshot.write_text(
            json.dumps(
                {
                    "schema_version": 1,
                    "source_id": source.id,
                    "source_name": source.name,
                    "source_type": source.type,
                    "fingerprint": source.fingerprint,
                    "baseline": source.baseline,
                    "superseded_at": datetime.now(UTC).isoformat(),
                },
                ensure_ascii=False,
                indent=2,
            )
            + "\n",
            encoding="utf-8",
        )
        self.repository.add_artifact(
            project_id,
            "source_baseline",
            f"{source.name} · baseline {source.fingerprint[:12]}",
            snapshot,
            {"source_id": source.id, "fingerprint": source.fingerprint},
            [source.id],
        )
        source.baseline = baseline
        source.fingerprint = fingerprint
        source.status = "ready"
        source.config = {
            key: value for key, value in source.config.items() if key != "latest_fingerprint"
        }
        self.repository.session.commit()
        return source

    def _profile_and_fingerprint(self, source: Source) -> tuple[dict[str, Any], str]:
        if source.type in {SourceType.CSV.value, SourceType.EXCEL.value, SourceType.SQLITE.value}:
            path = Path(str(source.config["path"]))
            profile = {
                SourceType.CSV.value: profile_csv,
                SourceType.EXCEL.value: profile_excel,
                SourceType.SQLITE.value: profile_sqlite,
            }[source.type](path)
            fingerprint = sha256(path)
            profile["source_sha256"] = fingerprint
            profile["bytes"] = path.stat().st_size
            return profile, fingerprint
        if source.type == SourceType.MYSQL.value:
            connection_url = os.getenv(str(source.config.get("connection_env", "")))
            if not connection_url:
                raise RuntimeError("MySQL connection is not available in the current process")
            raw_tables = source.config.get("tables", [])
            table_names = [str(item) for item in raw_tables] if isinstance(raw_tables, list) else []
            profile = (
                profile_mysql(connection_url, table_names)
                if table_names
                else profile_mysql(connection_url)
            )
            fingerprint = sha256_text(
                str([(table["name"], table["rows"]) for table in profile["tables"]])
            )
            return profile, fingerprint
        raise ValueError(f"Unsupported source type: {source.type}")


def sha256_text(value: str) -> str:
    import hashlib

    return hashlib.sha256(value.encode()).hexdigest()


def source_bytes(baseline: dict[str, object]) -> int:
    value = baseline.get("bytes", 0)
    return value if isinstance(value, int) else 0
