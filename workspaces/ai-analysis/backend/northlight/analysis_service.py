from __future__ import annotations

import json
from typing import Any
from uuid import uuid4

import numpy as np
import pandas as pd

from northlight.models import Artifact
from northlight.repository import Repository
from northlight.serialization import frame_records
from northlight.workspace import project_root


def load_tabular_artifact(
    repository: Repository, project_id: str, artifact_id: str
) -> tuple[Artifact, pd.DataFrame]:
    artifact = repository.get_artifact(project_id, artifact_id)
    path = project_root(project_id) / artifact.path
    if path.suffix == ".parquet":
        frame = pd.read_parquet(path)
    elif path.suffix == ".csv":
        frame = pd.read_csv(path)
    else:
        raise ValueError("Analysis requires a CSV or Parquet artifact")
    return artifact, frame


class AnalysisService:
    def __init__(self, repository: Repository):
        self.repository = repository

    def profile(self, project_id: str, artifact_id: str, name: str) -> Artifact:
        source, frame = load_tabular_artifact(self.repository, project_id, artifact_id)
        numeric = frame.select_dtypes(include=[np.number])
        fields: list[dict[str, Any]] = []
        for column in frame.columns:
            series = frame[column]
            field: dict[str, Any] = {
                "name": str(column),
                "dtype": str(series.dtype),
                "nulls": int(series.isna().sum()),
                "null_rate": float(series.isna().mean()),
                "unique": int(series.nunique(dropna=True)),
            }
            if column in numeric:
                values = pd.to_numeric(series, errors="coerce").dropna()
                if not values.empty:
                    q1, q3 = values.quantile([0.25, 0.75])
                    iqr = q3 - q1
                    field.update(
                        {
                            "min": float(values.min()),
                            "median": float(values.median()),
                            "mean": float(values.mean()),
                            "max": float(values.max()),
                            "outliers_iqr": int(
                                ((values < q1 - 1.5 * iqr) | (values > q3 + 1.5 * iqr)).sum()
                            ),
                        }
                    )
            fields.append(field)
        correlations = (
            numeric.corr(numeric_only=True).round(5).where(pd.notna(numeric.corr()), None).to_dict()
            if 1 < len(numeric.columns) <= 80
            else {}
        )
        payload = {
            "schema_version": 1,
            "rows": len(frame),
            "columns": len(frame.columns),
            "duplicate_rows": int(frame.duplicated().sum()),
            "missing_cells": int(frame.isna().sum().sum()),
            "fields": fields,
            "correlations": correlations,
        }
        path = project_root(project_id) / "datasets" / "derived" / f"{uuid4()}-profile.json"
        path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        return self.repository.add_artifact(project_id, "profile", name, path, payload, [source.id])

    def clean(
        self,
        project_id: str,
        artifact_id: str,
        name: str,
        drop_duplicates: bool,
        fill_missing: str,
        clip_outliers: bool,
    ) -> dict[str, Artifact]:
        source, frame = load_tabular_artifact(self.repository, project_id, artifact_id)
        original_rows = len(frame)
        cleaned = frame.copy()
        steps: list[str] = []
        if drop_duplicates:
            cleaned = cleaned.drop_duplicates()
            steps.append("drop_duplicates")
        numeric_columns = list(cleaned.select_dtypes(include=[np.number]).columns)
        categorical_columns = [
            column for column in cleaned.columns if column not in numeric_columns
        ]
        if fill_missing == "median_mode":
            for column in numeric_columns:
                cleaned[column] = cleaned[column].fillna(cleaned[column].median())
            for column in categorical_columns:
                mode = cleaned[column].mode(dropna=True)
                if not mode.empty:
                    cleaned[column] = cleaned[column].fillna(mode.iloc[0])
            steps.append("fill_missing:median_mode")
        elif fill_missing == "drop_rows":
            cleaned = cleaned.dropna()
            steps.append("fill_missing:drop_rows")
        if clip_outliers:
            for column in numeric_columns:
                lower, upper = cleaned[column].quantile([0.01, 0.99])
                cleaned[column] = cleaned[column].clip(lower=lower, upper=upper)
            steps.append("clip_numeric:p01_p99")
        return self._persist_derived(
            project_id,
            source,
            cleaned,
            name,
            {
                "operation": "clean",
                "steps": steps,
                "original_rows": original_rows,
                "result_rows": len(cleaned),
            },
        )

    def engineer_features(
        self,
        project_id: str,
        artifact_id: str,
        name: str,
        date_columns: list[str],
        log_columns: list[str],
        ratios: list[dict[str, str]],
    ) -> dict[str, Artifact]:
        source, frame = load_tabular_artifact(self.repository, project_id, artifact_id)
        output = frame.copy()
        created: list[str] = []
        for column in date_columns:
            if column not in output:
                raise ValueError(f"Date feature column not found: {column}")
            parsed = pd.to_datetime(output[column], errors="coerce")
            for suffix, values in (
                ("year", parsed.dt.year),
                ("month", parsed.dt.month),
                ("day", parsed.dt.day),
                ("weekday", parsed.dt.weekday),
            ):
                created_name = f"{column}__{suffix}"
                output[created_name] = values
                created.append(created_name)
        for column in log_columns:
            if column not in output:
                raise ValueError(f"Log feature column not found: {column}")
            created_name = f"{column}__log1p"
            output[created_name] = np.log1p(
                pd.to_numeric(output[column], errors="coerce").clip(lower=0)
            )
            created.append(created_name)
        for ratio in ratios:
            numerator = ratio.get("numerator", "")
            denominator = ratio.get("denominator", "")
            ratio_name = ratio.get("name", f"{numerator}__per__{denominator}")
            if numerator not in output or denominator not in output:
                raise ValueError("Ratio feature columns must exist")
            denominator_values = pd.to_numeric(output[denominator], errors="coerce").replace(
                0, np.nan
            )
            output[ratio_name] = (
                pd.to_numeric(output[numerator], errors="coerce") / denominator_values
            )
            created.append(ratio_name)
        return self._persist_derived(
            project_id,
            source,
            output,
            name,
            {"operation": "feature_engineering", "created_features": created},
        )

    def _persist_derived(
        self,
        project_id: str,
        source: Artifact,
        frame: pd.DataFrame,
        name: str,
        config: dict[str, Any],
    ) -> dict[str, Artifact]:
        run_id = str(uuid4())
        root = project_root(project_id)
        output_path = root / "datasets" / "derived" / f"{run_id}.parquet"
        code_path = root / "code" / f"{run_id}.py"
        frame.to_parquet(output_path, index=False)
        preview = frame_records(frame, 200)
        code_path.write_text(
            "# Reproduce through the recorded Northlight structured transform.\n"
            "TRANSFORM_CONFIG = " + repr(config) + "\n",
            encoding="utf-8",
        )
        code = self.repository.add_artifact(
            project_id, "code", f"{name} · transform code", code_path, config, [source.id]
        )
        derived = self.repository.add_artifact(
            project_id,
            "derived",
            name,
            output_path,
            {
                **config,
                "rows": len(frame),
                "columns": list(frame.columns),
                "preview": preview,
            },
            [source.id, code.id],
        )
        return {"code": code, "data": derived}
