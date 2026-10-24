import test from 'node:test';
import assert from 'node:assert/strict';
import {createMusashiBridge} from '../src/panic-core.mjs';

function fixtureHu(){
  const b = new Uint8Array(15412);
  b[0] = 0x48; b[1] = 0x55;
  const d = new DataView(b.buffer);
  d.setUint32(12, 0x39a2, false);
  d.setUint32(16, 0x252, false);
  d.setUint32(20, 0x1772, false);
  const code = [0x4d,0xfa,0x3b,0xf2,0x4f,0xfa,0x53,0x60,0x41,0xe8,0x00,0x10,0x93,0xc8,0x2f,0x09,0x2f,0x08,0xff,0x4a];
  b.set(code,64);
  return b;
}
function fakeCore(states) {
  const heap = new Uint8Array(4000000);
  let status = 0;
  let index = 0;
  let sizeSet = null;
  let supplied = [];
  const m = {HEAPU8:heap,
    _pwp_mu_stage_ptr:()=>50000,
    _pwp_mu_stage_capacity:()=>15412,
    _pwp_mu_load:(size)=>{assert.equal(size,15412); status=1;return status;},
    _pwp_mu_register:(i)=>i===10?0x8000:0,
    _pwp_mu_guest_peek8:(ptr)=>{
      const command='C:\\P68K.PAN';
      if(ptr===0x8000)return command.length;
      if(ptr>0x8000 && ptr<=0x8000+command.length)return command.charCodeAt(ptr-0x8001);
      return 0;
    },
    _pwp_mu_set_pan_size:(hi,lo)=>{sizeSet=[hi,lo];},
    _pwp_mu_run:()=> {status=states[Math.min(index++,states.length-1)];return status;},
    _pwp_mu_status:()=>status,
    _pwp_mu_dispatch:()=>status=1,
    _pwp_mu_trap:()=>0xff42,
    _pwp_mu_trap_pc:()=>0x10020,
    _pwp_mu_io_stage_ptr:()=>20000,
    _pwp_mu_io_capacity:()=>65536,
    _pwp_mu_io_offset_high:()=>0,
    _pwp_mu_io_offset_low:()=>50,
    _pwp_mu_io_length:()=>16,
    _pwp_mu_supply_read:n=>{supplied.push([...heap.subarray(20000,20000+n)]); return status=1;},
    _pwp_mu_iocs_crt_mode:()=>10,
    _pwp_mu_video_vctrl_r2:()=>0x41,_pwp_mu_video_vctrl_r1:()=>0xe4,
    _pwp_mu_video_write_count:()=>0,
    _pwp_mu_video_crtc_changes:()=>0,
    _pwp_mu_video_pixel_writes:()=>1,
    _pwp_frame_render:()=>1,_pwp_frame_render_mode10:()=>1,
    _pwp_frame_pointer:()=>100000,
    _pwp_frame_size:()=>256*256*4,
  };
  return {m, get size(){return sizeSet;}, supplied};
}
function host(){
  const reads=[]; const errors=[];let finished=0;
  return {reads,errors,get finishCount(){return finished},
    readPan:async (id,offset,length)=>{reads.push({id,offset,length});return Uint8Array.from({length},(_,i)=>i);},
    videoFrame:()=>{}, audioFrames:()=>{},
    finished:()=>{finished++;},error:message=>{errors.push(message)}
  };
}
const tick=()=>new Promise(resolve=>setTimeout(resolve,25));
test('R10: authentic HU boundary is required; invalid input does not launch CPU',()=>{
  const {m}=fakeCore([4]);const h=host();
  assert.throws(()=>createMusashiBridge(m,h,new Uint8Array(15412)),/Invalid HU/);
  assert.throws(()=>createMusashiBridge({HEAPU8:new Uint8Array(1024)},h,fixtureHu()),/missing/);
});
test('R10: real WASM ABI bridge routes bounded async PAN reads to host and then exits',async()=>{
  const f=fakeCore([3,4]);const h=host();
  const e=createMusashiBridge(f.m,h,fixtureHu());
  await e.load({id:12,name:'test.PAN',size:0x200000003});
  assert.deepEqual(f.size,[2,3]);
  assert.equal(f.m.HEAPU8[50000],0x48);
  await e.start();await tick();
  assert.deepEqual(h.reads,[{id:12,offset:50,length:16}]);
  assert.equal(f.supplied.length,1);
  assert.deepEqual(f.supplied[0],Array.from({length:16},(_,i)=>i));
  assert.equal(h.finishCount,1);assert.deepEqual(h.errors,[]);
});
test('R10: unsupported DOS call stays blocked, emits address instead of succeeding',async()=>{
  const f=fakeCore([2]);f.m._pwp_mu_dispatch=()=>2;
  const h=host();const e=createMusashiBridge(f.m,h,fixtureHu());
  await e.load({id:1,size:4});await e.start();await tick();
  assert.match(h.errors[0],/Unsupported DOS\/IOCS/);
  assert.match(h.errors[0],/0x00010020/);
  assert.equal(h.finishCount,0);
});
test('R10: stopping stale in-flight read prevents injection into new guest',async()=>{
  const f=fakeCore([3,4]);const h=host();
  let resolveRead;
  h.readPan=()=>new Promise(r=>{resolveRead=r;});
  const e=createMusashiBridge(f.m,h,fixtureHu());
  await e.load({id:1,size:500});await e.start();await tick();
  await e.stop();await e.load({id:2,size:500});
  resolveRead(Uint8Array.of(0xde,0xad));await tick();
  assert.equal(f.supplied.length,0);
  assert.equal(h.finishCount,0);
  assert.deepEqual(h.errors,[]);
});
test('R10: SPACE is explicitly unsupported, not an invented guest input',async()=>{
  const f=fakeCore([1]);const h=host();
  const e=createMusashiBridge(f.m,h,fixtureHu());
  e.space();assert.match(h.errors[0],/未実装/);
  await assert.rejects(e.start(),/No PAN loaded/);
});
test('R10: SHA-256 pin rejects forged HU with correct-looking first bytes',async()=>{
  const {checkPanicSha256,PANIC_X_V138_SHA256}=await import('../src/panic-core.mjs');
  assert.equal(PANIC_X_V138_SHA256.length,64);
  await assert.rejects(checkPanicSha256(fixtureHu()),/SHA-256 mismatch/);
});
test('R10: engine loading never passes off mock ABI for production',async()=>{
  const fs = await import('node:fs');
  const s = fs.readFileSync(new URL('../src/panic-core.mjs',import.meta.url),'utf8');
  assert.match(s,/import\('\.\.\/core\/pwp_musashi\.mjs'\)/);
  assert.match(s,/checkPanicSha256\(hu\)/);
  assert.doesNotMatch(s,/mock_m68k\.c/);
});
test('R10: partial RGBA delivery uses actual WASM frame pointer only after guest video writes',async()=>{
  const f=fakeCore([1,4]);const h=host();const frames=[];
  h.videoFrame=(w,hh,pixels)=>frames.push({w,hh,pixels});
  f.m._pwp_mu_video_write_count=()=>1;
  f.m._pwp_frame_render_mode10=()=>{f.m.HEAPU8.set([0x12,0x34,0x56,0xff],100000);return 1;};
  const e=createMusashiBridge(f.m,h,fixtureHu());
  await e.load({id:8,size:123});
  // Show one actual write after the initial 'load' baseline snapshot.
  f.m._pwp_mu_video_write_count=()=>2;
  await e.start();await tick();
  assert.equal(frames.length,1);
  assert.deepEqual([...frames[0].pixels.slice(0,4)],[0x12,0x34,0x56,0xff]);
  assert.equal(frames[0].w,256);
  assert.equal(h.finishCount,1);
});
test('R10: guest CPU fault is a stop with diagnostic address, not silent output',async()=>{
  const f=fakeCore([-8]);const h=host();
  f.m._pwp_mu_pc=()=>0x10100;f.m._pwp_mu_fault_address=()=>0xe84000;
  const e=createMusashiBridge(f.m,h,fixtureHu());
  await e.load({id:9,size:123});await e.start();await tick();
  assert.match(h.errors[0],/status=-8/);
  assert.match(h.errors[0],/0x00e84000/);
});
test('R10: unreasonably large guest host I/O request is rejected before file access',async()=>{
  const f=fakeCore([3]);const h=host();
  f.m._pwp_mu_io_length=()=>65537;
  const e=createMusashiBridge(f.m,h,fixtureHu());
  await e.load({id:1,size:123});await e.start();await tick();
  assert.match(h.errors[0],/Invalid WASM file request length/);
  assert.deepEqual(h.reads,[]);
});

