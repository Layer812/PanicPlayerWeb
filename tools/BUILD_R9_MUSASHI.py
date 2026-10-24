#!/usr/bin/env python3
"""Build actual pinned upstream Musashi for the standalone PANIC Web R9 adapter.
No WebX68k. Does not touch any Tab5 or upstream source directory. Build is
safe-stop if original source commit/toolchain unavailable. No fake CPU fallback.
"""
import argparse
import os
import shutil
import subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
WORK=ROOT/'vendor'/'musashi-r9-work'
PIN='313ebf1bd9f4d0d93341eb5ce21fd8a119e9dbdd'
UPSTREAM='https://github.com/kstenerud/Musashi.git'
EXPORTS=[
 'pwp_mu_stage_ptr','pwp_mu_stage_capacity','pwp_mu_reset','pwp_mu_load',
 'pwp_mu_vdisp_ticks','pwp_mu_scanout_ticks','pwp_mu_vdisp_acks','pwp_mu_vdisp_pending','pwp_mu_vdisp_latched','pwp_mu_guest_cycles',
 'pwp_mu_gpip_reads','pwp_mu_gpip_level',
 'pwp_mu_run','pwp_mu_dispatch','pwp_mu_register','pwp_mu_pc',
 'pwp_mu_queue_space','pwp_mu_pending_space','pwp_mu_consumed_space','pwp_mu_rejected_space',
 'pwp_mu_steps','pwp_mu_status','pwp_mu_trap','pwp_mu_trap_pc',
 'pwp_mu_fault_address','pwp_mu_image_end','pwp_mu_bss_end',
 'pwp_mu_guest_peek32','pwp_mu_guest_peek8','pwp_mu_set_pan_size','pwp_mu_io_stage_ptr',
 'pwp_mu_io_capacity','pwp_mu_io_offset_high','pwp_mu_io_offset_low',
 'pwp_mu_io_length','pwp_mu_supply_read','pwp_mu_console_length',
 'pwp_mu_console_byte','pwp_mu_console_truncated','pwp_mu_exit_code',
 'pwp_mu_pan_read_calls','pwp_mu_pan_open_calls','pwp_mu_pan_bytes_low','pwp_mu_pan_bytes_high','pwp_mu_pan_open',
 'pwp_mu_last_dos_op','pwp_mu_last_dos_pc','pwp_mu_last_dos_return',
 'pwp_mu_pan_error_op','pwp_mu_pan_error_code','pwp_mu_pan_error_count',
 'pwp_mu_video_text_index','pwp_mu_video_palette_word','pwp_mu_video_write_count','pwp_mu_video_pixel_writes','pwp_mu_video_graphic_word','pwp_mu_video_crtc_reg','pwp_mu_video_crtc_changes','pwp_mu_video_vctrl_r2','pwp_mu_video_vctrl_r1',
 'pwp_mu_mfp_ierb_reads','pwp_mu_mfp_imrb_reads','pwp_mu_mfp_last_read_address',
 'pwp_mu_iocs_tgusemd_calls','pwp_mu_iocs_graphics_use','pwp_mu_iocs_text_use','pwp_mu_iocs_last_d1','pwp_mu_iocs_last_d2',
 'pwp_mu_iocs_ms_init_calls','pwp_mu_mouse_initialized','pwp_mu_mouse_cursor_visible',
 'pwp_mu_iocs_gclr_calls','pwp_mu_iocs_sp_init_calls','pwp_mu_iocs_sp_on_calls','pwp_mu_sprite_initialized','pwp_mu_sprite_display_enabled','pwp_mu_sprite_init_count','pwp_mu_sprite_enable_count','pwp_mu_cynthia_active_sprites','pwp_mu_cynthia_disp_gate','pwp_mu_cynthia_raw_sprite_count','pwp_mu_cynthia_attr_writes','pwp_mu_cynthia_pcg_writes','pwp_mu_cynthia_palette_writes','pwp_mu_graphics_display_enabled','pwp_mu_graphics_clear_count','pwp_mu_graphics_access_page','pwp_mu_iocs_crtmod_calls','pwp_mu_iocs_crt_mode',
 'pwp_mu_sound_pop','pwp_mu_sound_bytes','pwp_mu_sound_overflows',
 'pwp_mu_dma3_bytes_sent','pwp_mu_dma3_completions','pwp_mu_dma3_register',
 'pwp_mu_audio_serial','pwp_mu_audio_kind','pwp_mu_audio_chain_addr','pwp_mu_audio_chain_count','pwp_mu_audio_mode','pwp_mu_audio_ram_ptr','pwp_mu_audio_control_calls','pwp_mu_audio_chain_calls',
 'pwp_mu_conctrl_calls','pwp_mu_conctrl_screen_mode','pwp_mu_conctrl_fnkeys_mode','pwp_mu_conctrl_cursor_visible',
 'pwp_frame_render','pwp_frame_render_mode10','pwp_frame_pointer','pwp_frame_size','pwp_frame_grb8888','pwp_frame_set_palette0_evidence','pwp_frame_gfx_nonzero','pwp_frame_text_nonzero','pwp_frame_gfx_text_overlap','pwp_frame_gfx_palette_zero','pwp_frame_gfx_visible_pixels','pwp_frame_text_visible_pixels']
def exe(s):
    p=shutil.which(s)
    if not p: raise RuntimeError(f'Required tool missing: {s}')
    return p
