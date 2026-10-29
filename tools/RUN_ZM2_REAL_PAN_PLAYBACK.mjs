#!/usr/bin/env node
/** Genuine PANIC.X + genuine ZMUSIC208.X + real denkozm.pan bounded playback.
 * No fake hooks, synthetic key-ons, host-generated FM tones, or PAN bypass.
 * Original Layer812 test glue, MIT. Run inside isolated experimental CI only.
 */
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash,webcrypto} from 'node:crypto';
import {verifyZmusic208,bootRealZmusic208} from '../src/zmusic-resident.mjs';

const [wasmPath,driverPath,panicPath,panPath]=process.argv.slice(2);
if(!wasmPath||!driverPath||!panicPath||!panPath)
  throw new Error('Usage: RUN_ZM2_REAL_PAN_PLAYBACK.mjs WASM ZMUSIC208.X PANIC.X denkozm.pan');
const PAN_BLOB='1f453612ad13c3dc635b65f9def4e9315882ace4';
const PANIC_HASH='f26527c3d19e71b41fb24efbfff03ae862c8e2430c0e3dc84e7ca67047b1f2fd';
const hex=x=>'0x'+(x>>>0).toString(16).padStart(8,'0');
const hu=new Uint8Array(readFileSync(resolve(panicPath)));
if(createHash('sha256').update(hu).digest('hex')!==PANIC_HASH)
  throw new Error('Original PANIC.X hash mismatch');
const zmusic=new Uint8Array(readFileSync(resolve(driverPath)));
await verifyZmusic208(zmusic,webcrypto.subtle);
const pan=new Uint8Array(readFileSync(resolve(panPath)));
const gitBlob=createHash('sha1').update(Buffer.from('blob '+pan.length+'\0')).update(pan).digest('hex');
if(pan.length!==759100 || gitBlob!==PAN_BLOB)
  throw new Error('Original repository denkozm.pan content changed');
const factory=(await import(pathToFileURL(resolve(wasmPath)).href)).default;
const m=await factory();
const stage=m._pwp_mu_stage_ptr()>>>0;
m.HEAPU8.set(hu,stage);
if(m._pwp_mu_load(hu.length)!==1)throw new Error('Real PANIC.X load refused');
const resident=await bootRealZmusic208(m,zmusic,{yieldControl:async()=>{}});
if(m._pwp_mu_tsr_phase()!==2)throw new Error('Real Z-MUSIC is not resident');
const size=BigInt(pan.length);
m._pwp_mu_set_pan_size(Number(size>>32n),Number(size&0xffffffffn));
const stats={format:'PWP-ZM2-REAL-PAN-v1',driverReal:true,panOriginal:true,
 panBytes:pan.length,resident,steps:0,guestCycles:0,ioCalls:0,readCalls:0,
 bytesDelivered:0,traps:0,dosHistogram:{},fmFrames:0,fmNonzero:0,
 fmChanges:0,fmOverflow:0,opmWritesAtStart:m._pwp_mu_opm_register_writes?.()??null,
 opmWritesAtEnd:0,opmIrqAcks:0,videoWrites:0,pixelWrites:0,
 firstVisible:false,scanouts:0,lastPC:0,lastFault:0,lastStatus:1,stop:'budget'};
