"""R12 local-source acquisition safety; NOT a Musashi execution test."""
import importlib.util
import hashlib
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'tools'))
spec=importlib.util.spec_from_file_location('build_r12_actual',ROOT/'tools'/'BUILD_R12_ACTUAL.py')
mod=importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

class RealSourceCopySafety(unittest.TestCase):
    def test_manifest_requires_all_actual_musashi_sources(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder=Path(tmp)
            with self.assertRaises(FileNotFoundError):
                mod.manifest(folder)
    def test_source_snapshot_hashes_and_original_is_immutable(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp)
            src=root/'tab5'/'components'/'px68k'/'m68000'/'musashi'
            src.mkdir(parents=True)
            # Minimal placeholder files only test copying/selection, NOT CPU.
            for idx,name in enumerate(mod.TAB5_PARTS):
                f=src/name;f.parent.mkdir(parents=True,exist_ok=True)
                f.write_bytes(('fixture-%d-%s'%(idx,name)).encode())
            snapshot_before=mod.manifest(src)
            class Opt:
                tab5_musashi_source=None
                x68ktab_root=str(root/'tab5')
            self.assertEqual(mod.source_dir(Opt()),src.resolve())
            dest=root/'out'
            for name in mod.TAB5_PARTS:
                d=dest/name;d.parent.mkdir(parents=True,exist_ok=True)
                d.write_bytes((src/name).read_bytes())
            self.assertEqual(mod.manifest(dest),snapshot_before)
            self.assertEqual(mod.manifest(src),snapshot_before)
    def test_missing_real_cpu_tool_is_an_explicit_nonzero_stop(self):
        with tempfile.TemporaryDirectory() as temp:
            p=subprocess.run([sys.executable,str(ROOT/'tools/BUILD_R12_ACTUAL.py'),
                              '--x68ktab-root',temp],text=True,capture_output=True,
                              cwd=ROOT,timeout=30)
            self.assertNotEqual(p.returncode,0)
            self.assertIn('SAFE STOP R12:',p.stderr)
            self.assertNotIn('PASS R12:',p.stdout)
    def test_compiler_absence_prevents_staging_or_modifying_production(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp)
            source=root/'tab5'/'components'/'px68k'/'m68000'/'musashi'
            source.mkdir(parents=True)
            for name in mod.TAB5_PARTS:
                f=source/name;f.parent.mkdir(parents=True,exist_ok=True)
                f.write_text('source read only '+name)
            before=mod.manifest(source)
            env={**os.environ,'EMCC':'pwp_emcc_absent_for_test'}
            p=subprocess.run([sys.executable,str(ROOT/'tools/BUILD_R12_ACTUAL.py'),
                  '--x68ktab-root',str(root/'tab5')],cwd=ROOT,
                  capture_output=True,text=True,env=env,timeout=30)
            self.assertNotEqual(p.returncode,0)
            self.assertIn('Emscripten emcc is unavailable',p.stderr)
            self.assertEqual(before,mod.manifest(source))
            self.assertFalse((ROOT/'core'/'pwp_musashi.mjs').exists())
    def test_cpu_routines_never_bypass_original_binary_gate(self):
        source=(ROOT/'tools'/'BUILD_R12_ACTUAL.py').read_text()
        self.assertIn("'RUN_R9_CPU_SMOKE.mjs'",source)
        self.assertIn("'RUN_R9_PANIC_BOOT.mjs'",source)
        self.assertIn('sha256',source)
        self.assertIn('PWP_TAB5_MUSASHI=1',source)
        self.assertNotIn('mock_m68k.c',source)
    def test_tab5_irq_interface_compiles_in_native_abi_test(self):
        with tempfile.TemporaryDirectory() as temp:
            exe=Path(temp)/'r12_native'
            p=subprocess.run(['gcc','-std=c11','-Wall','-Wextra','-Werror',
                '-DPWP_TEST_STAGE','-DPWP_TAB5_MUSASHI',
                '-I'+str(ROOT/'tests/mock'),'-I'+str(ROOT/'core'),
                str(ROOT/'tests/mock/mock_m68k.c'),
                str(ROOT/'tests/mock/test_r11_cli.c'),
                str(ROOT/'core/pwp_musashi.c'),
                str(ROOT/'core/pwp_x68k_video_bus.c'),
                str(ROOT/'core/pwp_x68k_frame.c'),'-o',str(exe)],
                text=True,capture_output=True,timeout=30)
            self.assertEqual(p.returncode,0,p.stdout+p.stderr)
            res=subprocess.run([str(exe)],text=True,capture_output=True,timeout=30)
            self.assertEqual(res.returncode,0,res.stdout+res.stderr)
            self.assertIn('mock CPU',res.stdout)

if __name__=='__main__':unittest.main()
