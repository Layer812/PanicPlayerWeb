// Panic Player Web — Copyright (c) 2026 Layer812
// SPDX-License-Identifier: MIT (original Layer812-owned code only)
// Third-party components and .PAN media retain separate notices.
import {describePanHeader} from './pan-header.mjs';
import {PlaybackDiagnostics} from './playback-diagnostics.mjs';
const ids=['diag-state','diag-summary','diag-facts','diag-hypotheses','diag-metrics','diag-events','diag-copy','diag-headline'];
const dom=Object.fromEntries(ids.map(id=>[id,document.getElementById(id)]));
export const diagnostics=new PlaybackDiagnostics();
const show = (key,val) => {
  const c=document.createElement('div');c.className='diag-metric';
  const label=document.createElement('span');label.className='diag-key';label.textContent=key;
  const value=document.createElement('span');value.className='diag-value';value.textContent=String(val??'未取得');
  c.append(label,value);dom['diag-metrics'].append(c);
};
const n=x=>x==null?'未取得':Number(x).toLocaleString('ja-JP');
const hx=x=>x==null?'未取得':'0x'+(x>>>0).toString(16).toUpperCase();
export function renderDiagnostics(){
  const d=diagnostics.evaluate(),s=diagnostics.latest;
  dom['diag-state'].textContent=diagnostics.phase;
  dom['diag-headline'].textContent=d.heading.length>170?d.heading.slice(0,170)+'…':d.heading;
  dom['diag-headline'].dataset.severity=d.severity;
  dom['diag-summary'].textContent=`${d.heading}\n判定コード: ${d.code}`;
  dom['diag-summary'].dataset.severity=d.severity;
  dom['diag-facts'].textContent=d.facts.length?d.facts.join('\n'):'PANの選択を待っています。';
  dom['diag-hypotheses'].textContent=d.hypotheses.length?d.hypotheses.join('\n'):'確定・推定できる原因はまだありません。';
  dom['diag-metrics'].replaceChildren();
  for(const [a,b] of [
    ['PAN読込済み',s.panBytes==null?'未取得':n(s.panBytes)+' B'],
    ['PAN READ回数',n(s.panReadCalls)],
    ['PAN I/Oエラー',n(s.panErrorCount)],
    ['DOS戻り値',s.lastDosReturn??'未取得'],
    ['CPU命令数',n(s.steps)],['CPU PC',hx(s.pc)],
    ['V-DISP',n(s.vdisp)],['IRQ受理',n(s.irqAcks)],
    ['GVRAM書込',n(s.writeCount)],['画素変更',n(s.pixelWrites)],
    ['異なる表示',n(s.outputSamples)],['R2',hx(s.r2)],
    ['Gパレット0',hx(s.paletteG0)],['Gパレット1',hx(s.paletteG1)],
    ['Gパレット255',hx(s.paletteG255)],['TEXTパレット0',hx(s.paletteT0)],
    ['CRT MODE',s.mode??'未取得'],['CPU速度',s.measuredMHz==null?'未取得':s.measuredMHz.toFixed(2)+'MHz'],
  ])show(a,b);
  dom['diag-events'].textContent=diagnostics.events.length
    ? diagnostics.events.slice(-60).map(e=>`+${(e.atMs/1000).toFixed(2)}s  ${e.message}`).join('\n')
    : 'まだイベントはありません。';
}
let lastRendered=0;
export function sampleDiagnostics(s){diagnostics.sample(s);if(Date.now()-lastRendered>220||s.phase==='exception'||s.phase==='exit'){
  lastRendered=Date.now();renderDiagnostics();}}
export async function fingerprintPan(item,readRange){
  if(!item)return;
  try{
    const first=await readRange(item.id,0,16);
    const prefixHex=[...first].map(b=>b.toString(16).padStart(2,'0')).join(' ').toUpperCase();
    const max=32*1024*1024;
    const total=Math.min(item.size,max);
    const sample=new Uint8Array(total);
    const chunkSize=1024*1024;
    for(let offset=0;offset<total;offset+=chunkSize){
      const part=await readRange(item.id,offset,Math.min(chunkSize,total-offset));
      if(!(part instanceof Uint8Array)||part.length!==Math.min(chunkSize,total-offset))
        throw new Error(`ファイル指紋の読み取り不足: offset=${offset}`);
      sample.set(part,offset);
    }
    if(!globalThis.crypto?.subtle?.digest)throw new Error('Web Crypto SHA-256が使用できません');
    const digest=await crypto.subtle.digest('SHA-256',sample);
    const hash=[...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');
    // User may select a different PAN while asynchronous hash runs.
    if(diagnostics.file?.name!==item.name || diagnostics.file?.size!==item.size)return;
    diagnostics.fileEvidence({prefixHex,sha256:hash,scope:item.size>max?'prefix':'full',hashedBytes:sample.length,header:describePanHeader(first,item.size)});
  }catch(e){if(diagnostics.file?.name===item.name && diagnostics.file?.size===item.size)diagnostics.fileEvidence({error:e?.message??String(e)});}
  renderDiagnostics();
}
dom['diag-copy'].addEventListener('click',async()=>{
  const report=JSON.stringify(diagnostics.report(),null,2);
  try{
    if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(report);
    else throw new Error('クリップボードAPI利用不可');
    dom['diag-copy'].textContent='コピーしました';
  }catch{
    // Download one diagnostic JSON rather than losing evidence when clipboard is blocked.
    const blob=new Blob([report],{type:'application/json'});
    const url=URL.createObjectURL(blob);const a=document.createElement('a');
    a.href=url;a.download='PWP_FIX26_DIAGNOSTIC.json';a.click();
    URL.revokeObjectURL(url);
    dom['diag-copy'].textContent='JSON保存しました';
  }
});
renderDiagnostics();
