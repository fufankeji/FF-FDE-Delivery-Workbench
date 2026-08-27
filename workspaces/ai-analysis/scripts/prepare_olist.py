from __future__ import annotations

import argparse
import hashlib
import json
import sqlite3
import zipfile
from collections.abc import Iterable
from datetime import UTC, datetime
from pathlib import Path

import pandas as pd

DATASET_URL = "https://www.kaggle.com/datasets/olistbr/brazilian-ecommerce"
LICENSE = "CC BY-NC-SA 4.0"


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def count_csv_rows(path: Path) -> int:
    with path.open("r", encoding="utf-8", newline="") as handle:
        return max(sum(1 for _ in handle) - 1, 0)


def table_name(path: Path) -> str:
    name = path.stem
    return name.removeprefix("olist_").removesuffix("_dataset")


def extract_archive(archive: Path, raw_dir: Path) -> list[Path]:
    raw_dir.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(archive) as bundle:
        bundle.extractall(raw_dir)
    return sorted(raw_dir.glob("*.csv"))


def load_sqlite(csv_paths: Iterable[Path], database: Path) -> dict[str, int]:
    database.parent.mkdir(parents=True, exist_ok=True)
    if database.exists():
        database.unlink()
    counts: dict[str, int] = {}
    connection = sqlite3.connect(database)
    try:
        for csv_path in csv_paths:
            name = table_name(csv_path)
            frame = pd.read_csv(csv_path, low_memory=False)
            frame.to_sql(name, connection, if_exists="replace", index=False, chunksize=10_000)
            counts[name] = len(frame)
        connection.execute("CREATE INDEX idx_orders_customer ON orders(customer_id)")
        connection.execute("CREATE INDEX idx_items_order ON order_items(order_id)")
        connection.execute("CREATE INDEX idx_reviews_order ON order_reviews(order_id)")
        connection.commit()
    finally:
        connection.close()
    return counts


def select_order_subset(raw_dir: Path, limit: int) -> dict[str, pd.DataFrame]:
    orders = pd.read_csv(raw_dir / "olist_orders_dataset.csv", low_memory=False).head(limit)
    order_ids = set(orders["order_id"])
    customer_ids = set(orders["customer_id"])
    frames: dict[str, pd.DataFrame] = {"orders": orders}

    customers = pd.read_csv(raw_dir / "olist_customers_dataset.csv", low_memory=False)
    frames["customers"] = customers[customers["customer_id"].isin(customer_ids)]

    for filename, sheet in (
        ("olist_order_items_dataset.csv", "order_items"),
        ("olist_order_payments_dataset.csv", "payments"),
        ("olist_order_reviews_dataset.csv", "reviews"),
    ):
        frame = pd.read_csv(raw_dir / filename, low_memory=False)
        frames[sheet] = frame[frame["order_id"].isin(order_ids)]

    product_ids = set(frames["order_items"]["product_id"])
    seller_ids = set(frames["order_items"]["seller_id"])
    products = pd.read_csv(raw_dir / "olist_products_dataset.csv", low_memory=False)
    sellers = pd.read_csv(raw_dir / "olist_sellers_dataset.csv", low_memory=False)
    frames["products"] = products[products["product_id"].isin(product_ids)]
    frames["sellers"] = sellers[sellers["seller_id"].isin(seller_ids)]
    return frames


def write_excel(raw_dir: Path, output: Path, limit: int) -> dict[str, int]:
    output.parent.mkdir(parents=True, exist_ok=True)
    frames = select_order_subset(raw_dir, limit)
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        for sheet, frame in frames.items():
            frame.to_excel(writer, sheet_name=sheet[:31], index=False)
    return {sheet: len(frame) for sheet, frame in frames.items()}


def write_manifest(
    archive: Path,
    csv_paths: list[Path],
    sqlite_path: Path,
    excel_path: Path,
    output: Path,
    sqlite_counts: dict[str, int],
    excel_counts: dict[str, int],
) -> None:
    payload = {
        "dataset": "Brazilian E-Commerce Public Dataset by Olist",
        "source_url": DATASET_URL,
        "license": LICENSE,
        "prepared_at": datetime.now(UTC).isoformat(),
        "archive": {
            "path": str(archive),
            "sha256": sha256(archive),
            "bytes": archive.stat().st_size,
        },
        "csv_files": [
            {
                "path": str(path),
                "table": table_name(path),
                "rows": count_csv_rows(path),
                "bytes": path.stat().st_size,
                "sha256": sha256(path),
            }
            for path in csv_paths
        ],
        "sqlite": {
            "path": str(sqlite_path),
            "bytes": sqlite_path.stat().st_size,
            "sha256": sha256(sqlite_path),
            "tables": sqlite_counts,
        },
        "excel": {
            "path": str(excel_path),
            "bytes": excel_path.stat().st_size,
            "sha256": sha256(excel_path),
            "sheets": excel_counts,
            "note": "Referentially consistent subset of the first 25000 orders for Excel acceptance tests.",
        },
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description="Prepare Olist CSV, Excel and SQLite fixtures")
    parser.add_argument("--root", type=Path, default=Path(".runtime/datasets/olist"))
    parser.add_argument("--excel-orders", type=int, default=25_000)
    args = parser.parse_args()
    archive = args.root / "olist.zip"
    if not archive.is_file():
        raise SystemExit(f"Missing archive: {archive}")
    raw_dir = args.root / "raw"
    csv_paths = extract_archive(archive, raw_dir)
    sqlite_path = args.root / "olist.sqlite3"
    excel_path = args.root / "olist-25000-orders.xlsx"
    sqlite_counts = load_sqlite(csv_paths, sqlite_path)
    excel_counts = write_excel(raw_dir, excel_path, args.excel_orders)
    write_manifest(
        archive,
        csv_paths,
        sqlite_path,
        excel_path,
        args.root / "manifest.json",
        sqlite_counts,
        excel_counts,
    )
    print(f"Prepared {len(csv_paths)} CSV files, SQLite and Excel under {args.root}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
