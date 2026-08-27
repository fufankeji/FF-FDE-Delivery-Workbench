import os
import sqlite3
from pathlib import Path

import pandas as pd
import pytest
from northlight import data_sources
from northlight.api import artifact_data, visual_data
from northlight.data_sources import DataSourceService
from northlight.domain import SourceType
from northlight.query_service import (
    QueryService,
    apply_limit,
    validate_file_query_scope,
    validate_mysql_query_scope,
    validate_read_only_sql,
    write_chart_spec,
)
from northlight.repository import Repository
from northlight.settings import Settings
from northlight.workspace import project_root
from sqlalchemy.orm import Session


def test_csv_profile_query_and_chart_are_traceable(tmp_path: Path, session: Session) -> None:
    csv_path = tmp_path / "orders.csv"
    csv_path.write_text("state,revenue\nSP,12\nRJ,7\nSP,8\n", encoding="utf-8")
    repository = Repository(session)
    project = repository.create_project("Orders")
    source = DataSourceService(repository).attach_file(project.id, SourceType.CSV, csv_path)
    assert source.baseline["rows"] == 3
    artifact = QueryService(repository).run(
        project.id,
        source.id,
        "SELECT state, SUM(revenue) AS revenue FROM data GROUP BY state ORDER BY revenue DESC",
        "Revenue by state",
    )
    assert artifact.artifact_metadata["rows"] == 2
    assert artifact.artifact_metadata["source_fingerprint"] == source.fingerprint
    assert (project_root(project.id) / artifact.path).is_file()
    chart = write_chart_spec(
        repository, project.id, artifact.id, "bar", "state", ["revenue"], "Revenue by state"
    )
    assert chart.lineage == [artifact.id]
    scope = chart.artifact_metadata["data_scope"]
    assert scope == {
        "total_rows": 2,
        "rows_used": 2,
        "truncated": False,
        "strategy": "complete_result",
        "max_points": 500,
    }
    chart_data = visual_data(project.id, chart.id, repository)
    assert chart_data["rows"] == [
        {"state": "SP", "revenue": 20.0},
        {"state": "RJ", "revenue": 7.0},
    ]
    assert chart_data["scope"]["rows_used"] == 2  # type: ignore[index]

    empty = QueryService(repository).run(
        project.id, source.id, "SELECT * FROM data WHERE revenue < 0", "Empty result"
    )
    empty_chart = write_chart_spec(
        repository, project.id, empty.id, "bar", "state", ["revenue"], "Empty chart"
    )
    assert empty_chart.artifact_metadata["data_scope"] == {
        "total_rows": 0,
        "rows_used": 0,
        "truncated": False,
        "strategy": "complete_result",
        "max_points": 500,
    }


def test_query_shape_uses_outer_select_not_aggregate_cte(
    tmp_path: Path, session: Session
) -> None:
    csv_path = tmp_path / "orders.csv"
    csv_path.write_text("state,revenue\nSP,12\nRJ,7\nSP,8\n", encoding="utf-8")
    repository = Repository(session)
    project = repository.create_project("Outer query shape")
    source = DataSourceService(repository).attach_file(project.id, SourceType.CSV, csv_path)

    detail = QueryService(repository).run(
        project.id,
        source.id,
        "WITH totals AS (SELECT state, SUM(revenue) total FROM data GROUP BY state) "
        "SELECT d.state, d.revenue FROM data d JOIN totals t USING (state)",
        "Detail rows after aggregate CTE",
    )

    assert detail.artifact_metadata["query_shape"] == "detail"


def test_read_only_sql_rejects_writes_and_multiple_statements() -> None:
    for sql in ("DELETE FROM data", "SELECT * FROM data; DROP TABLE data"):
        try:
            validate_read_only_sql(sql)
        except ValueError:
            pass
        else:
            raise AssertionError(f"unsafe SQL accepted: {sql}")


