#!/usr/bin/env node
/** R16: evidence-only execution AFTER real PANIC.X FF4A, with genuine Musashi.
 * Does not invent a decoded frame or silently stub unsupported DOS/IOCS.
 * Usage: node tools/RUN_R16_PANIC_DEEP.mjs path/pwp_musashi.mjs path/PANIC.X [--pan path/file.PAN] [--out report.json] [--frames directory]
 */
import {createHash} from 'node:crypto';
import {readFileSync, openSync, closeSync, fstatSync, readSync, writeFileSync, mkdirSync} from 'node:fs';
import {saveActualFrame,frameStats} from './R16_FRAME_EVIDENCE.mjs';
import {mode10GraphicsSlots} from '../src/mode10-display.mjs';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
const args=process.argv.slice(2);
if(args.length<2)throw new Error('Usage: RUN_R16_PANIC_DEEP.mjs core/pwp_musashi.mjs PANIC.X [--pan PATH] [--out PATH]');
const mod=resolve(args[0]), exe=resolve(args[1]);
let panPath=null, out=null, framesDir=null;
for(let i=2;i<args.length;i+=2){
 if(args[i]==='--pan' && args[i+1])panPath=resolve(args[i+1]);
 else if(args[i]==='--out' && args[i+1])out=resolve(args[i+1]);
 else if(args[i]==='--frames' && args[i+1])framesDir=resolve(args[i+1]);
 else throw new Error('Invalid argument: '+args[i]);
}
const hu=readFileSync(exe);
const PIN='f26527c3d19e71b41fb24efbfff03ae862c8e2430c0e3dc84e7ca67047b1f2fd';
if(createHash('sha256').update(hu).digest('hex')!==PIN)throw new Error('Not genuine PANIC.X V1.38 (SHA-256 mismatch)');
const {default:factory}=await import(pathToFileURL(mod).href);
const m=await factory();
const REQUIRED=['_pwp_mu_stage_ptr','_pwp_mu_stage_capacity','_pwp_mu_load',
 '_pwp_mu_set_pan_size','_pwp_mu_run','_pwp_mu_pc','_pwp_mu_steps',
 '_pwp_mu_status','_pwp_mu_dispatch','_pwp_mu_trap','_pwp_mu_trap_pc',
 '_pwp_mu_register','_pwp_mu_fault_address', '_pwp_mu_conctrl_calls','_pwp_mu_conctrl_screen_mode','_pwp_mu_conctrl_fnkeys_mode','_pwp_mu_conctrl_cursor_visible', '_pwp_mu_iocs_gclr_calls','_pwp_mu_graphics_display_enabled','_pwp_mu_graphics_clear_count','_pwp_mu_graphics_access_page','_pwp_mu_iocs_crtmod_calls','_pwp_mu_iocs_crt_mode','_pwp_mu_iocs_ms_init_calls','_pwp_mu_mouse_initialized','_pwp_mu_mouse_cursor_visible', '_pwp_mu_iocs_tgusemd_calls', '_pwp_mu_iocs_graphics_use', '_pwp_mu_iocs_text_use', '_pwp_mu_iocs_last_d1', '_pwp_mu_iocs_last_d2', '_pwp_mu_mfp_ierb_reads', '_pwp_mu_mfp_imrb_reads', '_pwp_mu_mfp_last_read_address', '_pwp_mu_guest_peek8','_pwp_mu_console_length','_pwp_mu_console_byte','_pwp_mu_exit_code',
 '_pwp_mu_io_stage_ptr','_pwp_mu_io_capacity','_pwp_mu_io_offset_high',
 '_pwp_mu_io_offset_low','_pwp_mu_io_length','_pwp_mu_supply_read',
 '_pwp_mu_video_write_count','_pwp_mu_video_pixel_writes','_pwp_mu_video_crtc_reg','_pwp_mu_video_crtc_changes','_pwp_mu_video_vctrl_r2','_pwp_mu_video_vctrl_r1','_pwp_mu_iocs_crt_mode','_pwp_frame_render',
 '_pwp_frame_pointer','_pwp_frame_size','_pwp_frame_render_mode10'];
