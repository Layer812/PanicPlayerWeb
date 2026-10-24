import test from 'node:test';
import assert from 'node:assert/strict';
import {createMusashiBridge} from '../src/panic-core.mjs';
// A deliberately fake ABI verifies that production-facing code REJECTS an
// absent command tail. No claim of actual Musashi CPU execution.
function hu() {
 const b=new Uint8Array(15412);b[0]=0x48;b[1]=0x55;
 const dv=new DataView(b.buffer);dv.setUint32(12,0x39a2);dv.setUint32(16,0x252);dv.setUint32(20,0x1772);
 b.set([0x4d,0xfa,0x3b,0xf2,0x4f,0xfa,0x53,0x60,0x41,0xe8,0x00,0x10,0x93,0xc8,0x2f,0x09,0x2f,0x08,0xff,0x4a],64);
 return b;
}
function moduleFixture(){
 const fn=()=>1;
 return {HEAPU8:new Uint8Array(1600000),
  _pwp_mu_stage_ptr:()=>1000,_pwp_mu_stage_capacity:()=>15412,
  _pwp_mu_load:fn,_pwp_mu_set_pan_size:fn,_pwp_mu_run:fn,_pwp_mu_status:fn,
  _pwp_mu_register:()=>0, _pwp_mu_guest_peek8:()=>0,
  _pwp_mu_dispatch:fn,_pwp_mu_trap:fn,_pwp_mu_trap_pc:fn,
  _pwp_mu_io_stage_ptr:fn,_pwp_mu_io_capacity:fn,_pwp_mu_io_offset_high:fn,
  _pwp_mu_io_offset_low:fn,_pwp_mu_io_length:fn,_pwp_mu_supply_read:fn,
  _pwp_mu_iocs_crt_mode:()=>10,_pwp_mu_video_vctrl_r2:()=>0x41,_pwp_mu_video_vctrl_r1:()=>0xe4,_pwp_mu_video_write_count:fn,_pwp_mu_video_pixel_writes:fn,_pwp_mu_video_crtc_changes:()=>0,_pwp_frame_render:fn,_pwp_frame_render_mode10:fn,_pwp_frame_pointer:fn,_pwp_frame_size:fn};
}
test('R11: missing guest commandline causes fail-closed load',async()=>{
 const m=moduleFixture();
 const e=createMusashiBridge(m,{},hu());
 await assert.rejects(e.load({id:1,size:123}),/A2 \/ LASCII/);
});
test('R11: A2 correct but malformed virtual PAN path cannot start guest',async()=>{
 const m=moduleFixture();m._pwp_mu_register=()=>0x8000;
 m._pwp_mu_guest_peek8=(a)=>a===0x8000?11:0;
 const e=createMusashiBridge(m,{},hu());
 await assert.rejects(e.load({id:1,size:123}),/コマンドラインの不一致/);
});
test('R11: missing guest inspect API cannot be accepted as ready',()=>{
 const m=moduleFixture();delete m._pwp_mu_guest_peek8;
 assert.throws(()=>createMusashiBridge(m,{},hu()),/missing _pwp_mu_guest_peek8/);
});
