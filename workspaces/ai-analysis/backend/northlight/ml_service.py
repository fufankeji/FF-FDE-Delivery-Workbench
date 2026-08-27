from __future__ import annotations

import json
from typing import Any
from uuid import uuid4

import joblib
import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import (
    HistGradientBoostingClassifier,
    HistGradientBoostingRegressor,
    RandomForestClassifier,
    RandomForestRegressor,
    StackingClassifier,
    StackingRegressor,
    VotingClassifier,
    VotingRegressor,
)
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression, Ridge
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    f1_score,
    mean_absolute_error,
    mean_squared_error,
    precision_recall_curve,
    r2_score,
    roc_auc_score,
    roc_curve,
    silhouette_score,
)
from sklearn.model_selection import GridSearchCV, cross_val_score, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

from northlight.models import Artifact
from northlight.repository import Repository
from northlight.workspace import project_root


def load_artifact_frame(repository: Repository, project_id: str, artifact_id: str) -> pd.DataFrame:
    artifact = repository.get_artifact(project_id, artifact_id)
    path = project_root(project_id) / artifact.path
    if path.suffix == ".parquet":
        return pd.read_parquet(path)
    if path.suffix == ".csv":
        return pd.read_csv(path)
    raise ValueError(f"ML requires a tabular CSV or Parquet artifact, got {path.suffix}")


def build_preprocessor(frame: pd.DataFrame) -> ColumnTransformer:
    numeric = list(frame.select_dtypes(include=[np.number, "bool"]).columns)
    categorical = [column for column in frame.columns if column not in numeric]
    return ColumnTransformer(
        [
            (
                "numeric",
                Pipeline(
                    [
                        ("impute", SimpleImputer(strategy="median")),
                        ("scale", StandardScaler()),
                    ]
                ),
                numeric,
            ),
            (
                "categorical",
                Pipeline(
                    [
                        ("impute", SimpleImputer(strategy="most_frequent")),
                        (
                            "onehot",
                            OneHotEncoder(
                                handle_unknown="ignore", sparse_output=False, max_categories=100
                            ),
                        ),
                    ]
                ),
                categorical,
            ),
        ],
        remainder="drop",
    )


def classification_estimator(algorithm: str, random_state: int) -> Any:
    if algorithm == "logistic_regression":
        return LogisticRegression(max_iter=1_000, random_state=random_state)
    if algorithm == "gradient_boosting":
        return HistGradientBoostingClassifier(random_state=random_state)
    if algorithm == "soft_voting":
        return VotingClassifier(
            [
                ("lr", LogisticRegression(max_iter=1_000, random_state=random_state)),
                (
                    "rf",
                    RandomForestClassifier(n_estimators=160, random_state=random_state, n_jobs=-1),
                ),
                ("gb", HistGradientBoostingClassifier(random_state=random_state)),
            ],
            voting="soft",
        )
    if algorithm == "stacking":
        return StackingClassifier(
            [
                ("lr", LogisticRegression(max_iter=1_000, random_state=random_state)),
                (
                    "rf",
                    RandomForestClassifier(n_estimators=120, random_state=random_state, n_jobs=-1),
                ),
                ("gb", HistGradientBoostingClassifier(random_state=random_state)),
            ],
            final_estimator=LogisticRegression(max_iter=1_000),
            n_jobs=-1,
        )
    return RandomForestClassifier(n_estimators=200, random_state=random_state, n_jobs=-1)


def regression_estimator(algorithm: str, random_state: int) -> Any:
    if algorithm == "ridge":
        return Ridge()
    if algorithm == "gradient_boosting":
        return HistGradientBoostingRegressor(random_state=random_state)
    if algorithm == "weighted_average":
        return VotingRegressor(
            [
                ("ridge", Ridge()),
                (
                    "rf",
                    RandomForestRegressor(n_estimators=160, random_state=random_state, n_jobs=-1),
                ),
                ("gb", HistGradientBoostingRegressor(random_state=random_state)),
            ],
            weights=[1, 2, 2],
        )
    if algorithm == "stacking":
        return StackingRegressor(
            [
                ("ridge", Ridge()),
                (
                    "rf",
                    RandomForestRegressor(n_estimators=120, random_state=random_state, n_jobs=-1),
                ),
                ("gb", HistGradientBoostingRegressor(random_state=random_state)),
            ],
            final_estimator=Ridge(),
            n_jobs=-1,
        )
    return RandomForestRegressor(n_estimators=200, random_state=random_state, n_jobs=-1)


