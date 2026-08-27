#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
base_image="${NORTHLIGHT_SANDBOX_BASE:-python:3.12-slim}"
docker build \
  --tag northlight-python-sandbox:0.1 \
  --build-arg "PYTHON_BASE=${base_image}" \
  --file "${project_root}/sandbox/Dockerfile" \
  "${project_root}/sandbox"
