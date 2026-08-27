#!/usr/bin/env python3
"""Start the standalone DS4 learner API without reading repository credentials."""

from __future__ import annotations

import argparse

import uvicorn


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()
    uvicorn.run("northlight.main:app", host=args.host, port=args.port, app_dir="backend")


if __name__ == "__main__":
    main()