class MLService:
    def __init__(self, repository: Repository):
        self.repository = repository

    def run(
        self,
        project_id: str,
        artifact_id: str,
        task: str,
        target: str | None,
        features: list[str] | None,
        algorithm: str,
        name: str,
        random_state: int,
        tune: bool = False,
    ) -> dict[str, Artifact]:
        frame = load_artifact_frame(self.repository, project_id, artifact_id)
        selected_features = features or [column for column in frame.columns if column != target]
        missing = [
            column
            for column in selected_features + ([target] if target else [])
            if column not in frame
        ]
        if missing:
            raise ValueError(f"Columns not found: {', '.join(missing)}")
        if task == "clustering":
            return self._cluster(
                project_id, artifact_id, frame[selected_features], algorithm, name, random_state
            )
        if not target:
            raise ValueError("A target column is required for classification and regression")
        clean = frame[selected_features + [target]].dropna(subset=[target]).copy()
        clean, selected_features, date_features = self._expand_date_features(
            clean, selected_features
        )
        x = clean[selected_features]
        y = clean[target]
        stratify = y if task == "classification" and y.value_counts().min() >= 2 else None
        x_train, x_test, y_train, y_test = train_test_split(
            x, y, test_size=0.2, random_state=random_state, stratify=stratify
        )
        estimator = (
            classification_estimator(algorithm, random_state)
            if task == "classification"
            else regression_estimator(algorithm, random_state)
        )
        pipeline = Pipeline([("preprocess", build_preprocessor(x)), ("model", estimator)])
        scoring = "f1_weighted" if task == "classification" else "neg_mean_absolute_error"
        cv_scores: list[float] = []
        if len(clean) >= 30:
            try:
                cv_scores = [
                    float(value)
                    for value in cross_val_score(pipeline, x, y, cv=3, scoring=scoring, n_jobs=1)
                ]
            except ValueError:
                cv_scores = []
        best_params: dict[str, object] = {}
        grid = tuning_grid(task, algorithm)
        if tune and grid:
            search = GridSearchCV(pipeline, grid, cv=3, scoring=scoring, n_jobs=1)
            search.fit(x_train, y_train)
            pipeline = search.best_estimator_
            best_params = {
                key.replace("model__", ""): value for key, value in search.best_params_.items()
            }
        else:
            pipeline.fit(x_train, y_train)
        predictions = pipeline.predict(x_test)
        metrics = (
            self._classification_metrics(pipeline, x_test, y_test, predictions)
            if task == "classification"
            else self._regression_metrics(y_test, predictions)
        )
        metrics["cv_scores"] = cv_scores
        if cv_scores:
            metrics["cv_mean"] = float(np.mean(cv_scores))
            metrics["cv_std"] = float(np.std(cv_scores))
        metrics["feature_importance"] = self._feature_importance(pipeline)
        predictions_frame = x_test.copy()
        predictions_frame["actual"] = y_test
        predictions_frame["prediction"] = predictions
        return self._persist(
            project_id,
            artifact_id,
            pipeline,
            predictions_frame,
            {
                "task": task,
                "target": target,
                "features": selected_features,
                "date_features": date_features,
                "feature_schema": {column: str(x[column].dtype) for column in x.columns},
                "algorithm": algorithm,
                "random_state": random_state,
                "tuning": {"enabled": tune, "best_params": best_params},
                "train_rows": len(x_train),
                "test_rows": len(x_test),
                "metrics": metrics,
            },
            name,
        )

    def predict(
        self,
        project_id: str,
        model_artifact_id: str,
        data_artifact_id: str,
        name: str,
    ) -> Artifact:
        model_artifact = self.repository.get_artifact(project_id, model_artifact_id)
        if model_artifact.type != "model":
            raise ValueError("Prediction requires a model artifact")
        data_frame = load_artifact_frame(self.repository, project_id, data_artifact_id)
        config = model_artifact.artifact_metadata
        configured_features = config.get("features", [])
        if not isinstance(configured_features, list) or not all(
            isinstance(item, str) for item in configured_features
        ):
            raise ValueError("Model artifact does not contain a valid feature schema")
        features = list(configured_features)
        for feature in list(features):
            if feature in data_frame or "__" not in feature:
                continue
            original, suffix = feature.rsplit("__", 1)
            if original not in data_frame or suffix not in {"year", "month", "day", "weekday"}:
                continue
            parsed = pd.to_datetime(data_frame[original], errors="coerce")
            data_frame[feature] = {
                "year": parsed.dt.year,
                "month": parsed.dt.month,
                "day": parsed.dt.day,
                "weekday": parsed.dt.weekday,
            }[suffix]
        missing = [column for column in features if column not in data_frame]
        if missing:
            raise ValueError(f"Prediction schema mismatch; missing columns: {', '.join(missing)}")
        model = joblib.load(project_root(project_id) / model_artifact.path)
        predictions = model.predict(data_frame[features])
        output = data_frame.copy()
        output["prediction"] = predictions
        path = project_root(project_id) / "predictions" / f"{uuid4()}.parquet"
        output.to_parquet(path, index=False)
        return self.repository.add_artifact(
            project_id,
            "predictions",
            name,
            path,
            {"rows": len(output), "columns": list(output.columns), "model_id": model_artifact_id},
            [data_artifact_id, model_artifact_id],
        )

    def _cluster(
        self,
        project_id: str,
        artifact_id: str,
        frame: pd.DataFrame,
        algorithm: str,
        name: str,
        random_state: int,
    ) -> dict[str, Artifact]:
        numeric = frame.select_dtypes(include=[np.number, "bool"])
        if numeric.shape[1] == 0:
            raise ValueError("Clustering requires at least one numeric feature")
        if algorithm != "kmeans":
            raise ValueError("The first release supports only kmeans clustering")
        clusters = 4
        model = Pipeline(
            [
                ("impute", SimpleImputer(strategy="median")),
                ("scale", StandardScaler()),
                (
                    "model",
                    KMeans(n_clusters=clusters, random_state=random_state, n_init="auto"),
                ),
            ]
        )
        labels = model.fit_predict(numeric)
        transformed = model[:-1].transform(numeric)
        output = frame.copy()
        output["cluster"] = labels
        metrics = {"silhouette": float(silhouette_score(transformed, labels)), "clusters": clusters}
        return self._persist(
            project_id,
            artifact_id,
            model,
            output,
            {
                "task": "clustering",
                "features": list(numeric.columns),
                "algorithm": "kmeans",
                "random_state": random_state,
                "metrics": metrics,
            },
            name,
        )

    def _classification_metrics(
        self, pipeline: Pipeline, x_test: pd.DataFrame, y_test: pd.Series, predictions: np.ndarray
    ) -> dict[str, Any]:
        labels = list(pd.Series(y_test).dropna().unique())
        result: dict[str, Any] = {
            "accuracy": float(accuracy_score(y_test, predictions)),
            "f1_weighted": float(f1_score(y_test, predictions, average="weighted")),
            "labels": [str(value) for value in labels],
            "confusion_matrix": confusion_matrix(y_test, predictions, labels=labels).tolist(),
        }
        if y_test.nunique() == 2 and hasattr(pipeline, "predict_proba"):
            probabilities = pipeline.predict_proba(x_test)[:, 1]
            result["roc_auc"] = float(roc_auc_score(y_test, probabilities))
            binary_truth = (pd.Series(y_test).to_numpy() == labels[1]).astype(int)
            fpr, tpr, _ = roc_curve(binary_truth, probabilities)
            precision, recall, _ = precision_recall_curve(binary_truth, probabilities)
            result["roc_curve"] = {
                "fpr": downsample_curve(fpr),
                "tpr": downsample_curve(tpr),
            }
            result["pr_curve"] = {
                "precision": downsample_curve(precision),
                "recall": downsample_curve(recall),
            }
        return result

    def _regression_metrics(self, y_test: pd.Series, predictions: np.ndarray) -> dict[str, Any]:
        residuals = np.asarray(y_test) - predictions
        return {
            "mae": float(mean_absolute_error(y_test, predictions)),
            "rmse": float(mean_squared_error(y_test, predictions) ** 0.5),
            "r2": float(r2_score(y_test, predictions)),
            "residual_mean": float(np.mean(residuals)),
            "residual_std": float(np.std(residuals)),
            "residual_quantiles": {
                "p05": float(np.quantile(residuals, 0.05)),
                "p50": float(np.quantile(residuals, 0.5)),
                "p95": float(np.quantile(residuals, 0.95)),
            },
        }

    def _expand_date_features(
        self, frame: pd.DataFrame, features: list[str]
    ) -> tuple[pd.DataFrame, list[str], list[str]]:
        output = frame.copy()
        selected = list(features)
        created: list[str] = []
        for column in list(features):
            if not (
                pd.api.types.is_datetime64_any_dtype(output[column])
                or any(term in column.lower() for term in ("date", "time", "日期", "时间"))
            ):
                continue
            parsed = pd.to_datetime(output[column], errors="coerce")
            if parsed.notna().mean() < 0.75:
                continue
            selected.remove(column)
            for suffix, values in (
                ("year", parsed.dt.year),
                ("month", parsed.dt.month),
                ("day", parsed.dt.day),
                ("weekday", parsed.dt.weekday),
            ):
                name = f"{column}__{suffix}"
                output[name] = values
                selected.append(name)
                created.append(name)
        return output, selected, created

    def _feature_importance(self, pipeline: Pipeline) -> list[dict[str, Any]]:
        estimator = pipeline.named_steps["model"]
        values = getattr(estimator, "feature_importances_", None)
        if values is None and hasattr(estimator, "coef_"):
            coefficients = np.asarray(estimator.coef_)
            values = (
                np.mean(np.abs(coefficients), axis=0)
                if coefficients.ndim > 1
                else np.abs(coefficients)
            )
        if values is None:
            return []
        try:
            names = pipeline.named_steps["preprocess"].get_feature_names_out()
        except (AttributeError, ValueError):
            names = [f"feature_{index}" for index in range(len(values))]
        ranked = sorted(
            zip(names, np.asarray(values), strict=False),
            key=lambda item: float(item[1]),
            reverse=True,
        )
        return [{"feature": str(name), "importance": float(value)} for name, value in ranked[:30]]

    def _persist(
        self,
        project_id: str,
        artifact_id: str,
        model: Any,
        predictions: pd.DataFrame,
        config: dict[str, Any],
        name: str,
    ) -> dict[str, Artifact]:
        root = project_root(project_id)
        run_id = str(uuid4())
        model_path = root / "models" / f"{run_id}.joblib"
        predictions_path = root / "predictions" / f"{run_id}.parquet"
        config_path = root / "models" / f"{run_id}.json"
        code_path = root / "code" / f"{run_id}.py"
        joblib.dump(model, model_path)
        predictions.to_parquet(predictions_path, index=False)
        config_path.write_text(json.dumps(config, indent=2, default=str) + "\n", encoding="utf-8")
        code_path.write_text(
            reproduction_code(config, self.repository.get_artifact(project_id, artifact_id).path),
            encoding="utf-8",
        )
        code_artifact = self.repository.add_artifact(
            project_id, "code", f"{name} · training code", code_path, config, [artifact_id]
        )
        model_artifact = self.repository.add_artifact(
            project_id,
            "model",
            name,
            model_path,
            config,
            [artifact_id, code_artifact.id],
        )
        prediction_artifact = self.repository.add_artifact(
            project_id,
            "predictions",
            f"{name} · predictions",
            predictions_path,
            {"rows": len(predictions), "columns": list(predictions.columns)},
            [artifact_id, model_artifact.id],
        )
        return {"code": code_artifact, "model": model_artifact, "predictions": prediction_artifact}


