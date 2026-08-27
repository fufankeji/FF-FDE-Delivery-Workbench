#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "Usage: $0 <workspace-directory> <python-script> [script-args...]" >&2
  exit 2
fi

workspace="$(cd "$1" && pwd)"
script="$2"
shift 2

if [[ "${script}" == /* || "${script}" == *".."* ]]; then
  echo "Script path must be relative to the workspace and cannot contain '..'." >&2
  exit 2
fi

# Docker Desktop can block bind mounts from some external or removable volumes.
# Stage the selected workspace under /tmp, which is shared with the VM, then copy
# the resulting files back only after a successful container run.
stage="$(mktemp -d /tmp/northlight-sandbox.XXXXXX)"
cleanup() {
  rm -rf -- "${stage}"
}
trap cleanup EXIT
rsync -a "${workspace}/" "${stage}/"

docker run --rm \
  --pull never \
  --network none \
  --read-only \
  --tmpfs /tmp:rw,noexec,nosuid,size=256m \
  --cpus 2 \
  --memory 2g \
  --pids-limit 128 \
  --security-opt no-new-privileges \
  --cap-drop ALL \
  --user 10001:10001 \
  --mount "type=bind,src=${stage},dst=/workspace" \
  northlight-python-sandbox:0.1 \
  "${script}" "$@"

rsync -a "${stage}/" "${workspace}/"
