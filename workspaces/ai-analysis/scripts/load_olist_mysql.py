from __future__ import annotations

import argparse
import json
import os
import secrets
import subprocess
from pathlib import Path
from urllib.parse import quote_plus

import pandas as pd
from sqlalchemy import create_engine, text


def mysql_command(socket_path: Path, sql: str) -> None:
    subprocess.run(
        [
            "/opt/homebrew/opt/mysql@8.4/bin/mysql",
            f"--socket={socket_path}",
            "-u",
            "root",
            "-e",
            sql,
        ],
        check=True,
    )


def table_name(path: Path) -> str:
    return path.stem.removeprefix("olist_").removesuffix("_dataset")


def main() -> int:
    parser = argparse.ArgumentParser(description="Load Olist into local manual MySQL")
    parser.add_argument("--root", type=Path, default=Path(".runtime/datasets/olist"))
    parser.add_argument("--socket", type=Path, default=Path("/tmp/northlight-mysql.sock"))
    parser.add_argument("--port", type=int, default=3307)
    args = parser.parse_args()
    if not args.socket.exists():
        raise SystemExit(
            f"MySQL socket is missing: {args.socket}. Run scripts/mysql-local.sh start"
        )

    password = secrets.token_urlsafe(32)
    escaped = password.replace("'", "''")
    mysql_command(
        args.socket,
        "CREATE DATABASE IF NOT EXISTS northlight_olist CHARACTER SET utf8mb4;"
        "DROP USER IF EXISTS 'northlight_reader'@'127.0.0.1';"
        f"CREATE USER 'northlight_reader'@'127.0.0.1' IDENTIFIED BY '{escaped}';"
        "GRANT SELECT ON northlight_olist.* TO 'northlight_reader'@'127.0.0.1';"
        "FLUSH PRIVILEGES;",
    )

    root_engine = create_engine(
        f"mysql+pymysql://root@localhost/northlight_olist?unix_socket={quote_plus(str(args.socket))}"
    )
    counts: dict[str, int] = {}
    for csv_path in sorted((args.root / "raw").glob("*.csv")):
        name = table_name(csv_path)
        frame = pd.read_csv(csv_path, low_memory=False)
        frame.to_sql(name, root_engine, if_exists="replace", index=False, chunksize=5_000)
        counts[name] = len(frame)

    credentials_path = Path(".runtime/mysql/reader.env")
    credentials_path.parent.mkdir(parents=True, exist_ok=True)
    credentials_path.write_text(
        "NORTHLIGHT_TEST_MYSQL_HOST=127.0.0.1\n"
        f"NORTHLIGHT_TEST_MYSQL_PORT={args.port}\n"
        "NORTHLIGHT_TEST_MYSQL_DATABASE=northlight_olist\n"
        "NORTHLIGHT_TEST_MYSQL_USER=northlight_reader\n"
        f"NORTHLIGHT_TEST_MYSQL_PASSWORD={password}\n",
        encoding="utf-8",
    )
    os.chmod(credentials_path, 0o600)
    manifest_path = args.root / "mysql-manifest.json"
    manifest_path.write_text(
        json.dumps(
            {
                "host": "127.0.0.1",
                "port": args.port,
                "database": "northlight_olist",
                "user": "northlight_reader",
                "privileges": ["SELECT"],
                "tables": counts,
                "credentials_file": str(credentials_path),
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    with root_engine.connect() as connection:
        table_count = connection.execute(
            text(
                "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='northlight_olist'"
            )
        ).scalar_one()
    print(f"Loaded {table_count} Olist tables into local MySQL with a SELECT-only app user")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
