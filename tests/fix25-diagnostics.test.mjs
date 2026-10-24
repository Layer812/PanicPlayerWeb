import test from 'node:test';
import assert from 'node:assert/strict';
import {PlaybackDiagnostics} from '../src/playback-diagnostics.mjs';

function run(){let t=0;const d=new PlaybackDiagnostics({now:()=>t});d.chooseFile({name:'NEW.PAN',path:'NEW.PAN',size:2048});d.begin();return {d, advance:ms=>(t+=ms)};}
const initial={phase:'running',steps:200,pc:0x104aa,panReadCalls:1,panBytes:2048,panOpenCalls:1,
  vdisp:0,irqAcks:0,outputSamples:1,writeCount:120,pixelWrites:20,mode:10,clockStats:{virtualMs:20}};
test('FIX25: stable display warns without declaring PAN format invalid',()=>{
 const {d,advance}=run(); d.sample(initial);advance(5100);d.sample({...initial,steps:200000,vdisp:40,irqAcks:4});
 const e=d.evaluate();assert.equal(e.code,'DISPLAY_STATIC');assert.match(e.heading,/表示変化/);
 assert.doesNotMatch([e.heading,...e.hypotheses].join(' '),/確定.*形式不正/);
});
test('FIX25: IRQ missing has distinct evidence code, not PAN corruption',()=>{
 const {d,advance}=run();d.sample(initial);advance(5100);d.sample({...initial,vdisp:50,irqAcks:0});
 assert.equal(d.evaluate().code,'VDISP_WITHOUT_IRQ_ACK');
});
test('FIX25: zero PAN reads and active CPU is classified separately',()=>{
 const {d,advance}=run();d.sample({...initial,panReadCalls:0,panBytes:0,outputSamples:0,vdisp:0});advance(5200);
 d.sample({...initial,panReadCalls:0,panBytes:0,outputSamples:0,vdisp:0});assert.equal(d.evaluate().code,'NO_PAN_READ');
});
test('FIX25: guest exit is not automatically successful playback',()=>{
 const {d}=run();d.sample({...initial,phase:'exit',exitCode:0,detail:'exit 0'});
 const e=d.evaluate();assert.equal(e.code,'GUEST_EXIT');assert.match(e.heading,/ゲスト終了/);assert.match(e.hypotheses.join(' '),/区別できません/);
});
test('FIX25: unsupported DOS/IOCS displays exact error',()=>{
 const {d}=run();d.sample({...initial,phase:'exception',detail:'Unsupported DOS/IOCS 0xff44 at PC 0x000104aa'});
 assert.equal(d.evaluate().code,'UNSUPPORTED_GUEST_CALL');
 assert.match(d.report().summary,/0xff44/);
});
test('FIX25: events are bounded, report does not contain raw PAN content',()=>{
 const {d}=run();d.fileEvidence({sha256:'abcd',prefixHex:'50 41 4E 00'});
 for(let i=0;i<100;i++)d.log('event '+i);
 assert.equal(d.events.length,60);const report=d.report();
 assert.equal(report.fileEvidence.sha256,'abcd');assert.equal(report.events.length,60);
 assert.equal(report.format,'PWP-FIX25-DIAGNOSTIC-v1');
});
test('FIX25: output progress is distinct from frame-rate correctness',()=>{
 const {d,advance}=run();d.sample(initial);advance(3000);d.sample({...initial,outputSamples:3,irqAcks:2});
 assert.equal(d.evaluate().code,'MULTIPLE_OUTPUTS');assert.match(d.evaluate().heading,/未検証/);
});
test('FIX25: no error conclusion from short execution',()=>{
 const {d}=run();d.sample(initial);assert.equal(d.evaluate().code,'STARTING');
});

test('FIX25: a guest PAN I/O failure has a concrete DOS opcode/result',()=>{
 const {d,advance}=run();d.sample({...initial,panErrorCount:1,panErrorOp:0xff3d,panErrorCode:-2});advance(3000);
 assert.equal(d.evaluate().code,'PAN_GUEST_IO_ERROR');
 assert.match(d.evaluate().heading,/0x0000FF3D/);
 assert.match(d.evaluate().heading,/-2/);
});