test('R16: CRTC/palette-only writes cannot qualify as first PAN image',async()=>{
  const f=fakeCore([1,4]);const h=host();const frames=[];const first=[];
  f.m._pwp_mu_video_write_count=()=>12;
  f.m._pwp_mu_video_pixel_writes=()=>0;
  h.videoFrame=(...args)=>frames.push(args);h.firstVisibleFrame=e=>first.push(e);
  const e=createMusashiBridge(f.m,h,fixtureHu());
  await e.load({id:50,size:123});
  f.m._pwp_mu_video_write_count=()=>15;
  await e.start();await tick();
  assert.equal(frames.length,0);assert.equal(first.length,0);
});

test('R16: first visible frame comes only from actual changed guest pixels, once',async()=>{
  const f=fakeCore([1,4]);const h=host();const frames=[];const first=[];
  let writes=0,pixels=0;
  f.m._pwp_mu_video_write_count=()=>writes;
  f.m._pwp_mu_video_pixel_writes=()=>pixels;
  f.m._pwp_frame_render_mode10=()=>{
    f.m.HEAPU8.set([16,32,48,255],100000);return 1;
  };
  h.videoFrame=(w,h,b)=>frames.push([w,h,...b.slice(0,4)]);
  h.firstVisibleFrame=e=>first.push(e);
  const e=createMusashiBridge(f.m,h,fixtureHu());
  await e.load({id:50,size:123});
  writes=2;pixels=1;
  await e.start();await tick();
  assert.equal(frames.length,1);
  assert.deepEqual(frames[0],[256,256,16,32,48,255]);
  assert.deepEqual(first,[{number:1,pixelMutations:1}]);
});