def test_artifact_data_supports_server_paging_sort_and_literal_filter(
    tmp_path: Path, session: Session
) -> None:
    csv_path = tmp_path / "orders.csv"
    csv_path.write_text("state,revenue\nSP,12\nRJ,7\nSC,9\nSP,8\n", encoding="utf-8")
    repository = Repository(session)
    project = repository.create_project("Interactive result")
    source = DataSourceService(repository).attach_file(project.id, SourceType.CSV, csv_path)
    artifact = QueryService(repository).run(project.id, source.id, "SELECT * FROM data", "Orders")

    page = artifact_data(
        project.id,
        artifact.id,
        repository,
        limit=1,
        offset=1,
        sort_by="revenue",
        sort_order="desc",
        filter_column="state",
        filter_value="SP",
    )

    assert page["total"] == 2
    assert page["rows"] == [{"state": "SP", "revenue": 8}]


def test_file_query_scope_rejects_host_file_table_functions() -> None:
    statement = validate_read_only_sql("SELECT content FROM read_text('/etc/hosts')")
    try:
        validate_file_query_scope(statement)
    except ValueError as exc:
        assert "table functions" in str(exc)
    else:
        raise AssertionError("DuckDB host-file table function was accepted")
    validate_file_query_scope(
        validate_read_only_sql("WITH totals AS (SELECT state FROM data) SELECT * FROM totals")
    )


def test_excel_query_can_select_and_join_registered_sheets(
    tmp_path: Path, session: Session
) -> None:
    workbook = tmp_path / "orders.xlsx"
    with pd.ExcelWriter(workbook) as writer:
        pd.DataFrame(
            [{"order_id": 1, "customer_id": 10}, {"order_id": 2, "customer_id": 11}]
        ).to_excel(writer, sheet_name="orders", index=False)
        pd.DataFrame(
            [{"customer_id": 10, "state": "SP"}, {"customer_id": 11, "state": "RJ"}]
        ).to_excel(writer, sheet_name="customers", index=False)
    repository = Repository(session)
    project = repository.create_project("Multi-sheet workbook")
    source = DataSourceService(repository).attach_file(project.id, SourceType.EXCEL, workbook)

    artifact = QueryService(repository).run(
        project.id,
        source.id,
        'SELECT c.state, COUNT(*) AS orders FROM "orders" o '
        'JOIN "customers" c USING (customer_id) GROUP BY c.state ORDER BY c.state',
        "Orders by state",
    )

    assert artifact.artifact_metadata["preview"] == [
        {"state": "RJ", "orders": 1},
        {"state": "SP", "orders": 1},
    ]


def test_query_limit_preserves_smaller_values_and_caps_larger_values() -> None:
    assert apply_limit(validate_read_only_sql("SELECT * FROM data LIMIT 3"), 5_000).endswith(
        "LIMIT 3"
    )
    assert apply_limit(validate_read_only_sql("SELECT * FROM data LIMIT 9000"), 5_000).endswith(
        "LIMIT 5000"
    )
    mysql = validate_read_only_sql("SELECT * FROM `order-items`", dialect="mysql")
    assert "`order-items`" in apply_limit(mysql, 5_000, dialect="mysql")


