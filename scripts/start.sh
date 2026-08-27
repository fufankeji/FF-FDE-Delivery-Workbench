#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repository_root="$(cd "$script_dir/.." && pwd)"
app_dir="$repository_root/app/deepseek-harness"
runtime_dir="$repository_root/.runtime/dsh-home"
fde_host="${FDE_HOST:-127.0.0.1}"
fde_port="${FDE_PORT:-3080}"

node "$script_dir/restore-handoff-state.mjs"

if [[ ! -d "$app_dir/node_modules" ]]; then
  echo "[start] 尚未安装工作台依赖，请先执行 ./scripts/install.sh。" >&2
  exit 1
fi

echo "[start] 使用隔离 DSH_HOME：$runtime_dir"
echo "[start] 数据分析项目：$repository_root/workspaces/ai-analysis"
echo "[start] 访问地址：http://$fde_host:$fde_port"

cd "$app_dir"
DSH_HOME="$runtime_dir" corepack pnpm dsh web --no-open --host "$fde_host" --port "$fde_port"
