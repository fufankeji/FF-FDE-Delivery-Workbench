from __future__ import annotations

import json
import os
import sqlite3
import threading
import time
from pathlib import Path
from typing import Any, cast
from uuid import uuid4

import duckdb
import pandas as pd
import sqlglot
from sqlalchemy import create_engine, text
from sqlglot import exp

from northlight.models import Artifact
from northlight.repository import Repository
from northlight.serialization import frame_records
from northlight.settings import get_settings
from northlight.workspace import project_root

FORBIDDEN_EXPRESSIONS = (
    exp.Insert,
    exp.Update,
    exp.Delete,
    exp.Create,
    exp.Drop,
    exp.Alter,
    exp.Command,
    exp.Merge,
)


def validate_read_only_sql(sql: str, dialect: str | None = None) -> exp.Expression:
    statements = sqlglot.parse(sql, read=dialect)
    if len(statements) != 1:
        raise ValueError("Exactly one SQL statement is allowed")
    statement = statements[0]
    if statement is None:
        raise ValueError("SQL statement could not be parsed")
    if any(statement.find(kind) is not None for kind in FORBIDDEN_EXPRESSIONS):
        raise ValueError("Only read-only SELECT queries are allowed")
    if not isinstance(statement, (exp.Select, exp.Union)) and statement.find(exp.Select) is None:
        raise ValueError("Only SELECT or WITH ... SELECT queries are allowed")
    return cast(exp.Expression, statement)


def apply_limit(statement: exp.Expression, limit: int, dialect: str | None = None) -> str:
    existing = statement.args.get("limit")
    if existing is None:
        statement = cast(Any, statement).limit(limit)
    else:
        try:
            requested = int(existing.expression.to_py())
        except (AttributeError, TypeError, ValueError):
            requested = limit
        if requested > limit:
            statement = cast(Any, statement).limit(limit)
    return statement.sql(dialect=dialect)


def validate_file_query_scope(
    statement: exp.Expression, registered_tables: set[str] | None = None
) -> None:
    """Limit DuckDB file-source SQL to the registered ``data`` view and its CTEs."""
    cte_names = {
        str(cte.alias_or_name).lower() for cte in statement.find_all(exp.CTE) if cte.alias_or_name
    }
    allowed_tables = {
        "data",
        *cte_names,
        *(name.lower() for name in (registered_tables or set())),
    }
    for table in statement.find_all(exp.Table):
        if not isinstance(table.this, exp.Identifier):
            raise ValueError("File-source queries cannot call DuckDB table functions")
        if table.name.lower() not in allowed_tables:
            raise ValueError("File-source queries may read only the registered data view")


def validate_mysql_query_scope(statement: exp.Expression, registered_tables: set[str]) -> None:
    allowed = {name.lower() for name in registered_tables}
    for table in statement.find_all(exp.Table):
        if table.name.lower() not in allowed:
            raise ValueError("MySQL queries may read only tables imported into this data asset")


