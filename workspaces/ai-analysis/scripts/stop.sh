#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
runtime_root="${project_root}/.runtime"

stop_process() {
  local name="$1"
  local expected="$2"
  local pid_file="${runtime_root}/${name}.pid"
  if [[ ! -f "${pid_file}" ]]; then
    return
  fi
  local pid signature current
  IFS=$'\t' read -r pid signature <"${pid_file}" || true
  current="$(ps -p "${pid:-0}" -o command= 2>/dev/null || true)"
  if [[ "${signature:-}" != "${expected}" || -z "${current}" || "${current}" != *"${expected}"* ]]; then
    echo "[WARN] Refusing to stop ${name}: PID identity no longer matches ${expected}." >&2
    rm -f -- "${pid_file}"
    return
  fi
  if kill -0 "${pid}" 2>/dev/null; then
    kill "${pid}"
    for _ in {1..20}; do
      kill -0 "${pid}" 2>/dev/null || break
      sleep 0.1
    done
  fi
  rm -f -- "${pid_file}"
}

stop_process web "vite"
stop_process api "scripts/serve_api.py"
if [[ -f "${runtime_root}/mysql-owned-by-app" ]]; then
  "${project_root}/scripts/mysql-local.sh" stop
  rm -f -- "${runtime_root}/mysql-owned-by-app"
fi
echo "Northlight local services stopped."
