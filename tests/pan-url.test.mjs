import test from 'node:test';
import assert from 'node:assert/strict';
import {parsePanId,resolveGithubPanId} from '../src/pan-url.mjs';
const list=[{source:'github',name:'DENKO1.PAN',size:128,sha:'0'.repeat(40)},
 {source:'github',name:'denkost.pan',size:675002,sha:'1'.repeat(40)}];
test('absent query keeps ordinary PAN library',()=>assert.equal(parsePanId(''),null));
test('strict ASCII alphanumeric ID, not a path or external URL',()=>{
 assert.equal(parsePanId('?pan=DENKO1'),'DENKO1');
 for(const q of ['?pan=','?pan=ABC.PAN','?pan=A_B','?pan=A-B','?pan=..%2fabc',
 '?pan=https:%2f%2fevil.test','?pan=%EF%BC%A1','?pan=A&pan=B',
 '?pan='+ 'A'.repeat(65)])assert.throws(()=>parsePanId(q),/PAN指定/);
});
test('resolve existing GitHub PAN with appended extension and case-insensitivity',()=>{
 assert.equal(resolveGithubPanId(list,'denko1').name,'DENKO1.PAN');
 assert.equal(resolveGithubPanId(list,'DenKosT').name,'denkost.pan');
 assert.throws(()=>resolveGithubPanId(list,'missing'),/ありません/);
});
test('ambiguous case variants are never selected',()=>{
 assert.throws(()=>resolveGithubPanId([{source:'github',name:'A.pan'},
 {source:'github',name:'a.PAN'}],'a'),/同名/);
});
