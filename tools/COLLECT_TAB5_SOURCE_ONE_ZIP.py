#!/usr/bin/env python3
r"""Read-only, opt-in source handoff for a PRIVATE PanicPlayerTab5 workspace.

Usage (Windows): py -3 tools\COLLECT_TAB5_SOURCE_ONE_ZIP.py "G:\path\to\PanicPlayerTab5"

Writes ONE archive beside this script's project directory by default; if a G:
volume is mounted, writes G:\PANICPLAYERWEB_SOURCE_SEND_THIS.zip.
Does NOT change, build, flash, delete, upload or execute source tree files.
"""
from __future__ import annotations
import hashlib
import json
import os
from pathlib import Path
import sys
import zipfile

EXCLUDE_DIRS = {'.git', '.svn', 'build', 'builds', '__pycache__', 'node_modules',
                'managed_components', '.cache', 'dist', 'release', 'out', 'tmp',
                'esp-idf', 'toolchain', 'tools_cache', 'sdk', 'idf_tools'}
SOURCE_EXTENSIONS = {'.c', '.cc', '.cpp', '.h', '.hh', '.hpp', '.s', '.asm', '.inc',
                     '.inl', '.cmake', '.py', '.sh', '.cmd', '.bat', '.ld', '.a',
                     '.map', '.mk', '.md', '.txt', '.json', '.yml', '.yaml', '.ini',
                     '.cfg', '.conf', '.csv', '.patch', '.diff'}
SOURCE_NAMES = {'cmakelists.txt', 'makefile', 'kconfig', 'kconfig.projbuild',
                'sdkconfig.defaults', 'sdkconfig.defaults.esp32p4', 'license',
                'copying', 'readme'}
MAX_FILE = 6 * 1024 * 1024
MAX_TOTAL = 256 * 1024 * 1024


def collect(src: Path, dest: Path) -> tuple[int, int]:
    src = src.resolve()
    dest = dest.resolve()
    if not src.is_dir():
        raise ValueError(f'Source directory not found: {src}')
    if dest == src or src in dest.parents:
        raise ValueError('Archive destination must be outside the source tree')
    staged = []
    total = 0
    for root, dirs, files in os.walk(src):
        dirs[:] = sorted(d for d in dirs if d.lower() not in EXCLUDE_DIRS
                         and not d.startswith('.'))
        for name in sorted(files):
            p = Path(root) / name
            lower = name.lower()
            if p.is_symlink() or lower.endswith(('.key', '.pem', '.p12', '.pfx', '.env', '.pan',
                                                 '.xdf', '.dim', '.hds', '.hdf', '.iso', '.zip', '.rar', '.7z')):
                continue
            if p.suffix.lower() not in SOURCE_EXTENSIONS and lower not in SOURCE_NAMES:
                continue
            size = p.stat().st_size
            if size > MAX_FILE:
                continue
            total += size
            if total > MAX_TOTAL:
                raise ValueError('Source tree exceeds bounded collection size; archive NOT written')
            staged.append((p, p.relative_to(src).as_posix(), size))
    if not staged:
        raise ValueError('No matching source files. Check that the argument is the source root')
    dest.parent.mkdir(parents=True, exist_ok=True)
    manifest = {'format':'PANICPLAYERWEB_SOURCE_HANDOFF_v1',
                'source_root_name':src.name,
                'read_only':True, 'items':[]}
    tmp = dest.with_suffix('.zip.tmp')
    try:
        with zipfile.ZipFile(tmp, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=6) as z:
            for p, rel, size in staged:
                payload = p.read_bytes()
                # Confirm source has not changed while collecting.
                if len(payload) != size:
                    raise RuntimeError(f'Changed during read: {rel}')
                digest = hashlib.sha256(payload).hexdigest()
                z.writestr('source/' + rel, payload)
                manifest['items'].append({'path':'source/'+rel,'bytes':size,'sha256':digest})
            z.writestr('SOURCE_MANIFEST.json', json.dumps(manifest,ensure_ascii=False,indent=2))
        tmp.replace(dest)
    finally:
        if tmp.exists():tmp.unlink()
    return len(staged), total


def main() -> int:
    if len(sys.argv) != 2:
        print('Usage: py -3 tools\\COLLECT_TAB5_SOURCE_ONE_ZIP.py "G:\\path\\to\\PanicPlayerTab5"')
        return 2
    gdrive = Path('G:/')
    dest = (gdrive if gdrive.is_dir() else Path(__file__).resolve().parents[1]) / 'PANICPLAYERWEB_SOURCE_SEND_THIS.zip'
    try:
        count, size = collect(Path(sys.argv[1]), dest)
    except (ValueError, OSError, RuntimeError) as e:
        print(f'SAFE STOP: {e}')
        return 2
    print('PASS: read-only source archive generated (no build, no flash, no upload).')
    print(f'Files: {count}; total input bytes: {size}')
    print(f'One archive: {dest}')
    return 0

if __name__ == '__main__':
    raise SystemExit(main())
