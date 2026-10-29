import test from 'node:test';
import assert from 'node:assert/strict';
import {isLocalZmusicPreview} from '../src/engine-loader.js';

test('genuine Z-MUSIC preview is explicit and restricted to loopback',()=>{
 const yes=(hostname,search)=>isLocalZmusicPreview({hostname,search});
 assert.equal(yes('127.0.0.1','?zmusic=1'),true);
 assert.equal(yes('localhost','?zmusic=1&pan=denkozm'),true);
 assert.equal(yes('[::1]','?zmusic=1'),true);
 assert.equal(yes('localhost',''),false);
 assert.equal(yes('localhost','?zmusic=0'),false);
 assert.equal(yes('layer812.github.io','?zmusic=1'),false);
 assert.equal(yes('attacker.localhost.example','?zmusic=1'),false);
 assert.equal(yes('github.com','?zmusic=1'),false);
});
