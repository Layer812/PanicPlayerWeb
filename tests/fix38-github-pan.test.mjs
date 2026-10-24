import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,webcrypto} from 'node:crypto';
import {PanLibrary} from '../src/pan-library.js';
import {parseGithubListing,discoverGithubPans,downloadGithubPan,trustedGithubUrl,MAX_GITHUB_PAN_BYTES} from '../src/github-pan.mjs';

function info(name,bytes) {
  return {source:'github',name,size:bytes.byteLength,
    sha:createHash('sha1').update(`blob ${bytes.byteLength}\0`).update(bytes).digest('hex')};
}
const goodBytes=Uint8Array.from([80,65,78,73,67,26,0,0,1,56,0,8,0,0,0,0]);
function streamResponse(bytes, status=200) {
  return {ok:status===200,status,headers:{get:()=>String(bytes.length)},body:{getReader(){
    let finished=false;
    return {read:async()=>{if(finished)return {done:true};finished=true;return {done:false,value:bytes};},
      releaseLock(){},cancel:async()=>{finished=true;}};
  }}};
}

test('FIX38 GitHub listing only admits direct public pan/ files, no caller URL',()=>{
  const descriptor=info('DENKO1.PAN',goodBytes);
  const data=[
    {name:descriptor.name,path:'pan/'+descriptor.name,size:descriptor.size,sha:descriptor.sha,type:'file',download_url:'https://evil.invalid/abuse'},
    {name:'other.PAN',path:'../other.PAN',size:44,sha:descriptor.sha,type:'file'},
    {name:'BAD.pan',path:'pan/BAD.pan',size:200,sha:'notasha',type:'file'},
    {name:'broken.txt',path:'pan/broken.txt',size:44,sha:descriptor.sha,type:'file'},
    {name:'folder.PAN',path:'pan/folder.PAN',size:44,sha:descriptor.sha,type:'dir'},
    {name:'huge.pan',path:'pan/huge.pan',size:MAX_GITHUB_PAN_BYTES+1,sha:descriptor.sha,type:'file'}
  ];
  assert.deepEqual(parseGithubListing(data),[descriptor]);
  assert.equal(trustedGithubUrl('DENKO1.PAN'), 'https://raw.githubusercontent.com/Layer812/PanicPlayerWeb/main/pan/DENKO1.PAN');
  assert.throws(()=>trustedGithubUrl('../evil.PAN'));
  assert.throws(()=>trustedGithubUrl('evil\\file.PAN'));
});

test('FIX38 missing repo/folder is an empty GitHub list, without PAN body fetch',async()=>{
  const calls=[];
  const result=await discoverGithubPans(async(url,opts)=>{calls.push({url,opts});return {status:404,ok:false};});
  assert.deepEqual(result,[]);
  assert.equal(calls.length,1);
  assert.match(calls[0].url,/api.github.com\/repos\/Layer812\/PanicPlayerWeb\/contents\/pan\?ref=main$/);
  assert.equal(calls[0].opts.credentials,'omit');
  assert.equal(calls[0].opts.redirect,'error');
});

test('FIX38 GitHub entries in library never fetch during add/list/select',async()=>{
  const lib=new PanLibrary();const r=lib.addGithubPans([info('DENKO1.PAN',goodBytes)]);
  assert.equal(r,1);
  assert.equal(lib.selected.name,'DENKO1.PAN');
  assert.equal(lib.selected.file,null);
  assert.match(lib.selected.path,/^GitHub\/pan\/DENKO1.PAN$/);
  await assert.rejects(()=>lib.readRange(lib.selected.id,0,10),/PLAY/);
  assert.equal(lib.moveWrap(1).name,'DENKO1.PAN');
});

test('FIX38 selected PAN download validates real content, exact size and Git blob SHA',async()=>{
  const bytes=goodBytes;
  const source=info('DENKO1.PAN',bytes);
  const calls=[];
  const file=await downloadGithubPan(source,async(url,opts)=>{
    calls.push({url,opts});return streamResponse(bytes);
  });
  assert.equal(file.name,'DENKO1.PAN');assert.equal(file.size,16);
  assert.deepEqual([...new Uint8Array(await file.arrayBuffer())],[...bytes]);
  assert.equal(calls.length,1);
  assert.equal(calls[0].url,trustedGithubUrl(source.name));
  assert.equal(calls[0].opts.credentials,'omit');
  assert.equal(calls[0].opts.redirect,'error');
});

test('FIX38 GitHub SHA mismatch or format mismatch refuses playback',async()=>{
  const m=info('DENKO1.PAN',goodBytes);
  await assert.rejects(()=>downloadGithubPan({...m,sha:'0'.repeat(40)},async()=>streamResponse(goodBytes)),/更新/);
  const invalid=Uint8Array.from({length:16},(_,i)=>i);
  await assert.rejects(()=>downloadGithubPan(info('BAD.PAN',invalid),async()=>streamResponse(invalid)),/PANIC形式/);
  await assert.rejects(()=>downloadGithubPan(m,async()=>streamResponse(goodBytes.slice(0,15))),/サイズ/);
});

test('FIX38 GitHub full download starts at PLAY preparation, caches success',async()=>{
 const lib=new PanLibrary();const m=info('DENKO1.PAN',goodBytes);lib.addGithubPans([m]);let count=0;
 const loader=async(meta)=>{count++;return downloadGithubPan(meta,async()=>streamResponse(goodBytes));};
 const id=lib.selected.id;
 await Promise.all([lib.prepare(id,loader),lib.prepare(id,loader)]);
 assert.equal(count,1);
 assert.deepEqual([...await lib.readRange(id,2,3)],[78,73,67]);
 await lib.prepare(id,loader);assert.equal(count,1);
});

test('FIX38 clearing a library while downloading cannot resurrect a stale PAN',async()=>{
 const lib=new PanLibrary();const m=info('DENKO1.PAN',goodBytes);lib.addGithubPans([m]);const id=lib.selected.id;
 let resume;
 const promise=lib.prepare(id,()=>new Promise(r=>{resume=r}));
 lib.clear();resume(new File([goodBytes],m.name));
 await assert.rejects(promise,/更新/);
 assert.equal(lib.size,0);
});

test('FIX38 local PAN controls and GitHub selection coexist without changing local reads',async()=>{
 const lib=new PanLibrary();lib.addGithubPans([info('DENKO1.PAN',goodBytes)]);
 lib.add([{name:'LOCAL.PAN',size:2,lastModified:5,slice(start,end){return {arrayBuffer:async()=>Uint8Array.from([0xf0,0x0d].slice(start,end)).buffer}}}]);
 const local=lib.entries.find(x=>x.name==='LOCAL.PAN');lib.select(local.id);
 assert.deepEqual([...await lib.readRange(local.id,0,2)],[240,13]);
 assert.equal(lib.moveWrap(1).name,'DENKO1.PAN');
});
