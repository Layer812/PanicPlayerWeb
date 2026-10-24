from pathlib import Path
import shutil, subprocess, tempfile
R=Path(__file__).resolve().parents[1]
def test_audio_iocs_native_mock():
    cc=shutil.which('gcc') or shutil.which('clang');assert cc
    with tempfile.TemporaryDirectory() as d:
        exe=Path(d)/'audio_iocs'
        cmd=[cc,'-O2','-std=c11','-Wall','-Wextra','-Werror',
             '-fsanitize=undefined','-fno-sanitize-recover=all',
             '-DPWP_TEST_STAGE','-I',str(R/'tests/mock'),'-I',str(R/'core'),
             str(R/'core/pwp_musashi.c'),str(R/'core/pwp_x68k_video_bus.c'),
             str(R/'core/pwp_x68k_frame.c'),str(R/'tests/mock/mock_m68k_super.c'),
             str(R/'tests/mock/test_fix29_adpcm_iocs.c'),'-o',str(exe)]
        subprocess.run(cmd,check=True,capture_output=True,text=True)
        subprocess.run([str(exe)],check=True,capture_output=True,text=True)