def reproduction_code(config: dict[str, Any], source_path: str) -> str:
    common = (
        "# Reproduce this experiment from its immutable project artifact.\n"
        "from pathlib import Path\n"
        "import pandas as pd\n"
        "from sklearn.pipeline import Pipeline\n\n"
        f"RUN_CONFIG = {config!r}\n"
        f"SOURCE_PATH = Path(__file__).resolve().parents[1] / {source_path!r}\n"
        "frame = pd.read_parquet(SOURCE_PATH)\n"
        "features = RUN_CONFIG['features']\n"
    )
    if config.get("task") == "clustering":
        return common + (
            "from sklearn.cluster import KMeans\n"
            "from sklearn.impute import SimpleImputer\n"
            "from sklearn.preprocessing import StandardScaler\n\n"
            "x = frame[features]\n"
            "model = Pipeline([('impute', SimpleImputer(strategy='median')), "
            "('scale', StandardScaler()), ('model', KMeans(n_clusters=RUN_CONFIG['metrics']['clusters'], "
            "random_state=RUN_CONFIG['random_state'], n_init='auto'))])\n"
            "labels = model.fit_predict(x)\n"
            "print(pd.Series(labels).value_counts().sort_index().to_dict())\n"
        )
    return common + (
        "from sklearn.model_selection import train_test_split\n"
        "from northlight.ml_service import build_preprocessor, classification_estimator, regression_estimator\n\n"
        "target = RUN_CONFIG['target']\n"
        "for feature in list(features):\n"
        "    if feature in frame or '__' not in feature:\n"
        "        continue\n"
        "    original, suffix = feature.rsplit('__', 1)\n"
        "    parsed = pd.to_datetime(frame[original], errors='coerce')\n"
        "    frame[feature] = {'year': parsed.dt.year, 'month': parsed.dt.month, "
        "'day': parsed.dt.day, 'weekday': parsed.dt.weekday}[suffix]\n"
        "x, y = frame[features], frame[target]\n"
        "x_train, x_test, y_train, y_test = train_test_split(x, y, test_size=.2, "
        "random_state=RUN_CONFIG['random_state'])\n"
        "factory = classification_estimator if RUN_CONFIG['task'] == 'classification' "
        "else regression_estimator\n"
        "model = Pipeline([('preprocess', build_preprocessor(x)), "
        "('model', factory(RUN_CONFIG['algorithm'], RUN_CONFIG['random_state']))])\n"
        "model.fit(x_train, y_train)\n"
        "print({'test_rows': len(x_test), 'score': float(model.score(x_test, y_test))})\n"
    )


def downsample_curve(values: np.ndarray, points: int = 200) -> list[float]:
    if len(values) <= points:
        return [float(value) for value in values]
    indices = np.linspace(0, len(values) - 1, points, dtype=int)
    return [float(values[index]) for index in indices]


def tuning_grid(task: str, algorithm: str) -> dict[str, list[object]]:
    grids: dict[tuple[str, str], dict[str, list[object]]] = {
        ("classification", "random_forest"): {
            "model__n_estimators": [120, 200],
            "model__max_depth": [None, 10],
        },
        ("classification", "logistic_regression"): {"model__C": [0.2, 1.0, 5.0]},
        ("classification", "gradient_boosting"): {
            "model__learning_rate": [0.05, 0.1],
            "model__max_leaf_nodes": [15, 31],
        },
        ("regression", "random_forest"): {
            "model__n_estimators": [120, 200],
            "model__max_depth": [None, 10],
        },
        ("regression", "ridge"): {"model__alpha": [0.2, 1.0, 5.0]},
        ("regression", "gradient_boosting"): {
            "model__learning_rate": [0.05, 0.1],
            "model__max_leaf_nodes": [15, 31],
        },
    }
    return grids.get((task, algorithm), {})