const MAX_SLICES=16000,MAX_TRAPS=4000,MAX_BYTES=32*1024*1024;
let lastSample=0,everSample=false,nonzeroScan=false,state=1;
for(let slice=0;slice<MAX_SLICES;slice++){
  state=m._pwp_mu_run(512);
  let n=m._pwp_mu_fm_pending();
  if(n>32768)throw new Error('Unbounded FM FIFO');
  while(n-->0){
    const pcm=m._pwp_mu_fm_pop()>>>0;
    stats.fmFrames++;
    if(pcm!==0)stats.fmNonzero++;
    if(everSample && pcm!==lastSample)stats.fmChanges++;
    lastSample=pcm;everSample=true;
  }
  if((slice&15)===0 || state!==1){
    stats.videoWrites=m._pwp_mu_video_write_count()>>>0;
    stats.pixelWrites=m._pwp_mu_video_pixel_writes()>>>0;
    stats.scanouts=m._pwp_mu_scanout_ticks()>>>0;
    // Sample only from the actual real GPU/CRTC renderer; not fabricated art.
    if(stats.pixelWrites && (m._pwp_mu_iocs_crt_mode()>>>0)===10 &&
       m._pwp_frame_render_mode10(256,256,1)===1){
      const p=m._pwp_frame_pointer()>>>0,length=m._pwp_frame_size()>>>0;
      if(length!==256*256*4 || p>m.HEAPU8.length-length)
        throw new Error('Guest framebuffer outside WASM heap');
      let view=m.HEAPU8.subarray(p,p+length);
      for(let j=0;j<length;j+=4){
        if(view[j]||view[j+1]||view[j+2]){stats.firstVisible=true;break;}
      }
    }
  }
  if(state===2){
    const op=m._pwp_mu_trap()>>>0;
    stats.traps++;
    const key=hex(op);stats.dosHistogram[key]=(stats.dosHistogram[key]??0)+1;
    if(stats.traps>MAX_TRAPS){stats.stop='trap-budget';break;}
    state=m._pwp_mu_dispatch();
  }
  if(state===3){
    const length=m._pwp_mu_io_length()>>>0;
    const capacity=m._pwp_mu_io_capacity()>>>0;
    const offset=(BigInt(m._pwp_mu_io_offset_high()>>>0)<<32n) |
      BigInt(m._pwp_mu_io_offset_low()>>>0);
    if(!length||length>capacity||offset>BigInt(pan.length))
      throw new Error('Invalid guest PAN file request length/offset');
    const expected=Math.min(length,pan.length-Number(offset));
    if(stats.bytesDelivered+expected>MAX_BYTES){stats.stop='io-budget';break;}
    const ptr=m._pwp_mu_io_stage_ptr()>>>0;
    if(ptr>m.HEAPU8.length-expected)throw new Error('Unsafe guest I/O stage');
    m.HEAPU8.set(pan.subarray(Number(offset),Number(offset)+expected),ptr);
    stats.ioCalls++;stats.bytesDelivered+=expected;
    state=m._pwp_mu_supply_read(expected);
  }
  if(state===4){stats.stop='normal-exit';break;}
  if(state!==1){stats.stop='cpu-or-service-failure';break;}
}
stats.steps=m._pwp_mu_steps()>>>0;
stats.guestCycles=m._pwp_mu_guest_cycles()>>>0;
stats.readCalls=m._pwp_mu_pan_read_calls()>>>0;
stats.opmWritesAtEnd=m._pwp_mu_opm_register_writes()>>>0;
stats.opmIrqAcks=m._pwp_mu_opm_acks()>>>0;
stats.fmOverflow=m._pwp_mu_fm_overflows()>>>0;
stats.lastPC=m._pwp_mu_pc()>>>0;
stats.lastFault=m._pwp_mu_fault_address()>>>0;
stats.lastStatus=state;
console.log('REAL DENKOZM GUEST EVIDENCE '+JSON.stringify(stats));
if(stats.stop==='cpu-or-service-failure')
  throw new Error('Actual PANIC.X playback blocked: PC='+hex(stats.lastPC)+
    ' status='+state+' fault='+hex(stats.lastFault));
if(!stats.readCalls||!stats.bytesDelivered)
  throw new Error('Actual PANIC.X did not read original denkozm.pan');
if(!stats.firstVisible)
  throw new Error('Actual PANIC.X has not produced a visible denkozm.pan image');
if(stats.fmNonzero<1024 || stats.fmChanges<64 ||
   stats.opmWritesAtEnd<=stats.opmWritesAtStart)
  throw new Error('No sustained real YM2151 FM from actual denkozm.pan yet');
if(stats.fmOverflow)throw new Error('Actual FM output samples were lost');
console.log('PASS original ZMUSIC208.X + PANIC.X + denkozm.pan visible output and REAL YM2151 FM');
