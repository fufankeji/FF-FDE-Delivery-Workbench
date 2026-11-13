#!/usr/bin/env python3
"""Package the pinned product tree without private/untracked development state."""
import argparse
from datetime import date
import fnmatch
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import stat
import subprocess
import tempfile
import tomllib
import zipfile


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--dry-run', action='store_true')
    args = parser.parse_args()
    root = Path(__file__).resolve().parent.parent
    config = tomllib.loads((root / 'student-delivery/bundle.toml').read_text())
    version = json.loads((root / 'student-delivery/SOURCE_VERSION.json').read_text())

    def git(*argv):
        return subprocess.check_output(['git', '-C', str(root), *argv])

    commit = git('rev-parse', 'HEAD').decode().strip()
    version['sourceCommit'] = commit
    harness = json.loads((root / 'upstream/deepseek-harness.lock.json').read_text())
    if version['harnessVersion'] != harness['release'] or version['releaseDate'] != config['release_date']:
        raise RuntimeError('Delivery metadata does not match the locked release')
    subprocess.run(['git', '-C', str(root), 'diff', '--quiet', 'HEAD', '--', *config['include']], check=True)
    tracked = set(git('ls-files', '-z').decode().split('\0')) - {''}
    names = set(config['exclude_names']) | {'.git', '.runtime', 'node_modules', 'dist', 'build', 'coverage', '__pycache__', '.venv', '.cache', '.DS_Store'}
    globs = config['exclude_globs']
    selected = {}
    materialized = []
    excluded = 0
    protected = re.compile(r'^(?:\.env(?:\..+)?|\.?(?:credentials?|secrets?|tokens?)(?:\.[^.]+)?\.(?:env|json|toml|ya?ml)|id_rsa|id_ed25519)$', re.I)

    def safe_path(value):
        path = PurePosixPath(value)
        if path.is_absolute() or '..' in path.parts or '\\' in value or not path.parts:
            raise RuntimeError(f'Unsafe path: {value}')
        return path

    for name in sorted(tracked):
        if not any(name == prefix or name.startswith(prefix + '/') for prefix in config['include']):
            continue
        path = safe_path(name)
        if names.intersection(path.parts) or any(fnmatch.fnmatch(name, glob) for glob in globs):
            excluded += 1
            continue
        if protected.match(path.name) and not path.name.endswith('.i18n.yaml') and not re.search(r'\.(example|sample|template)(\.|$)', path.name):
            raise RuntimeError(f'Protected filename: {name}')
        if path.suffix.lower() in {'.pem', '.p12', '.pfx', '.key'}:
            raise RuntimeError(f'Protected key file: {name}')
        source = root / name
        if source.is_symlink():
            resolved = source.resolve(strict=True)
            target = resolved.relative_to(root).as_posix()
            if target not in tracked or not resolved.is_file():
                raise RuntimeError(f'Untracked/outside/directory symlink: {name}')
            materialized.append({'path': name, 'source': target})
            source = resolved
        if not source.is_file():
            raise RuntimeError(f'Not a regular source file: {name}')
        selected[name] = source

    for item in config['delivery_files']:
        safe_path(item['source'])
        safe_path(item['target'])
        if item['target'] in selected:
            raise RuntimeError(f'Duplicate delivery path: {item["target"]}')
        source = root / item['source']
        if source.is_symlink() or not source.is_file():
            raise RuntimeError(f'Invalid delivery source: {item["source"]}')
        selected[item['target']] = source

    secret = re.compile(rb'(?<![A-Za-z0-9_-])(?:ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,}|sk-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{30,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)')
    test_fixtures = set(config['reviewed_test_credential_files'])
    history = set(config['reviewed_historical_path_files'])
    version_bytes = (json.dumps(version, ensure_ascii=False, indent=2) + '\n').encode()

    def payload(name, source):
        return version_bytes if name == 'SOURCE_VERSION.json' else source.read_bytes()

    records = []
    for name, source in sorted(selected.items()):
        data = payload(name, source)
        if secret.search(data) and name not in test_fixtures:
            raise RuntimeError(f'Credential-shaped content needs review: {name}')
        if (str(root).encode() in data or str(Path.home()).encode() in data) and name not in history:
            raise RuntimeError(f'Local machine path needs review: {name}')
        records.append({'path': name, 'size': len(data), 'sha256': hashlib.sha256(data).hexdigest()})

    sample = json.loads(selected['source-materials/fde-agent/manifest.json'].read_text())
    indexed = {record['path']: record for record in records}
    for item in sample['files']:
        entry = indexed.get('source-materials/fde-agent/project/' + item['path'])
        if entry is None or entry['sha256'] != item['sha256'] or entry['size'] != item['bytes']:
            raise RuntimeError(f'Incomplete/changed sample file: {item["path"]}')
    lab_root = 'upstream/deepseek-harness/packages/fde/discovery-lab/'
    lab_manifest_name = lab_root + 'assets-manifest.json'
    if lab_manifest_name not in selected:
        raise RuntimeError('Missing laboratory material manifest')
    lab = json.loads(selected[lab_manifest_name].read_text())
    for item in lab['files']:
        entry = indexed.get(lab_root + 'assets/' + item['path'])
        if entry is None or entry['sha256'] != item['sha256'] or entry['size'] != item['bytes']:
            raise RuntimeError(f'Incomplete laboratory material: {item["path"]}')
    subprocess.run(['node', str(root / lab_root / 'scripts/verify-assets.mjs')], check=True)
    summary = {'sourceCommit': commit, 'fileCount': len(records), 'payloadBytes': sum(item['size'] for item in records), 'sampleFiles': len(sample['files']), 'labFiles': len(lab['files']), 'materializedLinks': materialized, 'excludedTrackedFiles': excluded}
    if args.dry_run:
        print(json.dumps({'status': 'DRY_RUN', **summary}, ensure_ascii=False, indent=2))
        return

    output = root / config['output_dir']
    output.mkdir(exist_ok=True)
    final = output / config['archive_name']
    if final.exists():
        raise RuntimeError('Archive already exists; do not overwrite a prior delivery')
    manifest = {'schema_version': 1, 'bundle': config['bundle_root'], 'public_name': config['public_name'], 'release_date': config['release_date'], 'sourceCommit': commit, 'file_count': len(records), 'files': records, 'materializedLinks': materialized}
    with tempfile.TemporaryDirectory(prefix='.student-candidate-', dir=output) as temporary:
        candidate = Path(temporary) / final.name
        with zipfile.ZipFile(candidate, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
            def write(name, data, mode=0o644):
                released = date.fromisoformat(config['release_date'])
                info = zipfile.ZipInfo(config['bundle_root'] + '/' + name, (released.year, released.month, released.day, 0, 0, 0))
                info.create_system = 3
                info.external_attr = (stat.S_IFREG | mode) << 16
                info.compress_type = zipfile.ZIP_DEFLATED
                archive.writestr(info, data, compresslevel=9)
            for entry in records:
                source = selected[entry['path']]
                data = payload(entry['path'], source)
                if hashlib.sha256(data).hexdigest() != entry['sha256']:
                    raise RuntimeError(f'Source changed while packaging: {entry["path"]}')
                write(entry['path'], data, stat.S_IMODE(source.stat().st_mode))
            write('MANIFEST.json', (json.dumps(manifest, ensure_ascii=False, indent=2) + '\n').encode())
            write('SHA256SUMS.txt', ('\n'.join(f'{item["sha256"]}  {item["path"]}' for item in records) + '\n').encode())
        with zipfile.ZipFile(candidate) as archive:
            if archive.testzip() is not None:
                raise RuntimeError('ZIP CRC verification failed')
            paths = set()
            for item in archive.infolist():
                path = safe_path(item.filename)
                if path.parts[0] != config['bundle_root'] or item.filename in paths or not stat.S_ISREG(item.external_attr >> 16):
                    raise RuntimeError('Invalid ZIP structure')
                paths.add(item.filename)
        os.replace(candidate, final)
    print(json.dumps({'status': 'BUILT', **summary, 'archive': str(final), 'archiveBytes': final.stat().st_size}, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
