#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
runtime_root="${project_root}/.runtime"
log_root="${runtime_root}/logs"
api_port="${NORTHLIGHT_API_PORT:-8000}"
web_port="${NORTHLIGHT_WEB_PORT:-5173}"
api_url="http://127.0.0.1:${api_port}"
mkdir -p "${log_root}"
last_start=0

record_matches() {
  local pid_file="$1"
  local expected="$2"
  [[ -f "${pid_file}" ]] || return 1
  local pid signature current
  IFS=$'\t' read -r pid signature <"${pid_file}" || return 1
  [[ "${signature}" == "${expected}" ]] || return 1
  current="$(ps -p "${pid}" -o command= 2>/dev/null || true)"
  [[ -n "${current}" && "${current}" == *"${expected}"* ]]
}

stop_owned_process() {
  local name="$1"
  local signature="$2"
  local pid_file="${runtime_root}/${name}.pid"
  if record_matches "${pid_file}" "${signature}"; then
    local pid
    IFS=$'\t' read -r pid _ <"${pid_file}"
    kill "${pid}" 2>/dev/null || true
  fi
  rm -f -- "${pid_file}"
}

start_process() {
  local name="$1"
  local signature="$2"
  local pid_file="${runtime_root}/${name}.pid"
  shift 2
  last_start=0
  if record_matches "${pid_file}" "${signature}"; then
    echo "${name} is already running."
    return
  fi
  rm -f -- "${pid_file}"
  (
    cd "${project_root}"
    nohup "$@" >"${log_root}/${name}.log" 2>&1 &
    printf '%s\t%s\n' "$!" "${signature}" >"${pid_file}"
  )
  last_start=1
}

if [[ "${NORTHLIGHT_START_MYSQL:-0}" == "1" && -d "${runtime_root}/mysql/data/mysql" ]]; then
  if ! "${project_root}/scripts/mysql-local.sh" status | grep -q '^running'; then
    "${project_root}/scripts/mysql-local.sh" start
    touch "${runtime_root}/mysql-owned-by-app"
  fi
fi

if [[ "${NORTHLIGHT_START_MYSQL:-0}" == "1" && -f "${runtime_root}/mysql/reader.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "${runtime_root}/mysql/reader.env"
  set +a
  export NORTHLIGHT_MYSQL_URL="mysql+pymysql://${NORTHLIGHT_TEST_MYSQL_USER}:${NORTHLIGHT_TEST_MYSQL_PASSWORD}@${NORTHLIGHT_TEST_MYSQL_HOST}:${NORTHLIGHT_TEST_MYSQL_PORT}/${NORTHLIGHT_TEST_MYSQL_DATABASE}"
fi

start_process api "scripts/serve_api.py" "${project_root}/.venv/bin/python" scripts/serve_api.py --host 0.0.0.0 --port "${api_port}"
api_started="${last_start}"
for _ in {1..120}; do
  if curl --noproxy '*' -fsS "${api_url}/api/health" >/dev/null 2>&1; then
    break
  fi
  sleep 0.5
done
if ! curl --noproxy '*' -fsS "${api_url}/api/health" >/dev/null 2>&1; then
  echo "[ERROR] API did not become ready. Inspect ${log_root}/api.log." >&2
  [[ "${api_started}" == "1" ]] && stop_owned_process api "scripts/serve_api.py"
  if [[ -f "${runtime_root}/mysql-owned-by-app" ]]; then
    "${project_root}/scripts/mysql-local.sh" stop
    rm -f -- "${runtime_root}/mysql-owned-by-app"
  fi
  exit 1
fi

start_process web "vite" env "VITE_API_PROXY=${api_url}" "${project_root}/frontend/node_modules/.bin/vite" frontend --host 0.0.0.0 --port "${web_port}" --strictPort
web_started="${last_start}"
for _ in {1..120}; do
  if curl --noproxy '*' -fsS "http://127.0.0.1:${web_port}" >/dev/null 2>&1; then
    echo "DS4 is ready at http://127.0.0.1:${web_port} and http://<LAN-IP>:${web_port}"
    exit 0
  fi
  sleep 0.5
done
echo "[ERROR] Web UI did not become ready. Inspect ${log_root}/web.log." >&2
[[ "${web_started}" == "1" ]] && stop_owned_process web "vite"
[[ "${api_started}" == "1" ]] && stop_owned_process api "scripts/serve_api.py"
if [[ -f "${runtime_root}/mysql-owned-by-app" ]]; then
  "${project_root}/scripts/mysql-local.sh" stop
  rm -f -- "${runtime_root}/mysql-owned-by-app"
fi
exit 1
