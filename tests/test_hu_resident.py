"""Real Human68k HU relocation staging, not a fake resident driver."""
import shutil
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_hu_resident_native():
    compiler = shutil.which("gcc") or shutil.which("clang")
    if compiler is None:
        raise AssertionError("A native C compiler is required for real HU staging tests")
    with tempfile.TemporaryDirectory(prefix="pwp_hu_") as directory:
        binary = Path(directory) / "hu_test"
        subprocess.run([
            compiler, "-std=c11", "-Wall", "-Wextra", "-Werror", "-pedantic",
            "-I", str(ROOT / "core"),
            str(ROOT / "tests/mock/test_hu_resident.c"),
            str(ROOT / "core/pwp_hu_resident.c"), "-o", str(binary),
        ], check=True)
        result = subprocess.run([str(binary)], check=True, capture_output=True, text=True)
        assert "PASS bounded real HU relocations" in result.stdout
