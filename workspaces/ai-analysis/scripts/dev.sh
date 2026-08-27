#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
api_port="${NORTHLIGHT_API_PORT:-8000}"
web_port="${NORTHLIGHT_WEB_PORT:-5173}"
api_pid=""
web_pid=""
mysql_started_here=0

cleanup() {
  trap - EXIT
  [[ -n "${web_pid}" ]] && kill "${web_pid}" 2>/dev/null || true
  [[ -n "${api_pid}" ]] && kill "${api_pid}" 2>/dev/null || true
  wait "${web_pid}" 2>/dev/null || true
  wait "${api_pid}" 2>/dev/null || true
  if [[ "${mysql_started_here}" == "1" ]]; then
    "${project_root}/scripts/mysql-local.sh" stop >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT
trap 'exit 0' INT TERM

cd "${project_root}"
if [[ "${NORTHLIGHT_START_MYSQL:-0}" == "1" && -d ".runtime/mysql/data/mysql" ]]; then
  if ! ./scripts/mysql-local.sh status | grep -q '^running'; then
    ./scripts/mysql-local.sh start
    mysql_started_here=1
  fi
fi
if [[ "${NORTHLIGHT_START_MYSQL:-0}" == "1" && -f ".runtime/mysql/reader.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source ".runtime/mysql/reader.env"
  set +a
  export NORTHLIGHT_MYSQL_URL="mysql+pymysql://${NORTHLIGHT_TEST_MYSQL_USER}:${NORTHLIGHT_TEST_MYSQL_PASSWORD}@${NORTHLIGHT_TEST_MYSQL_HOST}:${NORTHLIGHT_TEST_MYSQL_PORT}/${NORTHLIGHT_TEST_MYSQL_DATABASE}"
fi

NO_PROXY="127.0.0.1,localhost" no_proxy="127.0.0.1,localhost" \
  .venv/bin/python scripts/serve_api.py --host 0.0.0.0 --port "${api_port}" &
api_pid="$!"
NO_PROXY="127.0.0.1,localhost" no_proxy="127.0.0.1,localhost" VITE_API_PROXY="http://127.0.0.1:${api_port}" \
  frontend/node_modules/.bin/vite frontend --host 0.0.0.0 --port "${web_port}" --strictPort &
web_pid="$!"

echo "DS4 is starting at http://127.0.0.1:${web_port} and http://<LAN-IP>:${web_port} (Ctrl-C stops app and project MySQL)."
while kill -0 "${api_pid}" 2>/dev/null && kill -0 "${web_pid}" 2>/dev/null; do
  sleep 1
done
echo "[ERROR] A Northlight process exited unexpectedly." >&2
exit 1