for(const name of REQUIRED)if(typeof m[name]!=='function')throw new Error('R16 authentic-WASM ABI missing '+name);
if(!(m.HEAPU8 instanceof Uint8Array))throw new Error('No WASM heap');
const stage=m._pwp_mu_stage_ptr()>>>0;
if(hu.length>m._pwp_mu_stage_capacity() || stage>m.HEAPU8.length-hu.length)throw new Error('Unsafe PANIC.X staging bounds');
m.HEAPU8.set(hu,stage);
if(m._pwp_mu_load(hu.length)!==1)throw new Error('Original PANIC.X HU load failed');
let fd=null,size=0;
if(panPath){fd=openSync(panPath,'r');size=fstatSync(fd).size;if(!Number.isSafeInteger(size)||size<0)throw new Error('Unsafe PAN input size');}
const sizeBig=BigInt(size);
m._pwp_mu_set_pan_size(Number(sizeBig>>32n),Number(sizeBig&0xffffffffn));
if(framesDir)mkdirSync(framesDir,{recursive:true});
const trace={type:'REAL_MUSASHI_PANIC_X_RUNTIME_AFTER_FF4A',model:'PanicPlayerWeb R16',
 actualPanicX:true,actualPanInput:!!fd,inputBytes:size,firstVisibleFrame:false,
 observedFrameCount:0,renderProbesNotAnimationFrames:true,frameCaptures:[],viewportCaptures:[],pixelMutations:0,videoWrites:0,hostReadBytes:0,
 guestReadBytesVerified:0,guestReadBytesMismatch:0,guestReadCompletedBytes:0,
 conctrlCalls:0,executedInstructions:0,
 dosCalls:[],supervisorSwitches:0,stopReason:null,lastStatus:null,lastPC:null,
 programEnd:m._pwp_mu_bss_end()>>>0,startA1:m._pwp_mu_register(9)>>>0,
 processMCBEndBefore:m._pwp_mu_guest_peek32(0xfff8)>>>0};
// Actual guest-programmed registers: page G0 scroll, G1 scroll, text scroll,
// CRTC mode and VC R2. These registers must be sampled, not fabricated.
const crtcWord=(r)=>((m._pwp_mu_video_crtc_reg(r)<<8)|m._pwp_mu_video_crtc_reg(r+1))>>>0;
const videoState=()=>({
 g0x:crtcWord(0x18)&511,g0y:crtcWord(0x1a)&511,
 g1x:crtcWord(0x1c)&511,g1y:crtcWord(0x1e)&511,
 textX:crtcWord(0x14)&1023,textY:crtcWord(0x16)&1023,
 crtcMode:crtcWord(0x28),vctrlR1:m._pwp_mu_video_vctrl_r1()>>>0,vctrlR2:m._pwp_mu_video_vctrl_r2()>>>0,
 changedCRTCWrites:m._pwp_mu_video_crtc_changes()>>>0
});
const peek16=a=> ((m._pwp_mu_guest_peek8(a)<<8)|m._pwp_mu_guest_peek8(a+1))>>>0;
const peek32=a=> ((peek16(a)<<16)|peek16(a+2))>>>0;
const guestString=(a,cap=128)=>{let s='';if(a>=0x400000)return '<invalid>';for(let j=0;j<cap&&a+j<0x400000;j++){const c=m._pwp_mu_guest_peek8(a+j)>>>0;if(c===0)return s;if(c>255)return '<invalid>';s+=c>=32&&c<=126?String.fromCharCode(c):`\\x${c.toString(16).padStart(2,'0')}`;}return '<unterminated>';};

