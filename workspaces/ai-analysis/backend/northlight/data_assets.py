from __future__ import annotations

import os
import shutil
import sqlite3
from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4

import duckdb
import pandas as pd
from sqlalchemy import create_engine, text

from northlight.connection_settings import (
    delete_mysql_connection,
    restore_mysql_connection,
    save_mysql_connection,
)
from northlight.data_sources import (
    DataSourceService,
    profile_csv,
    profile_excel,
    profile_mysql,
    profile_sqlite,
    sha256_text,
)
from northlight.domain import SourceType
from northlight.models import DataAsset, ProjectDataAsset, Source
from northlight.repository import Repository
from northlight.serialization import frame_records
from northlight.settings import get_settings
from northlight.workspace import sha256

FILE_TYPES = {SourceType.CSV, SourceType.EXCEL, SourceType.SQLITE}
EXPECTED_SUFFIXES = {
    SourceType.CSV: {".csv"},
    SourceType.EXCEL: {".xlsx", ".xls"},
    SourceType.SQLITE: {".sqlite", ".sqlite3", ".db"},
}
PROFILE_FILE = {
    SourceType.CSV: profile_csv,
    SourceType.EXCEL: profile_excel,
    SourceType.SQLITE: profile_sqlite,
}


class DataAssetService:
    def __init__(self, repository: Repository):
        self.repository = repository
        self.root = get_settings().runtime_root / "data-assets"
        self.root.mkdir(parents=True, exist_ok=True)

    def create_file(
        self,
        source_type: SourceType,
        upload: Path,
        original_name: str | None = None,
    ) -> DataAsset:
        if source_type not in FILE_TYPES:
            raise ValueError(f"Global file asset does not support {source_type}")
        name = Path(original_name or upload.name).name
        suffix = Path(name).suffix.lower()
        if suffix not in EXPECTED_SUFFIXES[source_type]:
            raise ValueError(
                f"File extension {suffix or '<none>'} does not match {source_type.value}"
            )
        asset_id = str(uuid4())
        directory = self.root / asset_id
        directory.mkdir(parents=True)
        destination = directory / name
        shutil.copy2(upload, destination)
        fingerprint = sha256(destination)
        try:
            baseline = PROFILE_FILE[source_type](destination)
            baseline["source_sha256"] = fingerprint
            baseline["bytes"] = destination.stat().st_size
            return self.repository.add_data_asset(
                asset_id=asset_id,
                source_type=source_type.value,
                name=name,
                fingerprint=fingerprint,
                config={"path": str(destination)},
                baseline=baseline,
            )
        except Exception:
            shutil.rmtree(directory, ignore_errors=True)
            raise

    def create_mysql(
        self, name: str, connection_url: str, table_names: list[str] | None = None
    ) -> DataAsset:
        asset_id = str(uuid4())
        connection_env = f"NORTHLIGHT_DATA_ASSET_{asset_id.replace('-', '_').upper()}"
        os.environ[connection_env] = connection_url
        try:
            baseline = (
                profile_mysql(connection_url, table_names)
                if table_names
                else profile_mysql(connection_url)
            )
            fingerprint = sha256_text(
                str([(table["name"], table["rows"]) for table in baseline["tables"]])
            )
            asset = self.repository.add_data_asset(
                asset_id=asset_id,
                source_type=SourceType.MYSQL.value,
                name=name,
                fingerprint=fingerprint,
                config={"connection_env": connection_env, "tables": table_names or []},
                baseline=baseline,
            )
            save_mysql_connection(connection_env, connection_url)
            return asset
        except Exception:
            os.environ.pop(connection_env, None)
            raise

    def bind(self, project_id: str, asset_id: str) -> Source:
        existing = self.repository.get_project_data_asset(project_id, asset_id)
        if existing:
            return self.repository.get_source(project_id, existing.source_id)
        asset = self.repository.get_data_asset(asset_id)
        source_service = DataSourceService(self.repository)
        source_type = SourceType(asset.type)
        if source_type in FILE_TYPES:
            source = source_service.attach_file(
                project_id, source_type, Path(str(asset.config["path"])), asset.name
            )
        elif source_type == SourceType.MYSQL:
            connection_env = str(asset.config.get("connection_env", ""))
            connection_url = restore_mysql_connection(connection_env)
            if not connection_url:
                raise RuntimeError(
                    "MySQL credential is not available; reconnect this asset in the current session"
                )
            raw_tables = asset.config.get("tables", [])
            table_names = [str(item) for item in raw_tables] if isinstance(raw_tables, list) else []
            source = source_service.attach_mysql(
                project_id, asset.name, connection_url, table_names or None
            )
        else:
            raise ValueError(f"Unsupported data asset type: {asset.type}")
        self.repository.bind_data_asset(project_id, asset_id, source.id)
        return source

    def reprofile(self, asset_id: str) -> DataAsset:
        asset = self.repository.get_data_asset(asset_id)
        source_type = SourceType(asset.type)
        if source_type in FILE_TYPES:
            path = Path(str(asset.config["path"]))
            baseline = PROFILE_FILE[source_type](path)
            fingerprint = sha256(path)
            baseline["source_sha256"] = fingerprint
            baseline["bytes"] = path.stat().st_size
        else:
            connection_env = str(asset.config.get("connection_env", ""))
            connection_url = restore_mysql_connection(connection_env)
            if not connection_url:
                raise RuntimeError(
                    "MySQL credential is not available; reconnect this asset in the current session"
                )
            raw_tables = asset.config.get("tables", [])
            table_names = [str(item) for item in raw_tables] if isinstance(raw_tables, list) else []
            baseline = (
                profile_mysql(connection_url, table_names)
                if table_names
                else profile_mysql(connection_url)
            )
            fingerprint = sha256_text(
                str([(table["name"], table["rows"]) for table in baseline["tables"]])
            )
        baseline["field_descriptions"] = asset.baseline.get("field_descriptions", {})
        asset.baseline = baseline
        asset.fingerprint = fingerprint
        asset.status = "ready"
        asset.updated_at = datetime.now(UTC)
        self.repository.session.commit()
        return asset

    def import_existing_sources(self) -> None:
        """One-time-compatible bridge so accepted projects appear in the new global catalog."""
        sources = list(self.repository.session.query(Source).all())
        for source in sources:
            already_bound = (
                self.repository.session.query(ProjectDataAsset)
                .filter_by(source_id=source.id)
                .first()
            )
            if already_bound:
                continue
            matching = next(
                (
                    item
                    for item in self.repository.list_data_assets()
                    if item.type == source.type and item.fingerprint == source.fingerprint
                ),
                None,
            )
            asset = matching or self._copy_existing_source(source)
            self.repository.bind_data_asset(source.project_id, asset.id, source.id)

    def _copy_existing_source(self, source: Source) -> DataAsset:
        asset_id = str(uuid4())
        config: dict[str, object]
        if source.type in {item.value for item in FILE_TYPES}:
            origin = Path(str(source.config["path"]))
            directory = self.root / asset_id
            directory.mkdir(parents=True, exist_ok=True)
            destination = directory / origin.name
            shutil.copy2(origin, destination)
            config = {"path": str(destination)}
        else:
            config = {"connection_env": str(source.config.get("connection_env", ""))}
        return self.repository.add_data_asset(
            asset_id=asset_id,
            source_type=source.type,
            name=source.name,
            fingerprint=source.fingerprint,
            config=config,
            baseline=dict(source.baseline),
            status=source.status,
            description="从既有分析项目纳入的数据资产",
        )

    def delete(self, asset_id: str) -> None:
        asset = self.repository.delete_data_asset(asset_id)
        connection_env = str(asset.config.get("connection_env", ""))
        if connection_env:
            delete_mysql_connection(connection_env)
        path_value = asset.config.get("path")
        if path_value:
            path = Path(str(path_value)).resolve()
            path.relative_to(self.root.resolve())
            shutil.rmtree(path.parent, ignore_errors=True)

    def preview(
        self, asset_id: str, unit: str | None, offset: int, limit: int
    ) -> dict[str, object]:
        asset = self.repository.get_data_asset(asset_id)
        groups = self._groups(asset)
        units = [str(group["name"]) for group in groups]
        selected = unit or units[0]
        if selected not in units:
            raise ValueError(f"Unknown data unit: {selected}")
        group = next(item for item in groups if item["name"] == selected)
        bounded_limit = min(max(limit, 1), get_settings().preview_row_limit)
        bounded_offset = max(offset, 0)
        frame = self._preview_frame(asset, selected, bounded_offset, bounded_limit)
        descriptions = self._field_descriptions(asset, selected)
        fields: list[dict[str, object]] = []
        raw_fields = group.get("fields", [])
        for raw in raw_fields if isinstance(raw_fields, list) else []:
            if not isinstance(raw, dict):
                continue
            name = str(raw.get("name", ""))
            fields.append(
                {
                    **raw,
                    "description": descriptions.get(
                        name, infer_field_description(name, str(raw.get("dtype", "")))
                    ),
                }
            )
        total_value = group.get("rows", 0)
        total = int(total_value) if isinstance(total_value, (int, float, str)) else 0
        return {
            "asset_id": asset.id,
            "unit": selected,
            "units": units,
            "offset": bounded_offset,
            "limit": bounded_limit,
            "total": total,
            "columns": [str(column) for column in frame.columns],
            "fields": fields,
            "rows": frame_records(frame, bounded_limit),
        }

    def update_dictionary(
        self, asset_id: str, unit: str, descriptions: dict[str, str]
    ) -> DataAsset:
        asset = self.repository.get_data_asset(asset_id)
        groups = self._groups(asset)
        group = next((item for item in groups if item["name"] == unit), None)
        if group is None:
            raise ValueError(f"Unknown data unit: {unit}")
        raw_fields = group.get("fields", [])
        allowed = {
            str(field.get("name"))
            for field in (raw_fields if isinstance(raw_fields, list) else [])
            if isinstance(field, dict) and field.get("name")
        }
        unknown = sorted(set(descriptions) - allowed)
        if unknown:
            raise ValueError(f"Unknown fields in dictionary: {unknown}")
        baseline = dict(asset.baseline)
        raw_dictionaries = baseline.get("field_descriptions", {})
        dictionaries = dict(raw_dictionaries) if isinstance(raw_dictionaries, dict) else {}
        dictionaries[unit] = {
            key: value.strip()[:500] for key, value in descriptions.items() if value.strip()
        }
        baseline["field_descriptions"] = dictionaries
        asset.baseline = baseline
        asset.updated_at = datetime.now(UTC)
        self.repository.session.commit()
        return asset

    @staticmethod
    def _groups(asset: DataAsset) -> list[dict[str, object]]:
        nested = asset.baseline.get("tables") or asset.baseline.get("sheets")
        if isinstance(nested, list):
            groups = [item for item in nested if isinstance(item, dict)]
        else:
            groups = [
                {
                    "name": str(asset.baseline.get("format", asset.type)),
                    "rows": asset.baseline.get("rows", 0),
                    "fields": asset.baseline.get("fields", []),
                }
            ]
        if not groups:
            raise ValueError("Data asset does not contain a readable table or sheet")
        return groups

    @staticmethod
    def _field_descriptions(asset: DataAsset, unit: str) -> dict[str, str]:
        raw = asset.baseline.get("field_descriptions", {})
        if not isinstance(raw, dict):
            return {}
        selected = raw.get(unit, {})
        return {str(key): str(value) for key, value in selected.items()} if isinstance(selected, dict) else {}

    def _preview_frame(
        self, asset: DataAsset, unit: str, offset: int, limit: int
    ) -> pd.DataFrame:
        if asset.type == SourceType.CSV.value:
            relation = duckdb.read_csv(str(asset.config["path"]), sample_size=100_000)
            return relation.limit(limit, offset=offset).df()
        if asset.type == SourceType.EXCEL.value:
            frame = pd.read_excel(Path(str(asset.config["path"])), sheet_name=unit)
            return frame.iloc[offset : offset + limit]
        if asset.type == SourceType.SQLITE.value:
            path = Path(str(asset.config["path"])).resolve()
            sqlite_connection = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
            quoted = unit.replace('"', '""')
            try:
                return pd.read_sql_query(
                    f'SELECT * FROM "{quoted}" LIMIT ? OFFSET ?',
                    sqlite_connection,
                    params=(limit, offset),
                )
            finally:
                sqlite_connection.close()
        if asset.type == SourceType.MYSQL.value:
            alias = str(asset.config.get("connection_env", ""))
            url = restore_mysql_connection(alias)
            if not url:
                raise RuntimeError("MySQL credential is not available; reconnect this asset")
            engine = create_engine(url, pool_pre_ping=True)
            quoted = f"`{unit.replace('`', '``')}`"
            try:
                with engine.connect() as mysql_connection:
                    mysql_connection.execute(text("SET SESSION TRANSACTION READ ONLY"))
                    return pd.read_sql_query(
                        text(f"SELECT * FROM {quoted} LIMIT :limit OFFSET :offset"),
                        mysql_connection,
                        params={"limit": limit, "offset": offset},
                    )
            finally:
                engine.dispose()
        raise ValueError(f"Unsupported data asset type: {asset.type}")


FIELD_LABELS = {
    "id": "唯一标识",
    "name": "名称",
    "date": "日期",
    "time": "时间",
    "created": "创建时间",
    "updated": "更新时间",
    "customer": "客户",
    "order": "订单",
    "product": "商品",
    "seller": "商家",
    "price": "价格",
    "amount": "金额",
    "revenue": "收入",
    "sales": "销售额",
    "quantity": "数量",
    "status": "状态",
    "category": "分类",
    "city": "城市",
    "state": "州或省份",
    "region": "区域",
    "score": "评分",
}


def infer_field_description(name: str, dtype: str) -> str:
    normalized = name.lower().replace("-", "_")
    labels = [label for token, label in FIELD_LABELS.items() if token in normalized]
    if labels:
        return " / ".join(dict.fromkeys(labels)) + f"；源数据类型为 {dtype or '未声明'}"
    return f"{name} 的源字段；数据类型为 {dtype or '未声明'}，建议结合业务口径补充定义"
