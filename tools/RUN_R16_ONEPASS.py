#!/usr/bin/env python3
"""One native->WASM->original PANIC.X runtime acceptance; one report ZIP.
Never installs SDKs, modifies production, creates firmware or flashes Tab5.
"""
from pathlib import Path
import argparse, hashlib, json, os, sys, tempfile, zipfile, time, subprocess
from R16_SDK_ENV import resolve_compiler, run_gate, write_zip_atomic

R=Path(__file__).resolve().parents[1]
SOURCE_PATHS=('components/px68k/m68000/musashi/m68kcpu.c',
              'components/px68k/m68000/musashi/m68kops.c',
              'components/px68k/m68000/musashi/m68k.h','src/panic_x_bin.c')
def sha(p):
    h=hashlib.sha256()
    with open(p,'rb') as f:
        for b in iter(lambda:f.read(1024*1024),b''):h.update(b)
    return h.hexdigest()
def hashes(root):return {f: sha(root/f) if (root/f).is_file() else None for f in SOURCE_PATHS}

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--source',default='G:/X68KTab5')
    ap.add_argument('--report-dir',default='G:/')
    ap.add_argument('--pan',help='Optional real user PAN file, read-only; never bundled into report')
    o=ap.parse_args()
    source=Path(o.source);reportdir=Path(o.report_dir)
    if not reportdir.is_dir():raise SystemExit('SAFE STOP report destination absent: '+str(reportdir))
    outfile=reportdir/'PWP_R16_FIX17R3_SEND_THIS.zip'
    if o.pan and (not Path(o.pan).is_file() or Path(o.pan).suffix.lower()!='.pan'):
        raise SystemExit('SAFE STOP: specified PAN file not found or extension is not .PAN')
    before=hashes(source)
    result={'version':'PanicPlayerWeb R16 FIX17R3','native_rc':None,'wasm_rc':None,
            'production_original_unchanged':None,'actual_pan_frame_verified':False,
            'source_sha256_before':before,'status':'SAFE_STOP','no_flash':True,
            'no_sdk_install':True}
    with tempfile.TemporaryDirectory(prefix='pwp_r16_') as t:
        tmp=Path(t)
        try:
            if not all(before.values()):raise RuntimeError('Missing original read-only X68KTab5 source')
            sdklog=['R16 reuses already-installed FIX8 SDK; no downloads.']
            env, emcc=resolve_compiler(R,sdklog)
            (tmp/'sdk.log').write_text('\n'.join(sdklog)+'\n',encoding='utf-8')
            native=run_gate([sys.executable,R/'tools/BUILD_R13_HOST_CPU.py',
                             '--x68ktab-root',source],R,tmp/'native.log','NATIVE')
            result['native_rc']=native
            if native!=0:raise RuntimeError('Real native 68000 gate failed')
            if not emcc:raise RuntimeError('No preinstalled working Emscripten detected')
            wasm=run_gate([sys.executable,R/'tools/BUILD_R12_ACTUAL.py',
                           '--x68ktab-root',source],R,tmp/'wasm.log','WASM',env=env)
            result['wasm_rc']=wasm
            if wasm:raise RuntimeError('Real WASM 68000 gate failed')
            manifest=R/'R12_REAL_CPU_MANIFEST.json';binary=R/'core/pwp_musashi.wasm'
            if not (manifest.is_file() and binary.is_file()):raise RuntimeError('Verified native/WASM manifests missing')
            info=json.loads(manifest.read_text(encoding='utf-8'))
            if (info.get('status')!='REAL_MUSASHI_PANIC_BOOT_PASS'
                or info.get('super_gate')!='REAL_MUSASHI_WASM_SUPER_ROUNDTRIP_PASS'
                or info.get('mfp_gate')!='REAL_MUSASHI_WASM_PANIC_MFP_READ_PASS'
                or info.get('iocs_gate')!='REAL_MUSASHI_WASM_PANIC_TGUSEMD_PASS'
                or info.get('mouse_gate')!='REAL_MUSASHI_WASM_PANIC_MS_INIT_PASS'
                or info.get('nameck_gate')!='REAL_MUSASHI_WASM_PANIC_NAMECK_PASS'
                or info.get('conctrl_gate')!='REAL_MUSASHI_WASM_CONCTRL_SEMANTICS_PASS'
                or info.get('crtmod_gate')!='REAL_MUSASHI_WASM_CRTMOD10_SEMANTICS_PASS'
                or info.get('gclr_gate')!='REAL_MUSASHI_WASM_GCLR_ON10_SEMANTICS_PASS'
                or info.get('sprite_gate')!='REAL_MUSASHI_WASM_SPRITE_INIT_ON10_SEMANTICS_PASS'
                or info.get('wasm_sha256')!=sha(binary) or binary.read_bytes()[:4]!=b'\0asm'):
                raise RuntimeError('R16 WASM manifest SHA/source mismatch')
            result['status']='PASS_REAL_MUSASHI_WASM_PANIC_NAMECK_NOT_ANIMATION'
            result['wasm_sha256']=sha(binary)
            result['real_cpu_super_gate_verified']=True
            result['real_cpu_mfp_gate_verified']=True
            result['real_cpu_iocs_gate_verified']=True
            result['real_cpu_mouse_init_gate_verified']=True
            result['real_cpu_nameck_gate_verified']=True
            result['real_cpu_conctrl_synthetic_gate_verified']=True
            result['real_cpu_crtmod_synthetic_gate_verified']=True
            result['real_cpu_gclr_synthetic_gate_verified']=True
            result['real_cpu_sprite_synthetic_gate_verified']=True
            # The original no-PAN trace exercises PANIC.X's failure/exit path.
            # A real PAN trace is separate. It MUST be supplied explicitly.
            if o.pan:
                pan=Path(o.pan).resolve()
                if not pan.is_file() or pan.suffix.lower()!='.pan':
                    raise RuntimeError('Specified user PAN file missing or not .PAN')
                result['real_pan_sha256']=sha(pan)
                result['real_pan_bytes']=pan.stat().st_size
                node=__import__('shutil').which('node')
                if not node:raise RuntimeError('Node.js not found for real PAN trace')
                pan_trace=R/'R16_PANIC_REALPAN_TRACE.json'
                frames_dir=tmp  # Captures become top-level members of the sole report ZIP
                rc=run_gate([node,R/'tools/RUN_R16_PANIC_DEEP.mjs',
                    R/'core/pwp_musashi.mjs',R/'core/PANIC.X',
                    '--pan',pan,'--out',pan_trace,'--frames',frames_dir],R,tmp/'realpan.log','REALPAN',timeout_seconds=600)
                result['real_pan_trace_rc']=rc
                if not rc and pan_trace.is_file():
                    evidence=json.loads(pan_trace.read_text(encoding='utf-8'))
                    # PNG screenshots are evidence of rendered pixels, not PAN frames.
                    result['real_pan_render_probes_not_animation_frames']=True
                    result['real_pan_raw_diagnostic_captures']=evidence.get('rawDiagnosticCaptures',[])
                    result['real_pan_frame_captures']=evidence.get('frameCaptures',[])
                    result['real_pan_distinct_capture_count']=evidence.get('distinctFrameCaptureCount',0)
                    result['real_pan_viewport_captures']=evidence.get('viewportCaptures',[])
                    result['real_pan_viewport_capture_count']=evidence.get('visibleViewportCaptureCount',0)
                    result['real_pan_viewport_distinct_count']=evidence.get('distinctViewportCaptureCount',0)
                    result['real_pan_viewport_stable_100k_300k']=evidence.get('viewportUnchangedAt100KAnd300K')
                    result['real_pan_video_register_transitions']=evidence.get('videoRegisterTransitions',[])
                    result['real_pan_last_video_registers']=evidence.get('lastVideoRegisters')
                    result['real_pan_g0_scroll_changed']=evidence.get('g0ScrollChanged')
                    result['real_pan_g1_scroll_changed']=evidence.get('g1ScrollChanged')
                    result['real_pan_g0_only_observed']=evidence.get('g0OnlyObserved')
                    result['real_pan_g1_only_observed']=evidence.get('g1OnlyObserved')
                    result['real_pan_graphics_page_transitions_recorded']=evidence.get('graphicsPageTransitionsInRecordedEvents')
                    result['real_pan_page_transition_count_lower_bound']=evidence.get('graphicsPageTransitionCountIsLowerBound')
                    result['real_pan_next_viewport_change']=evidence.get('viewportNewImageAfter300K')
                    if result['real_pan_next_viewport_change']:
                        capture=result['real_pan_next_viewport_change']
                        if capture.get('name')!='PWP_VIEWPORT_NEXT_CHANGE.png':
                            raise RuntimeError('Invalid new viewport evidence name')
                        file=frames_dir/capture['name']
                        if (not file.is_file() or not file.read_bytes().startswith(b'\x89PNG\r\n\x1a\n')
                            or sha(file)!=capture.get('pngSHA256')):
                            raise RuntimeError('New viewport change PNG integrity failure')
                    result['real_pan_viewport_mode']=evidence.get('viewportMode')
                    result['real_pan_unrendered_dual_page_samples']=evidence.get('unrenderedDualPageSamples',0)
                    result['real_pan_unrendered_no_page_samples']=evidence.get('unrenderedNoPageSamples',0)
                    result['real_pan_dual_graphics_slot_samples']=evidence.get('dualGraphicsSlotSamples',0)
                    result['real_pan_no_graphics_slot_samples']=evidence.get('noGraphicsSlotSamples',0)
                    if evidence.get('visibleAfterRealPanRead') and not result['real_pan_viewport_captures']:
                        raise RuntimeError('Actual PAN visible but mode10 viewport PNG evidence missing')
                    if len(result['real_pan_viewport_captures']) != len(result['real_pan_frame_captures']):
                        raise RuntimeError('Viewport and per-milestone G0 diagnostic mismatch')
                    for item in result['real_pan_raw_diagnostic_captures']:
                        name=item.get('name','')
                        if name not in ('PWP_RAW_G0_FIRST.png','PWP_RAW_G0_AFTER_100K.png','PWP_RAW_G0_AFTER_300K.png'):
                            raise RuntimeError('Unexpected independent raw G0 evidence name')
                        file=frames_dir/name
                        if not file.is_file() or not file.read_bytes().startswith(b'\x89PNG\r\n\x1a\n') or sha(file)!=item.get('pngSHA256'):
                            raise RuntimeError('Raw G0 evidence SHA mismatch')
                    allowed_view={f'PWP_VIEWPORT_{s}.png' for s in ('FIRST_VISIBLE','AFTER_100K','AFTER_300K')}
                    for capture in result['real_pan_viewport_captures']:
                        name=capture.get('name')
                        if (name not in allowed_view or capture.get('width')!=256
                            or capture.get('height')!=256 or capture.get('crtMode')!=10):
                            raise RuntimeError('Unexpected visible viewport provenance')
                        regs=capture.get('videoRegisters',{})
                        if not isinstance(regs.get('vctrlR1'),int) or not isinstance(regs.get('vctrlR2'),int):
                            raise RuntimeError('Viewport lacks guest R1 priority/R2 enable provenance')
                        file=frames_dir/name
                        if (not file.is_file() or not file.read_bytes().startswith(b'\x89PNG\r\n\x1a\n')
                            or sha(file)!=capture.get('pngSHA256')):
                            raise RuntimeError('Actual WASM viewport PNG evidence integrity failure')
                    if evidence.get('visibleAfterRealPanRead') and not result['real_pan_frame_captures']:
                        raise RuntimeError('Actual PAN pixels visible but required PNG evidence not captured')
                    result['actual_pan_frame_verified']=False  # image review and timing remain pending
                    for capture in result['real_pan_frame_captures']:
                        name=capture.get('name')
                        if not name: continue
                        if name not in ('PWP_FIRST_VISIBLE.png','PWP_AFTER_100K.png','PWP_AFTER_300K.png'):
                            raise RuntimeError('Unexpected frame evidence filename')
                        file=frames_dir/name
                        if not file.is_file() or not file.read_bytes().startswith(b'\x89PNG\r\n\x1a\n') or sha(file)!=capture.get('pngSHA256'):
                            raise RuntimeError('Actual WASM frame PNG evidence integrity failure')
                    result['real_pan_read_bytes']=evidence.get('hostReadBytes',0)
                    result['real_pan_guest_verified_bytes']=evidence.get('guestReadBytesVerified',0)
                    result['real_pan_guest_read_integrity_passed']=evidence.get('guestReadIntegrityPassed',False)
                    result['real_pan_conctrl_mode16_query_passed']=evidence.get('conctrlMode16QueryPassed',False)
                    result['real_pan_conctrl_calls']=evidence.get('conctrlCalls',0)
                    result['real_pan_panic_crtmod10_passed']=evidence.get('panicCrtmod10Passed',False)
                    result['real_pan_crt_mode']=evidence.get('iocsCrtMode')
                    result['real_pan_crtmod_calls']=evidence.get('iocsCrtmodCalls',0)
                    result['real_pan_panic_gclr_on_passed']=evidence.get('panicGclrOnPassed',False)
                    result['real_pan_graphics_display_enabled']=evidence.get('graphicsDisplayEnabled',False)
                    result['real_pan_graphics_clear_count']=evidence.get('graphicsClearCount',0)
                    result['real_pan_panic_sp_init_passed']=evidence.get('panicSpInitPassed',False)
                    result['real_pan_panic_sp_on_passed']=evidence.get('panicSpOnPassed',False)
                    result['real_pan_sprite_initializations']=evidence.get('spriteInitializations',0)
                    result['real_pan_sprite_display_enabled']=evidence.get('spriteDisplayEnabled',False)
                    result['real_pan_guest_read_completed_bytes']=evidence.get('guestReadCompletedBytes',0)
                    if result['real_pan_read_bytes']>0 and not result['real_pan_guest_read_integrity_passed']:
                        raise RuntimeError('Real PAN guest READ bytes do not match host input; do not accept as success')
                    if result['real_pan_panic_sp_on_passed']:
                        result['status']='PASS_REAL_MUSASHI_WASM_PANIC_SPRITE_ON_NOT_ANIMATION'
                    elif result['real_pan_panic_sp_init_passed']:
                        result['status']='PASS_REAL_MUSASHI_WASM_PANIC_SPRITE_INIT_NOT_ANIMATION'
                    elif result['real_pan_panic_gclr_on_passed']:
                        result['status']='PASS_REAL_MUSASHI_WASM_PANIC_GCLR_ON_NOT_ANIMATION'
                    elif result['real_pan_panic_crtmod10_passed']:
                        result['status']='PASS_REAL_MUSASHI_WASM_PANIC_CRTMOD10_NOT_ANIMATION'
                    elif result['real_pan_conctrl_mode16_query_passed']:
                        result['status']='PASS_REAL_MUSASHI_WASM_PANIC_CONCTRL16_QUERY_NOT_ANIMATION'
                    elif result['real_pan_read_bytes']>0:
                        result['status']='PASS_REAL_MUSASHI_WASM_PAN_READ_NOT_CONCTRL_GATE'
                    result['real_pan_malloc256k_succeeded']=evidence.get('malloc256kSucceeded',False)
                    result['real_pan_file_open_attempted']=evidence.get('panOpenAttempted',False)
                    result['real_pan_first_unimplemented_trap']=evidence.get('firstUnimplementedTrap')
                    result['real_pan_supervisor_switches']=evidence.get('supervisorSwitches',0)
                    result['real_pan_last_sr']=evidence.get('lastSR')
                    result['real_pan_pixel_mutations']=evidence.get('pixelMutations',0)
                    result['real_pan_visible_pixels_observed']=bool(evidence.get('visibleAfterRealPanRead',False))
                    result['real_pan_stop_reason']=evidence.get('stopReason')
                    result['real_pan_fault_address']=evidence.get('faultAddress')
                    result['real_pan_mfp_ierb_reads']=evidence.get('mfpIERBReads')
                    result['real_pan_mfp_imrb_reads']=evidence.get('mfpIMRBReads')
                    result['real_pan_iocs_tgusemd_calls']=evidence.get('iocsTgusemdCalls')
                    result['real_pan_iocs_graphics_use']=evidence.get('iocsGraphicsUse')
                    result['real_pan_iocs_text_use']=evidence.get('iocsTextUse')
                    result['real_pan_first_unimplemented_iocs_function']=evidence.get('firstUnimplementedIocsFunction')
                    result['real_pan_iocs_ms_init_calls']=evidence.get('iocsMsInitCalls')
                    result['real_pan_mouse_initialized']=evidence.get('mouseInitialized')
                    result['real_pan_mouse_cursor_visible']=evidence.get('mouseCursorVisible')
                    result['real_pan_nameck_calls']=evidence.get('nameckCalls',0)
                    result['real_pan_files_calls']=evidence.get('filesCalls',0)
                else:result['real_pan_stop_reason']='TRACE_FAILED'

            deep=R/'R16_PANIC_DEEP_TRACE.json'
            if deep.is_file():
                trace=json.loads(deep.read_text(encoding='utf-8'))
                result['pan_runtime_stop']=trace.get('stopReason')
                result['pan_runtime_past_first_dos']=trace.get('pastInitialSetblock')
                # No real .PAN is supplied here, so a frame cannot be claimed.
                result['actual_pan_frame_verified']=False
        except (RuntimeError, ValueError, OSError, subprocess.TimeoutExpired) as e:
            result['status']='SAFE_STOP'
            result['stop_reason']=str(e)
        finally:
            result['source_sha256_after']=hashes(source)
            result['production_original_unchanged']=before==result['source_sha256_after']
            if not result['production_original_unchanged']:result['status']='SAFE_STOP_PRODUCTION_HASH_CHANGED'
            (tmp/'SUMMARY.json').write_text(json.dumps(result,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
            for src in ('R13_REAL_HOST_CPU_EVIDENCE.json','R12_REAL_CPU_MANIFEST.json','R16_PANIC_DEEP_TRACE.json','R16_PANIC_REALPAN_TRACE.json'):
                f=R/src
                if f.is_file(): (tmp/src).write_bytes(f.read_bytes())
            write_zip_atomic(outfile,tmp)
            print('R16 STATUS: '+result['status'],flush=True)
            print('ONE REPORT: '+str(outfile),flush=True)
            if result['status'].startswith('SAFE_STOP'):raise SystemExit(2)
if __name__=='__main__':main()