try {
 let state=1, finished=false;
 let lastWrites=0;
 let pendingRead=null;
 let firstCaptureInstructions=null;
 const capturePlan=[{label:'FIRST_VISIBLE',delta:0},{label:'AFTER_100K',delta:100000},{label:'AFTER_300K',delta:300000}];
 const captureHashes=new Set();
 // Continue beyond the first offscreen drawing phase to look for a REAL
 // guest scroll/page change. This is bounded; it is not timed movie playback.
 const MAX_SLICES=4800,MAX_TRAPS=320,MAX_HOST_BYTES=16*1024*1024;
 let previousVideo=null;
 trace.videoRegisterTransitions=[];
 trace.videoTransitionOverflow=0;
 trace.viewportNewImageAfter300K=null;
 trace.unrenderedDualPageSamples=0; // legacy key; do not count valid dual layers as errors
 trace.unrenderedNoPageSamples=0;
 trace.dualGraphicsSlotSamples=0;
 trace.noGraphicsSlotSamples=0;
 trace.rawDiagnosticCaptures=[];
 for(let slice=0;slice<MAX_SLICES;slice++){
   state=m._pwp_mu_run(400);
   const videoNow=videoState();
   // Poll guest-visible state at every bounded CPU slice. Register mutation
   // count catches same-slice transitions that return to the previous value.
   if(!previousVideo || Object.keys(videoNow).some(k=>videoNow[k]!==previousVideo[k])){
     if(trace.videoRegisterTransitions.length<96){
       trace.videoRegisterTransitions.push({atInstructions:m._pwp_mu_steps()>>>0,...videoNow});
     }else trace.videoTransitionOverflow++;
     previousVideo=videoNow;
   }
   // R2 bits select priority slots; R1 selects the physical pages.
   const graphicsSlots=mode10GraphicsSlots(videoNow.vctrlR1,videoNow.vctrlR2);
   const activeLogicalCount=Number((videoNow.vctrlR2&3)!==0)+Number((videoNow.vctrlR2&12)!==0);
   if(activeLogicalCount>1)trace.dualGraphicsSlotSamples++;
   if(activeLogicalCount===0)trace.noGraphicsSlotSamples++;
   // Independent G0 diagnostics remain available even while visible layers
   // are switched off, or the compositor has an unsupported special mode.
   // Frame probe is grounded in guest GVRAM/TVRAM mutations, not palette alone.
   const pw=m._pwp_mu_video_pixel_writes()>>>0;
   const writes=m._pwp_mu_video_write_count()>>>0;
   if(pw && writes!==lastWrites && (m._pwp_mu_iocs_crt_mode()>>>0)===10){
     // Independent raw G0 evidence: real GVRAM pixels, NOT a faithful
     // visible 256x256 screen or a completed PAN animation frame.
     if(framesDir && trace.guestReadCompletedBytes>0 &&
        trace.rawDiagnosticCaptures.length<3 &&
        (trace.rawDiagnosticCaptures.length===0 ||
         (m._pwp_mu_steps()>>>0)-trace.rawDiagnosticCaptures[0].atInstructions >=
          (trace.rawDiagnosticCaptures.length===1?100000:300000))){
       if(m._pwp_frame_render(512,512,0,0)===1){
         const n=m._pwp_frame_size()>>>0,p=m._pwp_frame_pointer()>>>0;
         if(n!==512*512*4||p>m.HEAPU8.length-n)throw new Error('Raw G0 diagnostic buffer invalid');
         const rgba=Uint8Array.from(m.HEAPU8.subarray(p,p+n));
         const stat=frameStats(rgba);
         if(stat.nonBlackPixels>0){
           const label=['FIRST','AFTER_100K','AFTER_300K'][trace.rawDiagnosticCaptures.length];
           const name=`PWP_RAW_G0_${label}.png`;
           const saved=saveActualFrame(join(framesDir,name),rgba,512,512);
           trace.rawDiagnosticCaptures.push({name,atInstructions:m._pwp_mu_steps()>>>0,
             rgbaSHA256:stat.rgbaSHA256,pngSHA256:saved.pngSHA256,
             nonBlackPixels:stat.nonBlackPixels,vctrlR1:videoNow.vctrlR1,
             vctrlR2:videoNow.vctrlR2,provenance:'G0_GVRAM_ONLY_NOT_VISIBLE_SCREEN'});
         }
       }
     }
     // Composite G0+G1 by guest R1-ranked slots, preserve guest scroll.
     const ok=m._pwp_frame_render_mode10(256,256,1);
     if(ok===1){
       const n=m._pwp_frame_size()>>>0,ptr=m._pwp_frame_pointer()>>>0;
       if(n!==256*256*4 || ptr>m.HEAPU8.length-n)throw new Error('Visible viewport buffer range invalid');
       const view=m.HEAPU8.subarray(ptr,ptr+n);
       let visible=false;
       for(let i=0;i<n;i+=4){if(view[i]||view[i+1]||view[i+2]){visible=true;break;}}
       trace.observedFrameCount++;
       if(visible && trace.guestReadCompletedBytes>0 && !trace.firstVisibleFrame){
         trace.firstVisibleFrame=true;trace.firstVisibleAfterInstructions=m._pwp_mu_steps()>>>0;
       }
       if(framesDir && visible && trace.guestReadCompletedBytes>0 && trace.guestReadBytesMismatch===0){
         const steps=m._pwp_mu_steps()>>>0;
         if(firstCaptureInstructions===null)firstCaptureInstructions=steps;
         const due=capturePlan[trace.frameCaptures.length];
         if(due && steps-firstCaptureInstructions>=due.delta){
           // Snapshot the live viewport before asking the renderer for the
           // distinct 512x512 VRAM diagnostic image (same CPU state).
           const viewport=Uint8Array.from(view);
           const vstats=frameStats(viewport);
           const vname=`PWP_VIEWPORT_${due.label}.png`;
           const vextra=saveActualFrame(join(framesDir,vname),viewport,256,256);
           trace.viewportCaptures.push({name:vname,atInstructions:steps,
             videoRegisters:videoState(),
             width:256,height:256,crtMode:10,graphicsPage:null,graphicsSlots,
             guestReadBytes:trace.guestReadCompletedBytes,nonBlackPixels:vstats.nonBlackPixels,
             bounds:vstats.bounds,rgbaSHA256:vstats.rgbaSHA256,
             pngSHA256:vextra.pngSHA256,pngBytes:vextra.pngBytes});
           if(m._pwp_frame_render(512,512,0,0)!==1)throw new Error('Active-page VRAM snapshot unavailable');
           const fullLength=m._pwp_frame_size()>>>0,fullPtr=m._pwp_frame_pointer()>>>0;
           if(fullLength!==512*512*4 || fullPtr>m.HEAPU8.length-fullLength)throw new Error('Raw VRAM buffer out of range');
           const full=m.HEAPU8.subarray(fullPtr,fullPtr+fullLength);
           const meta=frameStats(full);
           const duplicate=captureHashes.has(meta.rgbaSHA256);
           const filename=`PWP_${due.label}.png`;
           const extra=duplicate?{}:saveActualFrame(join(framesDir,filename),full,512,512);
           trace.frameCaptures.push({name:duplicate?null:filename,atInstructions:steps,
             guestReadBytes:trace.guestReadCompletedBytes,
             pixelMutations:pw,videoWrites:writes,graphicsPage:null,graphicsSlots,diagnosticG0Only:true,duplicateOfPrevious:duplicate,
             nonBlackPixels:meta.nonBlackPixels,bounds:meta.bounds,rgbaSHA256:meta.rgbaSHA256,
             pngSHA256:extra.pngSHA256??null,pngBytes:extra.pngBytes??0});
           captureHashes.add(meta.rgbaSHA256);
         }
         // FIX15: after 300K, save the FIRST genuinely changed *visible* image
         // if and only if the actual 68000 video registers/pixels produce one.
         // Offscreen-only GVRAM writes cannot create this evidence.
         if(!trace.viewportNewImageAfter300K && trace.viewportCaptures.length===3 &&
            steps>trace.viewportCaptures[2].atInstructions &&
            (slice%16===0 || videoNow.changedCRTCWrites!==trace.viewportCaptures[2].videoRegisters.changedCRTCWrites)){
           const candidate=Uint8Array.from(view);
           const stat=frameStats(candidate);
           if(stat.rgbaSHA256!==trace.viewportCaptures[2].rgbaSHA256){
             const name='PWP_VIEWPORT_NEXT_CHANGE.png';
             const saved=saveActualFrame(join(framesDir,name),candidate,256,256);
             trace.viewportNewImageAfter300K={name,atInstructions:steps,
               videoRegisters:videoState(),graphicsPage:null,graphicsSlots,rgbaSHA256:stat.rgbaSHA256,
               pngSHA256:saved.pngSHA256,pngBytes:saved.pngBytes,
               nonBlackPixels:stat.nonBlackPixels};
           }
         }
       }
       lastWrites=writes;
     }
   }
   if(state===2){
     const op=m._pwp_mu_trap()>>>0;
     const at=m._pwp_mu_trap_pc()>>>0;
     const sp=m._pwp_mu_register(15)>>>0;
     const call={op:'0x'+op.toString(16).padStart(4,'0'),pc:'0x'+at.toString(16).padStart(6,'0')};
     if(op===0x4e4f){
       call.kind='IOCS'; call.iocsFunction=m._pwp_mu_register(0)&255;
       call.d1=m._pwp_mu_register(1)>>>0;
       call.d2=m._pwp_mu_register(2)>>>0;
       call.graphicsUseBefore=m._pwp_mu_iocs_graphics_use()>>>0;
       call.textUseBefore=m._pwp_mu_iocs_text_use()>>>0;
       if(call.iocsFunction===192||call.iocsFunction===193){call.spriteInitializedBefore=!!m._pwp_mu_sprite_initialized();call.spriteDisplayBefore=!!m._pwp_mu_sprite_display_enabled();call.spriteInitCountBefore=m._pwp_mu_sprite_init_count()>>>0;call.spriteEnableCountBefore=m._pwp_mu_sprite_enable_count()>>>0;}
       if(call.iocsFunction===144){call.graphicsEnabledBefore=!!m._pwp_mu_graphics_display_enabled();call.graphicsClearsBefore=m._pwp_mu_graphics_clear_count()>>>0;}
       if(call.iocsFunction===16){call.crtModeArgument=(m._pwp_mu_register(1)&0xffff);call.crtModeBefore=m._pwp_mu_iocs_crt_mode()>>>0;}
     }
     if(op===0xff20){call.superArg=peek32(sp);call.srBefore=m._pwp_mu_register(16)>>>0;call.uspBefore=m._pwp_mu_register(17)>>>0;call.ispBefore=m._pwp_mu_register(18)>>>0;call.spBefore=sp;}
     if(op===0xff4a && sp<0x400000-7){
       call.setblockPointer=peek32(sp);call.setblockBytes=peek32(sp+4);
       call.processEndBefore=m._pwp_mu_guest_peek32(0xfff8)>>>0;
     }
     if(op===0xff48 && sp<0x400000-3){
       call.mallocRequested=peek32(sp);
       call.processEndBefore=m._pwp_mu_guest_peek32(0xfff8)>>>0;
     }
     if(op===0xff37 && sp<=0x400000-8){
       call.nameckInputPointer=peek32(sp); call.nameckBufferPointer=peek32(sp+4);
       call.nameckInput=guestString(call.nameckInputPointer,256);
     }
     if(op===0xff4e && sp<=0x400000-10){
       call.filesBufferPointer=peek32(sp);call.filesPathPointer=peek32(sp+4);
       call.filesPath=guestString(call.filesPathPointer,256);
       call.filesAttributes=peek16(sp+8);
     }
     if(op===0xff3d && sp<0x400000-5){call.openPathPointer=peek32(sp);}
     if(op===0xff0c && sp<0x400000-5){call.kflushMode=peek16(sp);call.kflushPayload=peek32(sp+2);}
     if(op===0xff3d && sp<0x400000-5){call.openMode=peek16(sp+4);}
     if(op===0xff23 && sp<=0x400000-2){
       call.conctrlMode=peek16(sp);
       if([14,16].includes(call.conctrlMode) && sp<=0x400000-4)call.conctrlArgument=(peek16(sp+2)<<16)>>16;
       call.conctrlScreenBefore=m._pwp_mu_conctrl_screen_mode()>>>0;
       call.conctrlFnkeysBefore=m._pwp_mu_conctrl_fnkeys_mode()>>>0;
       call.conctrlCursorBefore=!!m._pwp_mu_conctrl_cursor_visible();
     }
     if(op===0xff3f && sp<=0x400000-10){
       call.readGuestDest=peek32(sp+2);call.readRequested=peek32(sp+6);
     }
     const next=m._pwp_mu_dispatch();
     call.handled=next!==2;call.status=next;
     if(op===0xff20){
       call.srAfter=m._pwp_mu_register(16)>>>0;
       call.uspAfter=m._pwp_mu_register(17)>>>0;
       call.ispAfter=m._pwp_mu_register(18)>>>0;
       call.spAfter=m._pwp_mu_register(15)>>>0;
       if(next===1 && !!(call.srBefore&0x2000)!==!!(call.srAfter&0x2000))trace.supervisorSwitches++;
     }
     if(op===0x4e4f && next===1){
       call.graphicsUseAfter=m._pwp_mu_iocs_graphics_use()>>>0;
       call.textUseAfter=m._pwp_mu_iocs_text_use()>>>0;
       if(call.iocsFunction===192||call.iocsFunction===193){call.spriteInitializedAfter=!!m._pwp_mu_sprite_initialized();call.spriteDisplayAfter=!!m._pwp_mu_sprite_display_enabled();call.spriteInitCountAfter=m._pwp_mu_sprite_init_count()>>>0;call.spriteEnableCountAfter=m._pwp_mu_sprite_enable_count()>>>0;}
       if(call.iocsFunction===144){call.graphicsEnabledAfter=!!m._pwp_mu_graphics_display_enabled();call.graphicsClearsAfter=m._pwp_mu_graphics_clear_count()>>>0;call.graphicsAccessPageAfter=m._pwp_mu_graphics_access_page()>>>0;}
       if(call.iocsFunction===16)call.crtModeAfter=m._pwp_mu_iocs_crt_mode()>>>0;
     }
     if(op===0xff23 && next===1){
       call.conctrlScreenAfter=m._pwp_mu_conctrl_screen_mode()>>>0;
       call.conctrlFnkeysAfter=m._pwp_mu_conctrl_fnkeys_mode()>>>0;
       call.conctrlCursorAfter=!!m._pwp_mu_conctrl_cursor_visible();
     }
     if(op===0xff3f && next===3){
       pendingRead={call,guestDest:call.readGuestDest,requested:call.readRequested,done:0};
     }
     if(op===0xff37 && next===1){
       const buffer=call.nameckBufferPointer;
       if(buffer!==undefined && buffer<=0x400000-91 && (m._pwp_mu_register(0)|0)===0){
         call.nameckOutput={drive:String.fromCharCode(m._pwp_mu_guest_peek8(buffer),m._pwp_mu_guest_peek8(buffer+1)),path:guestString(buffer+2,65),
           base:guestString(buffer+67,19),extension:guestString(buffer+86,5)};
       }
     }
     if(op===0xff4e && next===1 && (m._pwp_mu_register(0)|0)===0){
       const buffer=call.filesBufferPointer;
       if(buffer!==undefined && buffer<=0x400000-53){
         call.filesReportedSize=peek32(buffer+26);
         call.filesReportedName=guestString(buffer+30,23);
       }
     }
     if(next===1 || next===4){
       call.returnD0=m._pwp_mu_register(0)|0;
       if(op===0xff4a || op===0xff48) call.processEndAfter=m._pwp_mu_guest_peek32(0xfff8)>>>0;
     }
     if(trace.dosCalls.length<MAX_TRAPS)trace.dosCalls.push(call);
     if(trace.dosCalls.length>=MAX_TRAPS){trace.stopReason='DOS_TRACE_LIMIT';break;}
     if(next===2){trace.stopReason='UNIMPLEMENTED_DOS_OR_IOCS';break;}
     state=next;
   }
   while(state===3){
     const n=m._pwp_mu_io_length()>>>0, cap=m._pwp_mu_io_capacity()>>>0;
     const ofs=(BigInt(m._pwp_mu_io_offset_high()>>>0)<<32n)|BigInt(m._pwp_mu_io_offset_low()>>>0);
     if(!n||n>65536||n>cap||ofs>BigInt(Number.MAX_SAFE_INTEGER))throw new Error('Invalid guest read');
     const offset=Number(ofs), need=Number(ofs>=sizeBig?0n:((sizeBig-ofs)<BigInt(n)?sizeBig-ofs:BigInt(n)));
     if(trace.hostReadBytes+need>MAX_HOST_BYTES){trace.stopReason='HOST_BYTES_BUDGET';break;}
     const mem=m._pwp_mu_io_stage_ptr()>>>0;
     if(mem>m.HEAPU8.length-need)throw new Error('Unsafe WASM IO buffer');
     let count=0;
     if(fd!==null){count=readSync(fd,m.HEAPU8,mem,need,offset);}
     if(count!==need)throw new Error(`PAN read truncated at ${offset}: got ${count}, need ${need}`);
     trace.hostReadBytes+=count;
     if(!pendingRead || !Number.isInteger(pendingRead.guestDest) ||
         pendingRead.done+count>pendingRead.requested ||
         pendingRead.guestDest>0x400000-pendingRead.done-count){
       throw new Error('Read bridge has no valid bounded guest destination');
     }
     state=m._pwp_mu_supply_read(count);
     if(state<0)throw new Error('WASM _READ bridge returned '+state);
     for(let j=0;j<count;j++){
       const got=m._pwp_mu_guest_peek8(pendingRead.guestDest+pendingRead.done+j)>>>0;
       const expected=m.HEAPU8[mem+j]>>>0;
       if(got===expected)trace.guestReadBytesVerified++;
       else trace.guestReadBytesMismatch++;
     }
     pendingRead.done+=count;
     if(state!==3){
       pendingRead.call.readGuestCopiedBytes=pendingRead.done;
       pendingRead.call.readReturnD0=m._pwp_mu_register(0)|0;
       pendingRead.call.guestBufferMatch=trace.guestReadBytesMismatch===0;
       trace.guestReadCompletedBytes+=pendingRead.done;
       pendingRead=null;
     }
   }
   if(trace.stopReason)break;
   if(state===4){trace.stopReason='GUEST_EXIT';finished=true;break;}
   if(state!==1){trace.stopReason='GUEST_STATUS_'+state;break;}
   if(slice===MAX_SLICES-1)trace.stopReason='INSTRUCTION_SLICE_BUDGET';
 }
 if(!trace.stopReason)trace.stopReason=finished?'GUEST_EXIT':'UNKNOWN';
} catch(e){trace.stopReason='HOST_EXCEPTION';trace.hostError=String(e?.stack??e);}
finally{if(fd!==null)closeSync(fd);}
trace.executedInstructions=m._pwp_mu_steps()>>>0;
trace.faultAddress='0x'+(m._pwp_mu_fault_address()>>>0).toString(16).padStart(6,'0');
trace.conctrlCalls=m._pwp_mu_conctrl_calls()>>>0;
trace.conctrlScreenMode=m._pwp_mu_conctrl_screen_mode()>>>0;
trace.conctrlFnkeysMode=m._pwp_mu_conctrl_fnkeys_mode()>>>0;
trace.conctrlCursorVisible=!!m._pwp_mu_conctrl_cursor_visible();
trace.conctrlMode16QueryPassed=trace.dosCalls.some(c=>c.op==='0xff23' && c.pc==='0x012c6c' &&
  c.conctrlMode===16 && c.conctrlArgument===-1 && c.handled && c.returnD0===c.conctrlScreenBefore);
