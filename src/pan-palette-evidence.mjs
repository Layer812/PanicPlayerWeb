// Panic Player Web — Copyright (c) 2026 Layer812
// SPDX-License-Identifier: MIT (original Layer812-owned code only)
// Third-party components and .PAN media retain separate notices.
/* FIX27: bounded PAN palette-0 evidence; no synthetic frames or CPU memory writes.
 * A candidate is recognized by the observed 00 18 00 20 + 16 GRBi words
 * sequence. This is NOT a complete PAN format parser. It is applied only
 * when guest graphic palette entries 1..15 match all candidate entries.
 */
export const MAX_PAN_PALETTE_SCAN = 2*1024*1024;
export function findPan16PaletteCandidates(pan){
  if (!(pan instanceof Uint8Array) || pan.length<36 ||
      [0x50,0x41,0x4e,0x49,0x43,0x1a].some((v,i)=>pan[i]!==v)) return [];
  const headerWords=(pan[10]<<8)|pan[11];
  const headerBytes=headerWords*2;
  const payload=((pan[12]<<24)>>>0)+(pan[13]<<16)+(pan[14]<<8)+pan[15];
  if (headerBytes<16 || headerBytes>pan.length ||
      payload!==pan.length-headerBytes) return [];
  const records=[];
  for(let i=headerBytes;i+36<=pan.length;i++){
    if(pan[i]||pan[i+1]!==0x18||pan[i+2]||pan[i+3]!==0x20)continue;
    const palette=Array.from({length:16},(_,n)=>
      (pan[i+4+2*n]<<8)|pan[i+5+2*n]);
    // Deduplicate repeated data. Keep original offset as evidence.
    if(!records.some(x=>x.palette.every((v,j)=>v===palette[j])))
      records.push({offset:i,palette});
  }
  return records;
}
export function matchMissingPalette0(records,readG){
  if(typeof readG!=='function'||!Array.isArray(records))return null;
  const g0=readG(0);
  if(!Number.isInteger(g0)||g0!==0)return null;
  for(const record of records){
    const colors=record?.palette;
    if(!Array.isArray(colors)||colors.length!==16 || !Number.isInteger(colors[0]) || colors[0]===0)continue;
    let matches=true;
    for(let i=1;i<16;i++){
      const guest=readG(i);
      // Intensity bit 0 can legitimately vary by one level during transfer.
      if(!Number.isInteger(guest)||(guest&0xfffe)!==(colors[i]&0xfffe)){matches=false;break;}
    }
    if(matches)return {color:colors[0],offset:record.offset,matched:15};
  }
  return null;
}
