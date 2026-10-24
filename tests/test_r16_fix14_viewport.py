from pathlib import Path
import unittest
R=Path(__file__).resolve().parents[1]
class Mode10Viewport(unittest.TestCase):
    def test_browser_uses_real_256_viewport(self):
        s=(R/'src/panic-core.mjs').read_text(encoding='utf-8')
        self.assertIn('m._pwp_frame_render_mode10(256, 256, 1)',s)
        self.assertIn('host.videoFrame(256, 256, rgba)',s)
        self.assertIn('m._pwp_mu_iocs_crt_mode()',s)
        self.assertNotIn('host.videoFrame(512, 512, rgba)',s)
    def test_report_validates_viewport_separately_from_full_raster(self):
        s=(R/'tools/RUN_R16_ONEPASS.py').read_text(encoding='utf-8')
        d=(R/'tools/RUN_R16_PANIC_DEEP.mjs').read_text(encoding='utf-8')
        self.assertIn('PWP_R16_FIX17R3_SEND_THIS.zip',s)
        self.assertIn('real_pan_viewport_captures',s)
        self.assertIn("capture.get('crtMode')!=10",s)
        self.assertIn('PWP_VIEWPORT_${due.label}.png',d)
        self.assertIn('m._pwp_frame_render(512,512,0,0)',d)
        self.assertIn('m._pwp_frame_render_mode10(256,256,1)',d)
        self.assertIn('guestReadBytesMismatch===0',d)
        self.assertIn('mode10GraphicsSlots',d)
    def test_single_runner_and_source_protected(self):
        c=(R/'RUN_THIS_R16_FIX17R3_ONEPASS.cmd').read_text(encoding='utf-8')
        self.assertIn('G:\\PWP_R16_FIX17R3_SEND_THIS.zip',c)
        self.assertIn('G:/X68KTab5',c)
        self.assertIn('RUN_R16_ONEPASS.py',c)
        self.assertIn('NO FLASH',c)