test('R16: black pixel buffer is not presented as a visible first image',async()=>{
  const f=fakeCore([1,4]);const h=host();const first=[];const frames=[];
  let writes=0,pixels=0;
  f.m._pwp_mu_video_write_count=()=>writes;
  f.m._pwp_mu_video_pixel_writes=()=>pixels;
  h.videoFrame=(...args)=>frames.push(args);h.firstVisibleFrame=e=>first.push(e);
  const e=createMusashiBridge(f.m,h,fixtureHu());
  await e.load({id:12,size:99});writes=3;pixels=7;
  await e.start();await tick();
  assert.equal(frames.length,1);assert.equal(first.length,0);
});

test('R16: unsupported raster modes never produce invented image',async()=>{
  const f=fakeCore([1,4]);const h=host();let frames=0;
  let writes=0,pixels=0;
  f.m._pwp_mu_video_write_count=()=>writes;
  f.m._pwp_mu_video_pixel_writes=()=>pixels;
  f.m._pwp_frame_render_mode10=()=>0;
  h.videoFrame=()=>frames++;
  const e=createMusashiBridge(f.m,h,fixtureHu());
  await e.load({id:1,size:99});writes=1;pixels=1;
  await e.start();await tick();assert.equal(frames,0);
});


test('FIX14: CRTMOD other than mode 10 cannot expose backing VRAM as viewport',async()=>{
  const f=fakeCore([1,4]);const h=host();const frames=[];let writes=0;
  f.m._pwp_mu_iocs_crt_mode=()=>11;
  f.m._pwp_mu_video_write_count=()=>writes;
  h.videoFrame=(...args)=>frames.push(args);
  const e=createMusashiBridge(f.m,h,fixtureHu());
  await e.load({id:9,size:99});writes=2;
  await e.start();await tick();
  assert.equal(frames.length,0);
});

test('FIX17: browser bridge uses the real VC priority-ranked graphics compositor',async()=>{
  const f=fakeCore([1,4]);const h=host();const calls=[];
  let writes=0,pixels=0;
  f.m._pwp_mu_video_write_count=()=>writes;
  f.m._pwp_mu_video_pixel_writes=()=>pixels;
  f.m._pwp_mu_video_vctrl_r2=()=>0x43;
  f.m._pwp_mu_video_vctrl_r1=()=>0xe4;
  f.m._pwp_frame_render_mode10=(w,h,overlay)=>{
    calls.push([w,h,overlay]);
    f.m.HEAPU8.set([20,120,140,255],100000);
    return 1;
  };
  const e=createMusashiBridge(f.m,h,fixtureHu());
  await e.load({id:75,size:50});writes=1;pixels=1;
  await e.start();await tick();
  assert.deepEqual(calls,[[256,256,1]]);
  assert.equal(h.finishCount,1);
  assert.deepEqual(h.errors,[]);
});

test('FIX17: unsupported graphics special blend does not fabricate a frame',async()=>{
  const f=fakeCore([1,4]);const h=host();let calls=0;let frames=0;
  let writes=0,pixels=0;
  f.m._pwp_mu_video_write_count=()=>writes;
  f.m._pwp_mu_video_pixel_writes=()=>pixels;
  f.m._pwp_frame_render_mode10=()=>{calls++;return 0;};
  h.videoFrame=()=>{frames++;};
  const e=createMusashiBridge(f.m,h,fixtureHu());
  await e.load({id:76,size:50});writes=1;pixels=1;
  await e.start();await tick();
  assert.ok(calls>0);assert.equal(frames,0);
  assert.equal(h.finishCount,1);
});

// A genuine page flip does not require new pixel mutations.
test('FIX18: R2 page flip repaints even when GVRAM writes are unchanged',async()=>{
  const f=fakeCore([1,1,4]);
  let r2=0x01, writes=0, pixels=0, invocations=0;
  f.m._pwp_mu_video_vctrl_r2=()=>r2;
  f.m._pwp_mu_video_write_count=()=>writes;
  f.m._pwp_mu_video_pixel_writes=()=>pixels;
  f.m._pwp_frame_render_mode10=()=>{
    invocations++;
    f.m.HEAPU8.set(r2===0x01?[0x25,0,0,255]:[0,0x65,0,255],100000);
    return 1;
  };
  f.m._pwp_mu_run=()=>{
    const call=invocations;
    if(!pixels){pixels=1;writes=1;return 1;}
    if(r2===0x01){r2=0x02;return 1;}
    return 4;
  };
  const h=host(), frames=[];
  h.videoFrame=(_w,_h,rgba)=>frames.push([...rgba.slice(0,4)]);
  const e=createMusashiBridge(f.m,h,fixtureHu());
  await e.load({id:8,size:123});
  await e.start();await new Promise(resolve=>setTimeout(resolve,80));
  assert.deepEqual(frames,[[0x25,0,0,255],[0,0x65,0,255]]);
  assert.deepEqual(h.errors,[]);
});
