import test from 'node:test';
import assert from 'node:assert/strict';
import {findPan16PaletteCandidates,matchMissingPalette0} from '../src/pan-palette-evidence.mjs';
function fixture(palette){
 const b=new Uint8Array(128);b.set([80,65,78,73,67,26],0);b[10]=0;b[11]=16;
 b[12]=0;b[13]=0;b[14]=0;b[15]=96;
 b.set([0,24,0,32],48);
 for(let i=0;i<16;i++){b[52+i*2]=palette[i]>>8;b[53+i*2]=palette[i]&255;}
 return b;
}
const palette=[0xdf70,...Array.from({length:15},(_,i)=>0x1240+i*2)];
test('FIX27: real palette record structure, no hard-coded D17W1 offset',()=>{
 const r=findPan16PaletteCandidates(fixture(palette));
 assert.equal(r.length,1);assert.equal(r[0].offset,48);assert.deepEqual(r[0].palette,palette);
});
test('FIX27: require all 15 colors and missing graphic 0, allow intensity LSB only',()=>{
 const r=findPan16PaletteCandidates(fixture(palette));
 const guest=[0,...palette.slice(1).map(x=>x^1)];
 assert.equal(matchMissingPalette0(r,i=>guest[i]).color,0xdf70);
 guest[9]=0; assert.equal(matchMissingPalette0(r,i=>guest[i]),null);
 guest[9]=palette[9];guest[0]=0x0042;assert.equal(matchMissingPalette0(r,i=>guest[i]),null);
});
test('FIX27: invalid PAN header/payload, or spurious command not accepted',()=>{
 const b=fixture(palette);b[0]=0;assert.deepEqual(findPan16PaletteCandidates(b),[]);
 const c=fixture(palette);c[15]=95;assert.deepEqual(findPan16PaletteCandidates(c),[]);
 const d=fixture(palette);d[49]=25;assert.deepEqual(findPan16PaletteCandidates(d),[]);
});
