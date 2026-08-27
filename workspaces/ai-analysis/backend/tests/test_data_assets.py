from pathlib import Path

from northlight.data_assets import DataAssetService
from northlight.data_sources import DataSourceService
from northlight.domain import SourceType
from northlight.repository import Repository
from sqlalchemy.orm import Session


def test_global_data_asset_can_be_bound_into_isolated_projects(
    tmp_path: Path, session: Session
) -> None:
    csv_path = tmp_path / "orders.csv"
    csv_path.write_text("region,revenue\n华东,12\n华南,8\n", encoding="utf-8")
    repository = Repository(session)
    first = repository.create_project("华东经营分析")
    second = repository.create_project("全国经营分析")
    service = DataAssetService(repository)

    asset = service.create_file(SourceType.CSV, csv_path, csv_path.name)
    first_source = service.bind(first.id, asset.id)
    second_source = service.bind(second.id, asset.id)

    assert first_source.project_id == first.id
    assert second_source.project_id == second.id
    assert first_source.id != second_source.id
    assert Path(str(first_source.config["path"])).is_file()
    assert Path(str(second_source.config["path"])).is_file()
    assert len(repository.list_data_asset_bindings(asset.id)) == 2
    assert service.bind(first.id, asset.id).id == first_source.id


def test_existing_project_sources_are_imported_into_catalog(
    tmp_path: Path, session: Session
) -> None:
    csv_path = tmp_path / "customers.csv"
    csv_path.write_text("customer_id,segment\n1,A\n", encoding="utf-8")
    repository = Repository(session)
    project = repository.create_project("客户分析")
    source = DataSourceService(repository).attach_file(
        project.id, SourceType.CSV, csv_path
    )

    service = DataAssetService(repository)
    service.import_existing_sources()

    assets = repository.list_data_assets()
    assert len(assets) == 1
    assert assets[0].fingerprint == source.fingerprint
    binding = repository.get_project_data_asset(project.id, assets[0].id)
    assert binding is not None
    assert binding.source_id == source.id


def test_asset_with_project_usage_cannot_be_deleted(
    tmp_path: Path, session: Session
) -> None:
    csv_path = tmp_path / "orders.csv"
    csv_path.write_text("id\n1\n", encoding="utf-8")
    repository = Repository(session)
    project = repository.create_project("订单分析")
    service = DataAssetService(repository)
    asset = service.create_file(SourceType.CSV, csv_path)
    service.bind(project.id, asset.id)

    try:
        service.delete(asset.id)
    except ValueError as exc:
        assert "still used" in str(exc)
    else:
        raise AssertionError("used data asset was deleted")


def test_data_asset_preview_returns_200_rows_and_editable_field_dictionary(
    tmp_path: Path, session: Session
) -> None:
    csv_path = tmp_path / "orders.csv"
    csv_path.write_text(
        "order_id,revenue\n"
        + "\n".join(f"order-{index},{index * 10}" for index in range(250))
        + "\n",
        encoding="utf-8",
    )
    service = DataAssetService(Repository(session))
    asset = service.create_file(SourceType.CSV, csv_path)

    preview = service.preview(asset.id, None, 0, 200)

    assert preview["total"] == 250
    assert len(preview["rows"]) == 200
    fields = preview["fields"]
    assert isinstance(fields, list)
    assert fields[0]["description"]

    service.update_dictionary(
        asset.id,
        "csv",
        {"order_id": "订单在源系统中的唯一编号", "revenue": "订单含税收入"},
    )
    updated = service.preview(asset.id, "csv", 0, 10)
    updated_fields = updated["fields"]
    assert isinstance(updated_fields, list)
    assert updated_fields[0]["description"] == "订单在源系统中的唯一编号"
