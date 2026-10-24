#!/usr/bin/env python3
"""Build a minimal GitHub Pages site from a verified, genuine PANIC/Musashi build.

Never uploads source-only tests, developer probes, private files, or arbitrary
local PANs. A failure leaves no deployable output directory.
Copyright (c) 2026 Layer812. SPDX-License-Identifier: MIT.
Original PANIC, Musashi, and PAN data retain their separate terms.
"""
from __future__ import annotations
import argparse
import hashlib
from pathlib import Path
import shutil
import tempfile

PANIC_SHA256 = "f26527c3d19e71b41fb24efbfff03ae862c8e2430c0e3dc84e7ca67047b1f2fd"
MAX_PAN_BYTES = 24 * 1024 * 1024
PAGES_FILES = (
    "index.html", "LICENSE", "LICENSE_PANIC_X.txt",
    "PANIC_V1.38_NOTICE.txt", "THIRD_PARTY_NOTICES.md",
    "THIRD_PARTY_NOTICES.html",
)

def _sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()

def build(root: Path, destination: Path, original_docs: Path) -> list[str]:
    root = root.resolve(strict=True)
    destination = destination.absolute()
    if destination.exists():
        raise RuntimeError(f"Refusing to overwrite existing directory: {destination}")
    x = root / "core" / "PANIC.X"
    glue = root / "core" / "pwp_musashi.mjs"
    wasm = root / "core" / "pwp_musashi.wasm"
    for f in (x, glue, wasm):
        if not f.is_file() or f.stat().st_size == 0:
            raise RuntimeError(f"Missing real runtime artifact: {f}")
    if _sha(x.read_bytes()) != PANIC_SHA256:
        raise RuntimeError("PANIC.X is not the pinned original V1.38")
    if wasm.read_bytes()[:4] != b"\\x00asm":
        raise RuntimeError("Missing actual WebAssembly magic")
    for name in PAGES_FILES:
        if not (root / name).is_file():
            raise RuntimeError(f"Missing site file: {name}")
    if not (root / "src" / "main.js").is_file():
        raise RuntimeError("Missing source frontend")
    for f in ("panic.doc", "panic.his"):
        if not (original_docs / f).is_file():
            raise RuntimeError(f"Missing original PANIC documentation: {f}")
    with tempfile.TemporaryDirectory(prefix="pwp_pages_") as tmp:
        stage = Path(tmp) / "site"
        stage.mkdir()
        for name in PAGES_FILES:
            shutil.copy2(root / name, stage / name)
        shutil.copytree(root / "src", stage / "src", ignore=shutil.ignore_patterns("__pycache__"))
        (stage / "core").mkdir()
        for f in (x, glue, wasm):
            shutil.copy2(f, stage / "core" / f.name)
        (stage / "pan").mkdir()
        for pan in sorted((root / "pan").glob("*")):
            if not pan.is_file() or pan.suffix.lower() != ".pan":
                continue
            size = pan.stat().st_size
            if size < 16 or size > MAX_PAN_BYTES or not pan.read_bytes()[:6] == b"PANIC\\x1a":
                raise RuntimeError(f"Invalid publicly committed PAN sample: {pan.name}")
            shutil.copy2(pan, stage / "pan" / pan.name)
        (stage / "legal").mkdir()
        for f in ("panic.doc", "panic.his"):
            shutil.copy2(original_docs / f, stage / "legal" / f)
        musashi_softfloat = root / "_x68ktab" / "components" / "px68k" / "m68000" / "musashi" / "softfloat" / "README.txt"
        if not musashi_softfloat.is_file():
            raise RuntimeError("Original SoftFloat licensing material is missing")
        shutil.copy2(musashi_softfloat, stage / "legal" / "SoftFloat_README.txt")
        (stage / "legal" / "Musashi_LICENSE.txt").write_text(
            "Musashi Motorola 680x0 Emulator\\n"
            "Copyright Karl Stenerud. All rights reserved.\\n\\n"
            "Permission is hereby granted, free of charge, to any person obtaining a copy "
            "of this software and associated documentation files (the \\"Software\\"), to deal "
            "in the Software without restriction, including without limitation the rights "
            "to use, copy, modify, merge, publish, distribute, sublicense, and/or sell "
            "copies of the Software, and to permit persons to whom the Software is "
            "furnished to do so, subject to the following conditions:\\n\\n"
            "The above copyright notice and this permission notice shall be included "
            "in all copies or substantial portions of the Software.\\n\\n"
            'THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR '
            "IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, "
            "FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE "
            "AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER "
            "LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, "
            "OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.\\n",
            encoding="utf-8")
        (stage / ".nojekyll").write_text("", encoding="ascii")
        # Gate the copied runtime AGAIN; never publish partial or stale artifacts.
        if _sha((stage / "core" / "PANIC.X").read_bytes()) != PANIC_SHA256:
            raise RuntimeError("Staged PANIC.X hash mismatch")
        shutil.move(str(stage), destination)
    return sorted(str(p.relative_to(destination)) for p in destination.rglob("*") if p.is_file())

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--original-docs", type=Path, required=True)
    args = parser.parse_args()
    result = build(args.root, args.output, args.original_docs)
    print(f"PASS actual 68000 Pages bundle: {len(result)} files")
    for path in result:
        print(path)
