import {test} from 'node:test';
import assert from 'node:assert/strict';
import {pngFromRGBA,frameStats,saveActualFrame} from '../tools/R16_FRAME_EVIDENCE.mjs';
import {inflateSync} from 'node:zlib';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';

test('FIX13 PNG evidence losslessly carries actual RGBA bytes, no fabricated color',()=>{
 const w=4,h=4, src=new Uint8Array(w*h*4);
 for(let i=0;i<16;i++){const j=i*4;src[j]=i*7;src[j+1]=i*3;src[j+2]=i*13;src[j+3]=255;}
 const png=pngFromRGBA(src,w,h);
 assert.deepEqual([...png.subarray(0,8)],[137,80,78,71,13,10,26,10]);
 assert.equal(png.toString('ascii',12,16),'IHDR');
 assert.equal(png.readUInt32BE(16),w);assert.equal(png.readUInt32BE(20),h);
 assert.equal(png.toString('ascii',37,41),'IDAT');
 const length=png.readUInt32BE(33);
 const raw=inflateSync(png.subarray(41,41+length));
 const copy=[]; for(let y=0;y<h;y++){assert.equal(raw[y*(w*4+1)],0);copy.push(...raw.subarray(y*(w*4+1)+1,(y+1)*(w*4+1)));}
 assert.deepEqual(copy,[...src]);
});

test('FIX13 PNG rejects dimension mismatch and avoids accidental black-only fake first frame',()=>{
 assert.throws(()=>pngFromRGBA(new Uint8Array(3),512,512),/dimensions/);
 const dir=mkdtempSync(join(tmpdir(),'pwp_fix13_'));
 try {
   const buf=new Uint8Array(512*512*4);
   assert.throws(()=>saveActualFrame(join(dir,'empty.png'),buf,512,512),/Black-only/);
   buf[(17*512+23)*4]=188;buf[(17*512+23)*4+3]=255;
   const p=join(dir,'first.png');const s=saveActualFrame(p,buf,512,512);
   assert.equal(s.nonBlackPixels,1);assert.deepEqual(s.bounds,{left:23,top:17,right:23,bottom:17});
   assert.deepEqual(readFileSync(p).subarray(0,8),Buffer.from([137,80,78,71,13,10,26,10]));
   assert.throws(()=>saveActualFrame(p,buf,512,512),/EEXIST/);
 } finally {rmSync(dir,{recursive:true,force:true});}
});
