import test from 'node:test';
import assert from 'node:assert/strict';
import {isPublishedZmusic,isZmusicEnabled} from '../src/engine-loader.js';

test('public Z-MUSIC only enables for exact official Pages origin and path',()=>{
  const isPublic=(hostname,protocol,pathname,search='')=>
    isPublishedZmusic({hostname,protocol,pathname,search});
  assert.equal(isPublic('layer812.github.io','https:','/PanicPlayerWeb/'),true);
  assert.equal(isPublic('layer812.github.io','https:','/PanicPlayerWeb/?pan=denkozm'),true);
  assert.equal(isPublic('layer812.github.io','https:','/PanicPlayerWeb'),true);
  assert.equal(isPublic('layer812.github.io','http:','/PanicPlayerWeb/'),false);
  assert.equal(isPublic('evil-layer812.github.io','https:','/PanicPlayerWeb/'),false);
  assert.equal(isPublic('layer812.github.io','https:','/PanicPlayerWebFake/'),false);
  assert.equal(isPublic('layer812.github.io','https:','/Other/'),false);
  assert.equal(isPublic('localhost','http:','/'),false);
  assert.equal(isZmusicEnabled({hostname:'127.0.0.1',search:'?zmusic=1',pathname:'/',protocol:'http:'}),true);
  assert.equal(isZmusicEnabled({hostname:'127.0.0.1',search:'',pathname:'/',protocol:'http:'}),false);
});
