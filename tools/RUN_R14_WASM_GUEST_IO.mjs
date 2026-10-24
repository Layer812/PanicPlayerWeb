/** Genuine Musashi WASM: 68000 HU -> DOS _OPEN/_READ/_SEEK/_CLOSE/_EXIT.
 * No mock CPU, no embedded expected responses and no demo animation frames.
 * Runs only after compiling the real Musashi fork into pwp_musashi.wasm.
 */
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';

const path = process.argv[2];
if (!path) throw new Error('Usage: node RUN_R14_WASM_GUEST_IO.mjs path/pwp_musashi.mjs');
const {default: makeModule} = await import(pathToFileURL(resolve(path)).href);
assert.equal(typeof makeModule, 'function', 'real compiled Emscripten factory required');
const m = await makeModule();
const MUST = ['_pwp_mu_load', '_pwp_mu_run', '_pwp_mu_status', '_pwp_mu_dispatch',
  '_pwp_mu_guest_peek8', '_pwp_mu_register', '_pwp_mu_stage_ptr',
  '_pwp_mu_stage_capacity', '_pwp_mu_trap', '_pwp_mu_pc',
  '_pwp_mu_set_pan_size', '_pwp_mu_io_stage_ptr', '_pwp_mu_io_capacity',
  '_pwp_mu_io_offset_high', '_pwp_mu_io_offset_low',
  '_pwp_mu_io_length', '_pwp_mu_supply_read'];
for (const name of MUST) assert.equal(typeof m[name], 'function', name);
assert.ok(m.HEAPU8 instanceof Uint8Array);
const PATH=0x10500, DST=0x10800, DST2=0x31800, TOTAL=160000, READ=130000;
const code=[];
const word=n=>{code.push((n>>>8)&255,n&255);};
const long=n=>{word(n>>>16);word(n);};
const pushW=n=>{word(0x3f3c);word(n);};
const pushL=n=>{word(0x2f3c);long(n);};
const leaSp=n=>{word(0x4fef);word(n);};
pushW(0);pushL(PATH);word(0xff3d);leaSp(6);
pushL(READ);pushL(DST);pushW(5);word(0xff3f);leaSp(10);
pushW(0);pushL(0);pushW(5);word(0xff42);leaSp(8);
pushL(8);pushL(DST2);pushW(5);word(0xff3f);leaSp(10);
pushW(5);word(0xff3e);leaSp(2);word(0xff00);
const hu=new Uint8Array(64+0x700);
hu[0]=72;hu[1]=85;
new DataView(hu.buffer).setUint32(12,0x700);
hu.set(code,64);
hu.set(new TextEncoder().encode('C:\\P68K.PAN\0'),64+PATH-0x10000);
assert.ok(hu.length<=m._pwp_mu_stage_capacity());
const stage=m._pwp_mu_stage_ptr()>>>0;
assert.ok(stage+hu.length<=m.HEAPU8.length);
m.HEAPU8.set(hu,stage);
assert.equal(m._pwp_mu_load(hu.length),1,'HU load');
m._pwp_mu_set_pan_size(0,TOTAL);
let events=[],chunks=0,result=1;
for(let step=0;step<200 && result!==4;step++) {
  const pc=m._pwp_mu_pc()>>>0;
  result=m._pwp_mu_run(100);
  if(result===1) assert.notEqual(m._pwp_mu_pc()>>>0,pc,'CPU made no progress');
  if(result===2) {
    const op=m._pwp_mu_trap()>>>0;
    events.push(op.toString(16).padStart(4,'0'));
    result=m._pwp_mu_dispatch();
    if(op===0xff3d) {assert.equal(result,1);assert.equal(m._pwp_mu_register(0),5);}
    if(op===0xff42) {assert.equal(result,1);assert.equal(m._pwp_mu_register(0),0);}
  }
  if(result===3) {
    const n=m._pwp_mu_io_length()>>>0;
    const hi=m._pwp_mu_io_offset_high()>>>0;
    const lo=m._pwp_mu_io_offset_low()>>>0;
    const offset=hi*4294967296+lo;
    assert.ok(n>0 && n<=65536 && n<=m._pwp_mu_io_capacity());
    assert.ok(Number.isSafeInteger(offset) && offset+n<=TOTAL);
    const ptr=m._pwp_mu_io_stage_ptr()>>>0;
    assert.ok(ptr+n<=m.HEAPU8.length);
    for(let i=0;i<n;i++) m.HEAPU8[ptr+i]=((offset+i)*37+11)&255;
    chunks++;
    result=m._pwp_mu_supply_read(n);
  }
  assert.ok([1,2,3,4].includes(result),`real guest status ${result}`);
  if(step===199) throw new Error('Real guest IO acceptance exceeded execution slice cap');
}
assert.deepEqual(events,['ff3d','ff3f','ff42','ff3f','ff3e','ff00']);
assert.equal(chunks,3);
const pattern=i=>(i*37+11)&255;
for(const at of [0,1,65535,65536,129999])
  assert.equal(m._pwp_mu_guest_peek8(DST+at),pattern(at),`bulk read offset=${at}`);
for(let at=0;at<8;at++)
  assert.equal(m._pwp_mu_guest_peek8(DST2+at),pattern(at),`seek/read offset=${at}`);
console.log(JSON.stringify({result:'REAL_MUSASHI_WASM_GUEST_IO_PASS',
  ops:events,chunks,readBytes:READ,seekReadBytes:8}));
console.log('PAN playback/video/audio STILL NOT VERIFIED');
