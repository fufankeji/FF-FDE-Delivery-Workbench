from __future__ import annotations

import argparse
import json
import platform
import time
from datetime import UTC, datetime
from pathlib import Path

import duckdb
import psutil


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Run Northlight's 1M-row local analytics benchmark"
    )
    parser.add_argument("--rows", type=int, default=1_000_000)
    parser.add_argument("--data", type=Path, default=Path(".runtime/benchmarks/million.parquet"))
    parser.add_argument(
        "--output", type=Path, default=Path("../evidence/performance/million-row.json")
    )
    args = parser.parse_args()
    args.data.parent.mkdir(parents=True, exist_ok=True)
    args.output.parent.mkdir(parents=True, exist_ok=True)

    process = psutil.Process()
    connection = duckdb.connect()
    started = time.perf_counter()
    escaped_data = str(args.data.resolve()).replace("'", "''")
    connection.execute(
        f"""
        COPY (
          SELECT
            range AS order_row,
            ['SP','RJ','MG','PR','BA'][1 + (range % 5)] AS state,
            20 + (range % 980) * 0.73 AS revenue,
            DATE '2024-01-01' + CAST(range % 365 AS INTEGER) AS order_date,
            range % 7 AS delivery_days
          FROM range({args.rows})
        ) TO '{escaped_data}' (FORMAT PARQUET, COMPRESSION ZSTD)
        """
    )
    generated_seconds = time.perf_counter() - started
    query_started = time.perf_counter()
    result = connection.execute(
        f"""
        SELECT state, COUNT(*) AS orders, SUM(revenue) AS revenue,
               AVG(delivery_days) AS avg_delivery_days
        FROM read_parquet('{escaped_data}')
        GROUP BY state ORDER BY revenue DESC
        """
    ).fetchall()
    query_seconds = time.perf_counter() - query_started
    count = connection.execute(f"SELECT COUNT(*) FROM read_parquet('{escaped_data}')").fetchone()[0]
    connection.close()
    payload = {
        "schema_version": 1,
        "run_at": datetime.now(UTC).isoformat(),
        "environment": {
            "platform": platform.platform(),
            "python": platform.python_version(),
            "logical_cpu": psutil.cpu_count(),
            "memory_bytes": psutil.virtual_memory().total,
        },
        "input": {"rows": args.rows, "parquet_bytes": args.data.stat().st_size},
        "results": {
            "row_count_verified": int(count),
            "generation_seconds": round(generated_seconds, 4),
            "aggregation_seconds": round(query_seconds, 4),
            "process_rss_bytes": process.memory_info().rss,
            "groups": [
                {
                    "state": row[0],
                    "orders": int(row[1]),
                    "revenue": float(row[2]),
                    "avg_delivery_days": float(row[3]),
                }
                for row in result
            ],
        },
        "acceptance": {
            "row_count_exact": int(count) == args.rows,
            "bounded_preview_policy": 200,
            "interactive_query_limit": 5_000,
        },
    }
    args.output.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps(payload["results"], ensure_ascii=False))
    return 0 if payload["acceptance"]["row_count_exact"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