def test_sqlite_query_timeout_interrupts_cpu_bound_query(
    tmp_path: Path, session: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    database = tmp_path / "large.sqlite"
    with sqlite3.connect(database) as connection:
        connection.execute("CREATE TABLE numbers (value INTEGER)")
        connection.executemany("INSERT INTO numbers VALUES (?)", ((item,) for item in range(10_000)))

    service = QueryService(Repository(session))
    monkeypatch.setattr(service.settings, "query_timeout_seconds", 0.001)
    with pytest.raises(pd.errors.DatabaseError, match="interrupted"):
        service._query_sqlite(database, "SELECT SUM(a.value * b.value) FROM numbers a, numbers b")


def test_project_source_size_limit_is_enforced(
    monkeypatch, tmp_path: Path, session: Session
) -> None:
    csv_path = tmp_path / "orders.csv"
    csv_path.write_text("state,revenue\nSP,12\n", encoding="utf-8")
    monkeypatch.setattr(
        data_sources,
        "get_settings",
        lambda: Settings(runtime_root=tmp_path / "runtime", max_project_source_bytes=4),
    )
    repository = Repository(session)
    project = repository.create_project("Size limit")
    try:
        DataSourceService(repository).attach_file(project.id, SourceType.CSV, csv_path)
    except ValueError as exc:
        assert "2 GB" in str(exc)
    else:
        raise AssertionError("project source limit was not enforced")


def test_corrupt_source_is_persisted_as_failed_for_recovery(
    tmp_path: Path, session: Session
) -> None:
    broken = tmp_path / "broken.sqlite"
    broken.write_bytes(b"not-a-sqlite-database")
    repository = Repository(session)
    project = repository.create_project("Broken source")
    try:
        DataSourceService(repository).attach_file(project.id, SourceType.SQLITE, broken)
    except Exception:
        pass
    else:
        raise AssertionError("corrupt SQLite source unexpectedly profiled")
    sources = repository.list_sources(project.id)
    assert len(sources) == 1
    assert sources[0].status == "failed"
    assert sources[0].baseline["profile_error"] == "DatabaseError"


def test_source_change_is_explicit_and_reprofile_updates_baseline(
    tmp_path: Path, session: Session
) -> None:
    csv_path = tmp_path / "orders.csv"
    csv_path.write_text("state,revenue\nSP,12\n", encoding="utf-8")
    repository = Repository(session)
    project = repository.create_project("Source change")
    service = DataSourceService(repository)
    source = service.attach_file(project.id, SourceType.CSV, csv_path)
    original_fingerprint = source.fingerprint
    project_copy = Path(str(source.config["path"]))
    project_copy.write_text("state,revenue\nSP,12\nRJ,7\n", encoding="utf-8")
    changed = service.check_change(project.id, source.id)
    assert changed.status == "changed"
    assert changed.baseline["rows"] == 1
    try:
        QueryService(repository).run(project.id, source.id, "SELECT * FROM data", "Stale")
    except ValueError as exc:
        assert "reprofile" in str(exc)
    else:
        raise AssertionError("changed source remained queryable")
    refreshed = service.reprofile(project.id, source.id)
    assert refreshed.status == "ready"
    assert refreshed.baseline["rows"] == 2
    assert refreshed.fingerprint != original_fingerprint
    baseline_artifacts = [
        item for item in repository.list_artifacts(project.id) if item.type == "source_baseline"
    ]
    assert len(baseline_artifacts) == 1
    assert baseline_artifacts[0].artifact_metadata["fingerprint"] == original_fingerprint


def test_mysql_sources_receive_independent_ephemeral_credential_aliases(
    monkeypatch, session: Session
) -> None:
    monkeypatch.setattr(
        data_sources,
        "profile_mysql",
        lambda _url: {"format": "mysql", "tables": [{"name": "orders", "rows": 2}]},
    )
    repository = Repository(session)
    first_project = repository.create_project("First MySQL")
    second_project = repository.create_project("Second MySQL")
    service = DataSourceService(repository)
    first = service.attach_mysql(first_project.id, "first", "mysql://first")
    second = service.attach_mysql(second_project.id, "second", "mysql://second")
    first_alias = str(first.config["connection_env"])
    second_alias = str(second.config["connection_env"])
    assert first_alias != second_alias
    assert os.environ[first_alias] == "mysql://first"
    assert os.environ[second_alias] == "mysql://second"
    assert "mysql://" not in str(first.config)


def test_mysql_query_scope_rejects_tables_not_imported_into_asset() -> None:
    allowed = validate_read_only_sql("SELECT * FROM orders", dialect="mysql")
    validate_mysql_query_scope(allowed, {"orders"})
    blocked = validate_read_only_sql("SELECT * FROM customers", dialect="mysql")
    with pytest.raises(ValueError, match="imported into this data asset"):
        validate_mysql_query_scope(blocked, {"orders"})