trace.guestReadIntegrityPassed=trace.hostReadBytes>0 && trace.guestReadBytesMismatch===0 &&
 trace.guestReadBytesVerified===trace.hostReadBytes &&
 trace.guestReadCompletedBytes===trace.hostReadBytes;
trace.iocsSpInitCalls=m._pwp_mu_iocs_sp_init_calls()>>>0;
trace.iocsSpOnCalls=m._pwp_mu_iocs_sp_on_calls()>>>0;
trace.spriteInitialized=!!m._pwp_mu_sprite_initialized();
trace.spriteDisplayEnabled=!!m._pwp_mu_sprite_display_enabled();
trace.spriteInitializations=m._pwp_mu_sprite_init_count()>>>0;
trace.spriteEnables=m._pwp_mu_sprite_enable_count()>>>0;
trace.panicSpInitPassed=trace.dosCalls.some(c=>c.pc==='0x012c8e' && c.iocsFunction===192 && c.handled && c.returnD0===0 && c.spriteInitializedAfter && c.spriteInitCountAfter===c.spriteInitCountBefore+1);
trace.panicSpOnPassed=trace.panicSpInitPassed && trace.dosCalls.some(c=>c.pc==='0x012c92' && c.iocsFunction===193 && c.handled && c.returnD0===0 && c.spriteDisplayAfter && c.spriteEnableCountAfter===c.spriteEnableCountBefore+1);
trace.iocsGclrCalls=m._pwp_mu_iocs_gclr_calls()>>>0;
trace.graphicsDisplayEnabled=!!m._pwp_mu_graphics_display_enabled();
trace.graphicsClearCount=m._pwp_mu_graphics_clear_count()>>>0;
trace.graphicsAccessPage=m._pwp_mu_graphics_access_page()>>>0;
trace.panicGclrOnPassed=trace.dosCalls.some(c=>c.pc==='0x012c8a' && c.iocsFunction===144 && c.handled===true && c.graphicsEnabledAfter===true && c.graphicsClearsAfter===c.graphicsClearsBefore+1);
trace.iocsCrtmodCalls=m._pwp_mu_iocs_crtmod_calls()>>>0;
trace.iocsCrtMode=m._pwp_mu_iocs_crt_mode()>>>0;
trace.panicCrtmod10Passed=trace.dosCalls.some(c=>c.pc==='0x012c86' && c.iocsFunction===16 && c.crtModeArgument===10 && c.handled===true && c.crtModeAfter===10);
trace.iocsTgusemdCalls=m._pwp_mu_iocs_tgusemd_calls()>>>0;
trace.iocsMsInitCalls=m._pwp_mu_iocs_ms_init_calls()>>>0;
trace.mouseInitialized=!!m._pwp_mu_mouse_initialized();
trace.mouseCursorVisible=!!m._pwp_mu_mouse_cursor_visible();
trace.iocsGraphicsUse=m._pwp_mu_iocs_graphics_use()>>>0;
trace.iocsTextUse=m._pwp_mu_iocs_text_use()>>>0;
trace.iocsLastD1=m._pwp_mu_iocs_last_d1()>>>0;
trace.iocsLastD2=m._pwp_mu_iocs_last_d2()>>>0;
trace.mfpIERBReads=m._pwp_mu_mfp_ierb_reads()>>>0;
trace.mfpIMRBReads=m._pwp_mu_mfp_imrb_reads()>>>0;
trace.lastMFPReadAddress='0x'+(m._pwp_mu_mfp_last_read_address()>>>0).toString(16).padStart(6,'0');
trace.lastStatus=m._pwp_mu_status();trace.lastSR=m._pwp_mu_register(16)>>>0;trace.lastPC='0x'+(m._pwp_mu_pc()>>>0).toString(16);
trace.pixelMutations=m._pwp_mu_video_pixel_writes()>>>0;
trace.videoWrites=m._pwp_mu_video_write_count()>>>0;
trace.pastInitialSetblock=trace.executedInstructions>6;
trace.processMCBEndAfter=m._pwp_mu_guest_peek32(0xfff8)>>>0;
trace.malloc256kSucceeded=trace.dosCalls.some(c=>c.op==='0xff48' && c.mallocRequested===262144 && c.returnD0>=0);
trace.panOpenAttempted=trace.dosCalls.some(c=>c.op==='0xff3d');
trace.panReadAttempted=trace.dosCalls.some(c=>c.op==='0xff3f');
trace.firstUnimplementedTrap=trace.dosCalls.find(c=>!c.handled)?.op??null;
trace.firstUnimplementedIocsFunction=trace.dosCalls.find(c=>c.kind==='IOCS'&&!c.handled)?.iocsFunction??null;
trace.guestExitCode=m._pwp_mu_exit_code()>>>0;
trace.consoleText=Array.from({length:Math.min(4096,m._pwp_mu_console_length()>>>0)},(_,i)=>m._pwp_mu_console_byte(i)>>>0).map(v=>v>=32&&v<127?String.fromCharCode(v):(v===10?'\n':v===13?'\r':'.')).join('');
trace.nameckCalls=trace.dosCalls.filter(c=>c.op==='0xff37'&&c.handled&&c.returnD0===0).length;
trace.filesCalls=trace.dosCalls.filter(c=>c.op==='0xff4e').length;
trace.actualPanWasRead=!!fd && trace.hostReadBytes>0;
trace.visibleAfterRealPanRead=trace.actualPanWasRead && trace.firstVisibleFrame;
trace.firstVisibleFrameIsNotDecodeProof=true;
trace.distinctFrameCaptureCount=trace.frameCaptures.filter(c=>!c.duplicateOfPrevious).length;
trace.visibleViewportCaptureCount=trace.viewportCaptures.length;
trace.distinctViewportCaptureCount=new Set(trace.viewportCaptures.map(c=>c.rgbaSHA256)).size;
trace.lastVideoRegisters=videoState();
trace.initialVideoRegisters=trace.videoRegisterTransitions[0]??null;
trace.g0ScrollChanged=trace.videoRegisterTransitions.some((v,i,a)=>i>0&&(v.g0x!==a[0].g0x||v.g0y!==a[0].g0y));
trace.g1ScrollChanged=trace.videoRegisterTransitions.some((v,i,a)=>i>0&&(v.g1x!==a[0].g1x||v.g1y!==a[0].g1y));
trace.g0OnlyObserved=trace.videoRegisterTransitions.some(v=>mode10GraphicsSlots(v.vctrlR1,v.vctrlR2).some(s=>s.page===0));
trace.g1OnlyObserved=trace.videoRegisterTransitions.some(v=>mode10GraphicsSlots(v.vctrlR1,v.vctrlR2).some(s=>s.page===1));
trace.graphicsPageTransitionsInRecordedEvents=trace.videoRegisterTransitions.reduce((n,v,i,a)=>
  n+(i>0&&((v.vctrlR1!==a[i-1].vctrlR1)||(v.vctrlR2!==a[i-1].vctrlR2))?1:0),0);
trace.graphicsPageTransitionCountIsLowerBound=trace.videoTransitionOverflow>0;

trace.viewportUnchangedAt100KAnd300K=trace.viewportCaptures.length>=3 &&
 trace.viewportCaptures[1].rgbaSHA256===trace.viewportCaptures[2].rgbaSHA256;
trace.viewportMode='CRTMOD10_256x256_R1_PRIORITY_R2_SLOT_G0_G1_GRAPHICS_ONLY';
trace.frameEvidenceRequiresVisualReview=true;
if(out)writeFileSync(out,JSON.stringify(trace,null,2)+'\n','utf8');
console.log(JSON.stringify(trace,null,2));
if(!trace.pastInitialSetblock || trace.stopReason==='HOST_EXCEPTION')process.exitCode=1;
