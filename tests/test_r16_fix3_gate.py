"""R16 FIX3: regression for genuine 68000 allocation result accepted by native gate."""
from pathlib import Path
import sys, unittest, json
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'tools'))
from BUILD_R13_HOST_CPU import validate_real_native_proof, PIN_X

GOOD={"result":"REAL_NATIVE_MUSASHI_SYNTHETIC_AND_PANIC_MALLOC_PASS",
      "panic_sha256":PIN_X,
      "panic":{"first_dos":"FF4A","trap_pc":"0x10012","setblock_d0":0,
                "instructions_executed":6,"program_end":0x15366,
                "malloc_d0":86912,"startup_workspace_bytes":0x40000}}

class Fix3NativeGate(unittest.TestCase):
    def test_windows_fix2_real_musashi_success_accepted(self):
        # These are the fields received in PWP_R16_FIX2_SEND_THIS.zip native.log.
        validate_real_native_proof(json.loads(json.dumps(GOOD)))
    def test_obsolete_weaker_first_dos_marker_rejected(self):
        v=json.loads(json.dumps(GOOD))
        v['result']='REAL_NATIVE_MUSASHI_SYNTHETIC_AND_PANIC_FIRST_DOS_PASS'
        with self.assertRaisesRegex(RuntimeError,'256KiB allocation'):
            validate_real_native_proof(v)
    def test_invalid_or_missing_malloc_rejected(self):
        for key, value in [('malloc_d0',-8),('malloc_d0',0x3f0000),
                           ('program_end',0x3f0000),('setblock_d0',-8),
                           ('startup_workspace_bytes',0),('instructions_executed',0),
                           ('first_dos','FF00')]:
            with self.subTest(field=key,invalid=value):
                v=json.loads(json.dumps(GOOD))
                v['panic'][key]=value
                with self.assertRaises(RuntimeError): validate_real_native_proof(v)
    def test_non_genuine_binary_rejected(self):
        v=json.loads(json.dumps(GOOD));v['panic_sha256']='0'*64
        with self.assertRaises(RuntimeError):validate_real_native_proof(v)
    def test_missing_evidence_rejected(self):
        for v in (None,{}, {'result':GOOD['result'],'panic_sha256':PIN_X}):
            with self.assertRaises(RuntimeError):validate_real_native_proof(v)
    def test_runner_uses_new_report_name_and_one_newgate(self):
        r=(ROOT/'tools/RUN_R16_ONEPASS.py').read_text()
        g=(ROOT/'tools/BUILD_R13_HOST_CPU.py').read_text()
        c=(ROOT/'RUN_THIS_R16_FIX17R3_ONEPASS.cmd').read_text()
        self.assertIn('PWP_R16_FIX17R3_SEND_THIS.zip',r)
        self.assertIn('PWP_R16_FIX17R3_SEND_THIS.zip',c)
        self.assertIn('validate_real_native_proof(result)',g)
        self.assertNotIn("result.get('result')!='REAL_NATIVE_MUSASHI_SYNTHETIC_AND_PANIC_FIRST_DOS_PASS'",g)

if __name__=='__main__':unittest.main()
