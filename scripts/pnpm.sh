#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repository_root="$(cd "$script_dir/.." && pwd)"
app_dir="$repository_root/app/deepseek-harness"

if ! command -v npx >/dev/null 2>&1; then
  echo "[pnpm] 未找到 npx。请安装包含 npm/npx 的 Node.js 发行版。" >&2
  exit 1
fi

package_manager="$(node -p "require('$app_dir/package.json').packageManager")"
if [[ "$package_manager" != pnpm@* ]]; then
  echo "[pnpm] package.json 未声明有效的 pnpm 版本：$package_manager" >&2
  exit 1
fi

exec npx --yes "$package_manager" --dir "$app_dir" "$@"
