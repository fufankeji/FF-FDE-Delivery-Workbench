#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repository_root="$(cd "$script_dir/.." && pwd)"
app_dir="$repository_root/app/deepseek-harness"

if ! command -v node >/dev/null 2>&1; then
  echo "[install] 未找到 Node.js。需要 Node.js 22.19.0+ 或 24+。" >&2
  exit 1
fi

node_major="$(node -p 'Number(process.versions.node.split(".")[0])')"
node_minor="$(node -p 'Number(process.versions.node.split(".")[1])')"
if (( node_major < 22 )) || (( node_major == 22 && node_minor < 19 )); then
  echo "[install] 当前 Node.js 版本为 $(node --version)，需要 22.19.0+ 或 24+。" >&2
  exit 1
fi

if ! command -v corepack >/dev/null 2>&1; then
  echo "[install] 未找到 Corepack，请先安装或启用 Corepack。" >&2
  exit 1
fi

echo "[install] 安装工作台依赖..."
corepack pnpm --dir "$app_dir" install --frozen-lockfile

echo "[install] 构建工作台..."
corepack pnpm --dir "$app_dir" run build

echo "[install] 恢复隔离工作区与历史会话..."
node "$script_dir/restore-handoff-state.mjs"

echo "[install] 完成。执行 ./scripts/start.sh 启动工作台。"
