"""Regression: uninstalled Z-MUSIC TRAP #3 vector must not crash zm_chk."""
import subprocess
import tempfile
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]


def test_zmusic_absent_vector_native():
    with tempfile.TemporaryDirectory(prefix="pwp_zm_unresident_") as folder:
        exe=Path(folder)/"zm_absent"
        cmd=["gcc","-O2","-std=c11","-Wall","-Wextra","-Werror",
             "-I",str(ROOT/"tests"/"mock"),"-I",str(ROOT/"core"),
             "-DPWP_TEST_STAGE",
             str(ROOT/"core"/"pwp_musashi.c"),
             str(ROOT/"core"/"pwp_x68k_video_bus.c"),
             str(ROOT/"core"/"pwp_x68k_frame.c"),
             str(ROOT/"tests"/"mock"/"mock_m68k_super.c"),
             str(ROOT/"tests"/"mock"/"test_zm2_absent_vector.c"),
             "-o",str(exe)]
        subprocess.run(cmd,check=True,capture_output=True,text=True)
        completed=subprocess.run([str(exe)],check=True,capture_output=True,text=True)
        assert "PASS absent Z-MUSIC v2 probe" in completed.stdout
