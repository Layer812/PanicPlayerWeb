import test from 'node:test';
import assert from 'node:assert/strict';
import {PanLibrary,isPanName,MAX_READ_LENGTH} from '../src/pan-library.js';
const mock = (name,contents,relativePath='',modified=10)=>({
  name, size:contents.length,webkitRelativePath:relativePath,lastModified:modified,
  slice(start,end){return {arrayBuffer: async()=>Uint8Array.from(contents.slice(start,end)).buffer};}
});

test('only nonempty .PAN files are added and duplicate imports do not multiply',()=>{
 const lib=new PanLibrary();
 const r=lib.add([mock('a.PAN',[1,2,3]),mock('readme.txt',[1]),mock('empty.pan',[]),mock('a.PAN',[1,2,3])]);
 assert.deepEqual(r,{accepted:1,skipped:2,duplicates:1,total:1});
 assert.equal(lib.selected.name,'a.PAN');
});
test('case-insensitive .pan, natural ordering, folders',()=>{
 const lib=new PanLibrary();
 lib.add([mock('m10.PaN',[1],'F/m10.PaN'),mock('m2.pan',[2],'F/m2.pan')]);
 assert.deepEqual(lib.entries.map(x=>x.name),['m2.pan','m10.PaN']);
});
test('selection, bounded navigation and clear',()=>{
 const lib=new PanLibrary();
 lib.add([mock('a.pan',[1]),mock('b.pan',[2])]);
 lib.move(-1);assert.equal(lib.selected.name,'a.pan');
 lib.move(1);assert.equal(lib.selected.name,'b.pan');
 lib.move(1);assert.equal(lib.selected.name,'b.pan');
 assert.equal(lib.select(999),false);
 lib.clear();assert.equal(lib.size,0);assert.equal(lib.selected,null);
});
test('range reads use byte ranges and avoid full-size allocations',async()=>{
 const lib=new PanLibrary();lib.add([mock('x.pan',[10,11,12,13])]);
 const id=lib.selected.id;
 assert.deepEqual(Array.from(await lib.readRange(id,1,2)),[11,12]);
 assert.deepEqual(Array.from(await lib.readRange(id,500,10)),[]);
 await assert.rejects(()=>lib.readRange(id,-1,1),RangeError);
 await assert.rejects(()=>lib.readRange(id,0,MAX_READ_LENGTH+1),RangeError);
 await assert.rejects(()=>lib.readRange(1000,0,1),/PAN not present/);
});
test('names must use .pan extension, never match substring',()=>{
 for(const name of ['a.PAN','b.pan','c.PaN'])assert.equal(isPanName(name),true);
 for(const name of ['.pan','a.pan.txt','PANIC','ab'])assert.equal(isPanName(name),false);
});
test('FIX37 audio playlist navigation wraps first/last without affecting bounded keyboard navigation',()=>{
 const lib=new PanLibrary();
 lib.add([mock('10.pan',[1]),mock('2.pan',[2]),mock('1.pan',[3])]);
 assert.equal(lib.selected.name,'10.pan');
 lib.select(lib.entries[0].id);
 assert.equal(lib.selected.name,'1.pan');
 assert.equal(lib.moveWrap(-1).name,'10.pan');
 assert.equal(lib.moveWrap(1).name,'1.pan');
 assert.equal(lib.moveWrap(1).name,'2.pan');
 assert.equal(lib.moveWrap(4).name,'10.pan');
 lib.clear();
 assert.equal(lib.moveWrap(1),null);
});
