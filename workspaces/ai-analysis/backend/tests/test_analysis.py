from pathlib import Path

import pandas as pd
from northlight.analysis_service import AnalysisService
from northlight.data_sources import DataSourceService
from northlight.domain import SourceType
from northlight.query_service import QueryService
from northlight.repository import Repository
from northlight.workspace import project_root
from sqlalchemy.orm import Session


def test_profile_clean_and_feature_engineering_create_traceable_artifacts(
    tmp_path: Path, session: Session
) -> None:
    csv_path = tmp_path / "orders.csv"
    pd.DataFrame(
        {
            "ordered_at": ["2026-01-01", "2026-01-02", "2026-01-02", "2026-01-02"],
            "value": [10.0, None, 20.0, 20.0],
            "segment": ["A", "B", "B", "B"],
        }
    ).to_csv(csv_path, index=False)
    repository = Repository(session)
    project = repository.create_project("Analysis")
    source = DataSourceService(repository).attach_file(
        project.id, SourceType.CSV, csv_path, csv_path.name
    )
    extract = QueryService(repository).run(project.id, source.id, "SELECT * FROM data", "Orders")
    service = AnalysisService(repository)
    profile = service.profile(project.id, extract.id, "Profile")
    assert profile.artifact_metadata["duplicate_rows"] == 1
    cleaned = service.clean(project.id, extract.id, "Cleaned", True, "median_mode", False)
    assert cleaned["data"].artifact_metadata["rows"] == 3
    featured = service.engineer_features(
        project.id,
        cleaned["data"].id,
        "Featured",
        ["ordered_at"],
        ["value"],
        [],
    )
    columns = featured["data"].artifact_metadata["columns"]
    assert "ordered_at__month" in columns
    assert "value__log1p" in columns
    assert (project_root(project.id) / featured["data"].path).is_file()
    assert featured["data"].lineage[0] == cleaned["data"].id
