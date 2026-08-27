#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
runtime_root="${project_root}/.runtime/mysql"
data_dir="${runtime_root}/data"
socket_path="/tmp/northlight-mysql.sock"
pid_file="${runtime_root}/mysql.pid"
log_file="${runtime_root}/mysql.log"
mysql_home="/opt/homebrew/opt/mysql@8.4"
port="3307"

mkdir -p "${runtime_root}"

is_running() {
  [[ -f "${pid_file}" ]] && kill -0 "$(<"${pid_file}")" 2>/dev/null
}

case "${1:-status}" in
  start)
    if is_running; then
      echo "Northlight MySQL is already running on port ${port}."
      exit 0
    fi
    if [[ ! -d "${data_dir}/mysql" ]]; then
      mkdir -p "${data_dir}"
      "${mysql_home}/bin/mysqld" \
        --initialize-insecure \
        --basedir="${mysql_home}" \
        --datadir="${data_dir}"
    fi
    "${mysql_home}/bin/mysqld_safe" \
      --basedir="${mysql_home}" \
      --datadir="${data_dir}" \
      --socket="${socket_path}" \
      --port="${port}" \
      --pid-file="${pid_file}" \
      --log-error="${log_file}" \
      --skip-mysqlx \
      >/dev/null 2>&1 &
    for _ in {1..60}; do
      if "${mysql_home}/bin/mysqladmin" --socket="${socket_path}" -u root ping >/dev/null 2>&1; then
        echo "Northlight MySQL started manually on 127.0.0.1:${port}."
        exit 0
      fi
      sleep 0.5
    done
    echo "[ERROR] MySQL did not become ready. Inspect ${log_file}." >&2
    exit 1
    ;;
  stop)
    if ! is_running; then
      echo "Northlight MySQL is not running."
      exit 0
    fi
    "${mysql_home}/bin/mysqladmin" --socket="${socket_path}" -u root shutdown
    rm -f "${socket_path}"
    echo "Northlight MySQL stopped."
    ;;
  status)
    if is_running; then
      echo "running pid=$(<"${pid_file}") port=${port}"
    else
      echo "stopped"
    fi
    ;;
  *)
    echo "Usage: $0 {start|stop|status}" >&2
    exit 2
    ;;
esac