def run(cmd,**kw):
    print('+',' '.join(map(str,cmd)),flush=True)
    subprocess.run([str(x) for x in cmd],check=True,**kw)
def rev(git,path):
    return subprocess.check_output([git,'-C',str(path),'rev-parse','HEAD'],text=True).strip()
def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--source',type=Path,help='Existing read-only upstream Musashi Git checkout at exact pinned HEAD')
    parser.add_argument('--offline',action='store_true',help='Fail if neither --source nor existing pinned work checkout is available')
    parser.add_argument('--panic-x',type=Path,help='Optional actual original PANIC.X: run original PANIC.X real startup to first FF4A')
    opts=parser.parse_args()
    git=exe('git')
    if opts.source:
        src=opts.source.expanduser().resolve()
        if not (src/'.git').exists():raise RuntimeError(f'Not a Git checkout: {src}')
        if rev(git,src)!=PIN:raise RuntimeError('User source is not at the required Musashi upstream commit. Refusing unverified fork.')
        if WORK.exists():
            if rev(git,WORK)!=PIN:raise RuntimeError('Existing work copy commit mismatch; refusing overwrite.')
        else:
            WORK.parent.mkdir(parents=True,exist_ok=True)
            run([git,'clone','--local','--no-hardlinks','--no-checkout',src,WORK])
            run([git,'-C',WORK,'checkout','--detach',PIN])
    elif not WORK.exists():
        if opts.offline:raise RuntimeError('Offline and no already-verified Musashi checkout. STOP.')
        WORK.parent.mkdir(parents=True,exist_ok=True)
        run([git,'clone','--no-checkout',UPSTREAM,WORK])
        run([git,'-C',WORK,'checkout','--detach',PIN])
    if rev(git,WORK)!=PIN:raise RuntimeError('Pinned Musashi revision mismatch')
    for name in ['m68kcpu.c','m68kmake.c','m68k_in.c','m68k.h','softfloat/softfloat.c']:
        if not (WORK/name).is_file():raise RuntimeError('Missing upstream: '+name)
    emcc=exe(os.environ.get('EMCC','emcc'))
    cc=exe(os.environ.get('PWP_HOST_CC','gcc'))
    generator=WORK/('pwp_m68kmake.exe' if os.name=='nt' else 'pwp_m68kmake')
    run([cc,'-O2',WORK/'m68kmake.c','-o',generator])
    run([generator],cwd=WORK)
    for name in ('m68kops.c','m68kops.h'):
        if not (WORK/name).is_file() or not (WORK/name).stat().st_size:raise RuntimeError('Missing generated '+name)
    # Compile and validate in a staging directory before publishing any module.
    stage=ROOT/'vendor'/'r9-build-stage'
    stage.mkdir(parents=True,exist_ok=True)
    out=stage/'pwp_musashi.mjs'
    cmd=[emcc,'-O2','-std=gnu11','-I',WORK,
         '-DM68K_EMULATE_010=0','-DM68K_EMULATE_EC020=0',
         '-DM68K_EMULATE_020=0','-DM68K_EMULATE_030=0','-DM68K_EMULATE_040=0',
         '-sMODULARIZE=1','-sEXPORT_ES6=1','-sENVIRONMENT=web,worker,node',
         '-sALLOW_MEMORY_GROWTH=1','-sINITIAL_MEMORY=33554432','-sMAXIMUM_MEMORY=67108864',
         '-sFILESYSTEM=0',
         '-sEXPORTED_FUNCTIONS='+str(['_'+x for x in EXPORTS]).replace(' ','').replace('"',"'"),
         '-sEXPORTED_RUNTIME_METHODS=["HEAPU8"]','--no-entry',
         ROOT/'core/pwp_musashi.c', ROOT/'core/pwp_x68k_video_bus.c', ROOT/'core/pwp_x68k_frame.c',
         WORK/'m68kcpu.c',WORK/'m68kops.c',WORK/'softfloat/softfloat.c',
         '-lm','-o',out]
    run(cmd)
    if not out.is_file() or not out.with_suffix('.wasm').is_file():
        raise RuntimeError('Build artifacts absent')
    if out.with_suffix('.wasm').read_bytes()[:4]!=b'\x00asm':
        raise RuntimeError('Invalid WASM magic')
    # This is an actual instruction test on the generated Musashi, not a mock.
    # A compiler PASS alone must never be reported as CPU execution PASS.
    node=exe(os.environ.get('PWP_NODE','node'))
    run([node,ROOT/'tools/RUN_R9_CPU_SMOKE.mjs',out])
    panic_file=opts.panic_x or ROOT/'core'/'PANIC.X'
    if opts.panic_x and not panic_file.is_file():
        raise RuntimeError('Specified original PANIC.X missing')
    if panic_file.is_file():
        run([node,ROOT/'tools/RUN_R9_PANIC_BOOT.mjs',out,panic_file])
    else:
        print('NO PANIC.X startup claim: original binary absent; Musashi synthetic HU smoke still mandatory.')
    import os as _os
    for name in ('pwp_musashi.wasm','pwp_musashi.mjs'):
        _os.replace(stage/name,ROOT/'core'/name)
    print('PASS R9: real Musashi WASM compiled AND CPU smoke executed.')
    print('PAN playback/video/audio guest execution remains separately UNVERIFIED.')
if __name__=='__main__':main()
