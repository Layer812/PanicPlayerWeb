// Panic Player Web — Copyright (c) 2026 Layer812
import test from 'node:test';
import assert from 'node:assert/strict';
import {isGuestSpaceKey,shouldIgnoreGuestSpaceTarget} from '../src/guest-space-key.mjs';

test('Space keydown delivered from a focused PLAY button without triggering its click',()=>{
  const event={code:'Space',key:' ',ctrlKey:false,altKey:false,metaKey:false,isComposing:false};
  assert.equal(isGuestSpaceKey(event),true);
  assert.equal(shouldIgnoreGuestSpaceTarget({tagName:'BUTTON',isContentEditable:false}),false);
  assert.equal(isGuestSpaceKey({...event,key:'Escape',code:'Escape'}),false);
  assert.equal(isGuestSpaceKey({...event,ctrlKey:true}),false);
  assert.equal(isGuestSpaceKey({...event,altKey:true}),false);
  assert.equal(isGuestSpaceKey({...event,metaKey:true}),false);
  assert.equal(isGuestSpaceKey({...event,isComposing:true}),false);
});
test('Space preserves text input and editable regions',()=>{
  for(const tagName of ['INPUT','TEXTAREA','SELECT'])
    assert.equal(shouldIgnoreGuestSpaceTarget({tagName}),true);
  assert.equal(shouldIgnoreGuestSpaceTarget({tagName:'DIV',isContentEditable:true}),true);
  assert.equal(shouldIgnoreGuestSpaceTarget({
    tagName:'SPAN',closest:s=>s.includes('contenteditable')?{}:null}),true);
  assert.equal(shouldIgnoreGuestSpaceTarget({tagName:'DIV',isContentEditable:false}),false);
});
