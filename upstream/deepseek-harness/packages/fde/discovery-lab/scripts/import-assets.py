#!/usr/bin/env python3
"""Import the pinned delivery runtime, never teacher/source archives or runtime data."""
import hashlib
import io
import json
from pathlib import Path, PurePosixPath
import sys
import tarfile
import zipfile

RUNTIME_SHA256 = "2c68c7b2ef51f6e92c1cb00e796dbbdb249362eb249821152a9f26128e057678"
RUNTIME_ENTRY = "FDE-业务挖掘实验室-v0.3.2/安装包/jiutian-fde-discovery-lab-0.3.2.tgz"
CASE_IDS = {"finance", "manufacturing", "operations", "internal-service", "logistics"}
TARGET = Path(__file__).resolve().parents[1] / ".assets"

def main():
    if len(sys.argv) != 2:
        raise SystemExit("Usage: python3 scripts/import-assets.py <完整交付-v0.3.2.zip>")
    with zipfile.ZipFile(sys.argv[1]) as archive:
        packed = archive.read(RUNTIME_ENTRY)
    if hashlib.sha256(packed).hexdigest() != RUNTIME_SHA256:
        raise SystemExit("Runtime SHA256 mismatch; no files written")
    with tarfile.open(fileobj=io.BytesIO(packed), mode="r:gz") as runtime:
        entries = {m.name.removeprefix("package/"): m for m in runtime.getmembers()}
        def read(name):
            path = PurePosixPath(name)
            member = entries[name]
            if path.is_absolute() or ".." in path.parts or not member.isfile():
                raise ValueError(f"Unsafe runtime entry: {name}")
            return runtime.extractfile(member).read()
        selected = {}
        assets = {}
        for case_id in sorted(CASE_IDS):
            name = f"cases/{case_id}/case.json"
            selected[name] = read(name)
            case = json.loads(selected[name])
            if case["id"] != case_id:
                raise ValueError("Case identity mismatch")
            for asset in case["assets"]:
                name = asset["path"]
                if not name.startswith("source-materials/"):
                    raise ValueError(f"Unexpected asset root: {name}")
                data = read(name)
                if hashlib.sha256(data).hexdigest() != asset["sha256"]:
                    raise ValueError(f"Asset SHA256 mismatch: {name}")
                selected[name] = data
                assets[name] = True
        for name in entries:
            path = PurePosixPath(name)
            if (path.parent == PurePosixPath("cases") and path.suffix == ".py") or name in {
                "development/fonts/NotoSansCJKsc-Regular.otf",
                "development/fonts/LICENSE",
                "THIRD_PARTY_NOTICES.md",
            }:
                selected[name] = read(name)
        # Verify the whole write set before creating a reusable asset tree.
        for name, data in selected.items():
            destination = TARGET / name
            if destination.exists() and destination.read_bytes() != data:
                raise ValueError(f"Existing asset differs; preserve it and inspect first: {destination}")
            if not destination.resolve().is_relative_to(TARGET.resolve()):
                raise ValueError(f"Asset destination escapes target: {destination}")
        for name, data in selected.items():
            destination = TARGET / name
            destination.parent.mkdir(parents=True, exist_ok=True)
            if not destination.exists():
                destination.write_bytes(data)
    print(json.dumps({"runtimeSha256": RUNTIME_SHA256, "cases": len(CASE_IDS),
                      "authorizedAssets": len(assets), "files": len(selected),
                      "bytes": sum(map(len, selected.values())), "directory": str(TARGET)},
                     ensure_ascii=False))

if __name__ == "__main__":
    main()