class QueryService:
    def __init__(self, repository: Repository):
        self.repository = repository
        self.settings = get_settings()

    def run(
        self,
        project_id: str,
        source_id: str,
        sql: str,
        name: str,
        analysis_dimension: str | None = None,
        business_question: str | None = None,
        finding_label: str | None = None,
        finding_metric: str | None = None,
        finding_unit: str | None = None,
        metric_additive: bool | None = None,
    ) -> Artifact:
        source = self.repository.get_source(project_id, source_id)
        if source.status != "ready":
            raise ValueError("Source changed since profiling; reprofile it before querying")
        dialect = "mysql" if source.type == "mysql" else "sqlite"
        statement = validate_read_only_sql(sql, dialect=dialect)
        if source.type == "csv":
            validate_file_query_scope(statement)
        elif source.type == "excel":
            raw_sheets = source.baseline.get("sheets", [])
            registered_sheets = {
                str(sheet.get("name"))
                for sheet in (raw_sheets if isinstance(raw_sheets, list) else [])
                if isinstance(sheet, dict) and sheet.get("name")
            }
            validate_file_query_scope(statement, registered_sheets)
        elif source.type == "mysql":
            raw_tables = source.baseline.get("tables", [])
            registered_tables = {
                str(item.get("name"))
                for item in (raw_tables if isinstance(raw_tables, list) else [])
                if isinstance(item, dict) and item.get("name")
            }
            validate_mysql_query_scope(statement, registered_tables)
        bounded_sql = apply_limit(statement, self.settings.query_row_limit, dialect=dialect)
        outer_aggregate = statement.args.get("group") is not None or any(
            projection.find(exp.AggFunc) is not None for projection in statement.expressions
        )
        query_shape = "aggregate" if outer_aggregate else "detail"

        if source.type == "csv":
            frame = self._query_csv(Path(str(source.config["path"])), bounded_sql)
        elif source.type == "excel":
            frame = self._query_excel(Path(str(source.config["path"])), bounded_sql)
        elif source.type == "sqlite":
            frame = self._query_sqlite(Path(str(source.config["path"])), bounded_sql)
        elif source.type == "mysql":
            frame = self._query_mysql(source, bounded_sql)
        else:
            raise ValueError(f"Unsupported source type: {source.type}")

        run_id = str(uuid4())
        root = project_root(project_id)
        query_path = root / "queries" / f"{run_id}.sql"
        query_path.write_text(bounded_sql + "\n", encoding="utf-8")
        output = root / "datasets" / "extracts" / f"{run_id}.parquet"
        frame.to_parquet(output, index=False)
        artifact = self.repository.add_artifact(
            project_id,
            "extract",
            name,
            output,
            {
                "source_id": source_id,
                "source_fingerprint": source.fingerprint,
                "query_path": str(query_path.relative_to(root)),
                "rows": len(frame),
                "columns": list(frame.columns),
                "query_shape": query_shape,
                "preview": frame_records(frame, self.settings.preview_row_limit),
                **({"analysis_dimension": analysis_dimension} if analysis_dimension else {}),
                **({"business_question": business_question} if business_question else {}),
                **({"finding_label": finding_label} if finding_label else {}),
                **({"finding_metric": finding_metric} if finding_metric else {}),
                **({"finding_unit": finding_unit} if finding_unit else {}),
                **({"metric_additive": metric_additive} if metric_additive is not None else {}),
            },
            [source_id],
        )
        return artifact

    def _query_csv(self, path: Path, sql: str) -> pd.DataFrame:
        connection = duckdb.connect()
        timer = threading.Timer(self.settings.query_timeout_seconds, connection.interrupt)
        try:
            connection.read_csv(str(path), auto_detect=True).create_view("data")
            timer.start()
            return connection.execute(sql).df()
        finally:
            timer.cancel()
            connection.close()

    def _query_excel(self, path: Path, sql: str) -> pd.DataFrame:
        workbook = pd.read_excel(path, sheet_name=None)
        if not workbook:
            raise ValueError("Excel workbook does not contain a readable sheet")
        connection = duckdb.connect()
        timer = threading.Timer(self.settings.query_timeout_seconds, connection.interrupt)
        try:
            for sheet_name, frame in workbook.items():
                connection.register(str(sheet_name), frame)
            first_name = next(iter(workbook))
            if first_name != "data":
                connection.register("data", workbook[first_name])
            timer.start()
            return connection.execute(sql).df()
        finally:
            timer.cancel()
            connection.close()

    def _query_sqlite(self, path: Path, sql: str) -> pd.DataFrame:
        connection = sqlite3.connect(f"file:{path.resolve()}?mode=ro", uri=True)
        try:
            connection.execute(f"PRAGMA busy_timeout={self.settings.query_timeout_seconds * 1000}")
            deadline = time.monotonic() + self.settings.query_timeout_seconds
            connection.set_progress_handler(lambda: int(time.monotonic() >= deadline), 1_000)
            return pd.read_sql_query(sql, connection)
        finally:
            connection.set_progress_handler(None, 0)
            connection.close()

    def _query_mysql(self, source: Any, sql: str) -> pd.DataFrame:
        connection_env = str(source.config.get("connection_env", ""))
        url = os.getenv(connection_env)
        if not url:
            raise RuntimeError(f"MySQL credential alias is not available: {connection_env}")
        engine = create_engine(url, pool_pre_ping=True)
        try:
            with engine.connect() as connection:
                connection.execute(text("SET SESSION TRANSACTION READ ONLY"))
                connection.execute(
                    text(
                        f"SET SESSION MAX_EXECUTION_TIME={self.settings.query_timeout_seconds * 1000}"
                    )
                )
                return pd.read_sql_query(text(sql), connection)
        finally:
            engine.dispose()


def artifact_preview(
    repository: Repository, project_id: str, artifact_id: str
) -> dict[str, object]:
    artifact = repository.get_artifact(project_id, artifact_id)
    return {
        "id": artifact.id,
        "name": artifact.name,
        "type": artifact.type,
        "metadata": artifact.artifact_metadata,
        "lineage": artifact.lineage,
    }


def write_chart_spec(
    repository: Repository,
    project_id: str,
    artifact_id: str,
    chart_type: str,
    x: str,
    y: list[str],
    title: str,
) -> Artifact:
    source = repository.get_artifact(project_id, artifact_id)
    allowed = {"bar", "line", "area", "scatter", "pie", "boxplot", "heatmap"}
    if chart_type not in allowed:
        raise ValueError(f"Unsupported chart type: {chart_type}")
    raw_columns = source.artifact_metadata.get("columns", [])
    if not isinstance(raw_columns, list):
        raise ValueError("Source artifact does not expose a valid column list")
    columns = {str(column) for column in raw_columns}
    if x not in columns or any(value not in columns for value in y):
        raise ValueError("Chart fields must exist in the source artifact")
    raw_rows = source.artifact_metadata.get("rows")
    if isinstance(raw_rows, (int, float)):
        rows_known = True
        total_rows = int(raw_rows)
    else:
        rows_known = False
        total_rows = 0
    max_points = 500
    rows_used = min(total_rows, max_points) if rows_known else max_points
    data_scope = {
        "total_rows": total_rows if rows_known else None,
        "rows_used": rows_used,
        "truncated": bool(rows_known and total_rows > max_points),
        "strategy": "first_rows" if rows_known and total_rows > max_points else "complete_result",
        "max_points": max_points,
    }
    spec = {
        "schema_version": 1,
        "chart_type": chart_type,
        "title": title,
        "dataset_artifact_id": artifact_id,
        "encoding": {"x": x, "y": y},
        "theme": "northlight",
        "data_scope": data_scope,
    }
    path = project_root(project_id) / "visuals" / f"{uuid4()}.json"
    path.write_text(json.dumps(spec, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return repository.add_artifact(
        project_id,
        "visual",
        title,
        path,
        {"chart_type": chart_type, "x": x, "y": y, "data_scope": data_scope},
        [artifact_id],
    )
