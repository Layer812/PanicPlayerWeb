#!/usr/bin/env node
/* Run an authentic .X through actual Musashi until the first unsupported
 * Human68k/IOCS service, genuine _KEEPPR, or controlled CPU failure.
 * This is an evidence probe, NOT a music playback or Z-MUSIC install pass.
 */
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const target=resolve(process.argv[2]);
const file=readFileSync(resolve(process.argv[3]));
assert.equal(file[0],0x48);assert.equal(file[1],0x55);
const wasm=await (await import(pathToFileURL(target).href)).default();
const put=data=>{
  const pos=wasm._pwp_mu_stage_ptr()>>>0;
  assert.ok(data.length<=(wasm._pwp_mu_stage_capacity()>>>0));
  wasm.HEAPU8.set(data,pos);
};
const hu=new Uint8Array(68);
hu[0]=0x48;hu[1]=0x55;new DataView(hu.buffer).setUint32(12,4,false);
hu.set([0x70,0x2a,0xff,0x4c],64);
put(hu);assert.equal(wasm._pwp_mu_load(hu.length),1);
put(file);
const begun=wasm._pwp_mu_tsr_begin(file.length);
if(begun!==1)throw new Error('Actual ZMUSIC208.X staging refused: '+begun);
let completed=0, calls=0, status=1, last=null;
const services=[];
for(let i=0;i<20000;i++){
  const current=wasm._pwp_mu_run(512);
  if(current===1){status=1;continue;}
  if(current===2){
    calls++;
    const op=wasm._pwp_mu_trap()>>>0;
    const d0=wasm._pwp_mu_register(0)>>>0;
    const pc=wasm._pwp_mu_pc()>>>0;
    last={op:'0x'+op.toString(16),fn:'0x'+(d0&255).toString(16),
          pc:'0x'+pc.toString(16),cycles:wasm._pwp_mu_guest_cycles()};
    if(op===0x4e4f && (d0&255)===0x8a){
      last.dma={mode:wasm._pwp_mu_register(1)&255,
        bytes:wasm._pwp_mu_register(2)>>>0,
        source:'0x'+(wasm._pwp_mu_register(9)>>>0).toString(16),
        destination:'0x'+(wasm._pwp_mu_register(10)>>>0).toString(16)};
    }
    if(op===0xff1e){
      const sp=wasm._pwp_mu_register(15)>>>0;
      const ptr=wasm._pwp_mu_guest_peek32(sp)>>>0;
      const codepoints=[];
      for(let i=0;i<80;i++){
        const v=wasm._pwp_mu_guest_peek8(ptr+i)>>>0;
        if(v===0 || v>255)break;
        codepoints.push(v);
      }
      last.print={handle:((wasm._pwp_mu_guest_peek8(sp+4)<<8)|wasm._pwp_mu_guest_peek8(sp+5)),
        dataHex:codepoints.map(x=>x.toString(16).padStart(2,'0')).join(' ')};
    }
    if(op===0xff81 || op===0xff51){
      last.pdb={env:'0x'+(wasm._pwp_mu_guest_peek32(0x23fd00)>>>0).toString(16),
        empty:(wasm._pwp_mu_guest_peek8(0x23fc04)===0)};
    }
    if(op===0xfff7){
      const sp=wasm._pwp_mu_register(15)>>>0;
      last.args={
        p2:'0x'+(wasm._pwp_mu_guest_peek32(sp)>>>0).toString(16),
        p1:'0x'+(wasm._pwp_mu_guest_peek32(sp+4)>>>0).toString(16),
        bytes:((wasm._pwp_mu_guest_peek8(sp+8)<<8)|wasm._pwp_mu_guest_peek8(sp+9))
      };
    }
    if(services.length<32)services.push({...last});
    const dispatched=wasm._pwp_mu_dispatch();
    if(dispatched===1){
      if(wasm._pwp_mu_tsr_phase()===2){completed=1;status=1;break;}
      continue;
    }
    status=dispatched;
    break;
  }
  status=current;break;
}
const result={driver:'AUTHENTIC_ZMUSIC208.X',guestCpu:'REAL_MUSASHI',
  bytes:file.length,initialized:wasm._pwp_mu_tsr_phase()===2,
  completed, status,pc:'0x'+(wasm._pwp_mu_pc()>>>0).toString(16),
  fault:'0x'+(wasm._pwp_mu_fault_address()>>>0).toString(16),
  calls, last, services,
  totalGuestCycles:wasm._pwp_mu_guest_cycles(),
  stalledOnPpi:false,
  note:'Not a Z-MUSIC playback pass unless real _KEEPPR and guest trap-vector signature are confirmed'};
console.log('ZMUSIC REAL BOOT EVIDENCE '+JSON.stringify(result));
if(!completed && (status===4 || calls<44))process.exitCode=2; // must pass first authentic _DMAMOVE; prematurely exiting is not resident
