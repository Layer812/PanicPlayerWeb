import test from 'node:test';
import assert from 'node:assert/strict';
import {describePanHeader} from '../src/pan-header.mjs';
function header(v,words,body){
  const bytes=new Uint8Array(16);bytes.set([80,65,78,73,67,26]);
  bytes[8]=v>>8;bytes[9]=v&255;bytes[10]=words>>8;bytes[11]=words&255;
  bytes[12]=body>>>24;bytes[13]=(body>>>16)&255;bytes[14]=(body>>>8)&255;bytes[15]=body&255;
  return bytes;
}
test('FIX26 D17W1 exact 1.38 header counts/size',()=>{
  const x=describePanHeader(header(0x138,158,181878),182194);
  assert.equal(x.magic,true);assert.equal(x.version,0x138);
  assert.equal(x.headerWords,158);assert.equal(x.expectedBytes,182194);assert.equal(x.sizeMatch,true);
});
test('FIX26 PELSIA01 exact 1.13 header counts/size',()=>{
  const x=describePanHeader(header(0x113,14,54244),54272);
  assert.equal(x.magic,true);assert.equal(x.version,0x113);
  assert.equal(x.expectedBytes,54272);assert.equal(x.sizeMatch,true);
});
test('FIX26 nonmatching PAN header reports evidence, does not reject other vintages',()=>{
  const x=describePanHeader(header(0x113,14,54244),54273);
  assert.equal(x.sizeMatch,false);
});
