// Copyright (c) 2026 Layer812. SPDX-License-Identifier: MIT.
import test from 'node:test';
import assert from 'node:assert/strict';
import {directADPCMSampleRate} from '../src/adpcm-msm6258.mjs';

test('FIX44 derives exact 8 clock rates from PX68K 44.1kHz x12 scheduler',()=>{
  const x12=[93750,125000,187500,125000,46875,62500,93750,62500];
  for(let i=0;i<8;i++) assert.equal(directADPCMSampleRate(i)*12,x12[i]);
  assert.equal(directADPCMSampleRate(2),15625);
  assert.equal(directADPCMSampleRate(6),7812.5);
  for(const bad of [-1,8,NaN,1.5,'2',null])
    assert.throws(()=>directADPCMSampleRate(bad),RangeError);
});
test('FIX44 index2 DMA byte clock is exactly half of 15625 samples/second',()=>{
  assert.equal(directADPCMSampleRate(2)/2,7812.5);
  const bytes=604000; // marianne.PAN 19 genuine DMA3 descriptors
  assert.equal(bytes/(directADPCMSampleRate(2)/2),77.312);
});
