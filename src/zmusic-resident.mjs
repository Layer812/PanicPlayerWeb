// Panic Player Web — experimental real Z-MUSIC v2.08 guest boot.
 // Copyright (c) 2026 Layer812; this integration code only is MIT.
 // No Z-MUSIC third-party executable is distributed with this file.
export const ZMUSIC208_BYTES = 56310;
export const ZMUSIC208_GIT_BLOB = '4a4d88b3a620694cad3f27739e5b6a4d70cfbbbf';
export const ZMUSIC208_UPSTREAM = 'https://raw.githubusercontent.com/toyoshim/z-music.js/fd6ad1c1db9edcf973283597e2c95cedf17eb701/x/ZMUSIC208.X';
const REQUIRED = ['_pwp_mu_stage_ptr','_pwp_mu_stage_capacity',
  '_pwp_mu_tsr_begin','_pwp_mu_tsr_phase','_pwp_mu_tsr_steps','_pwp_mu_run',
  '_pwp_mu_dispatch','_pwp_mu_trap','_pwp_mu_pc','_pwp_mu_guest_peek32',
  '_pwp_mu_guest_peek8'];
const hex=(x)=>'0x'+(x>>>0).toString(16).padStart(8,'0');
const defer=()=>new Promise(resolve=>setTimeout(resolve,0));

/** Authoritative pinned Git blob hash; never trust a non-pinned remote .X.
 * Uses SHA-1 only because Git blob identity is SHA-1; this is not a new
 * security signature and the executable is never run in the host JS VM. */
export async function verifyZmusic208(bytes, subtle=globalThis.crypto?.subtle) {
  if(!(bytes instanceof Uint8Array) || bytes.length!==ZMUSIC208_BYTES ||
      bytes[0]!==0x48 || bytes[1]!==0x55)
    throw new Error('Invalid ZMUSIC208.X HU format or byte length');
  if(!subtle?.digest)throw new Error('Secure hash unavailable for ZMUSIC208.X');
  const prefix=new TextEncoder().encode('blob '+bytes.length+'\0');
  const gitBytes=new Uint8Array(prefix.length+bytes.length);
  gitBytes.set(prefix);gitBytes.set(bytes,prefix.length);
  const hash=Array.from(new Uint8Array(await subtle.digest('SHA-1',gitBytes)))
    .map(x=>x.toString(16).padStart(2,'0')).join('');
  if(hash!==ZMUSIC208_GIT_BLOB)
    throw new Error('ZMUSIC208.X does not match pinned upstream Git blob');
  return bytes;
}

/** Explicitly requested experimental driver download. Never bundle or
 * silently select untrusted URLs and never auto-fallback to a stub. */
export async function fetchVerifiedZmusic208(fetcher=globalThis.fetch,subtle=globalThis.crypto?.subtle) {
  if(typeof fetcher!=='function')throw new Error('Z-MUSIC fetch unavailable');
  const response=await fetcher(ZMUSIC208_UPSTREAM,{mode:'cors',cache:'force-cache'});
  if(!response?.ok)throw new Error('Z-MUSIC upstream unavailable (HTTP '+response?.status+')');
  const bytes=new Uint8Array(await response.arrayBuffer());
  return verifyZmusic208(bytes,subtle);
}

/** Load the authentic Z-MUSIC guest in the SAME actual Musashi instance after
 * PANIC.X's HU load and BEFORE its first CPU slice.
 * The actual guest must execute _KEEPPR; only then does it own TRAP #3.
 * This never manufactures TSR identifiers, responses, synthesized FM,
 * or simulated guest code. */
export async function bootRealZmusic208(m,bytes,{yieldControl=defer,maxSlices=20000}={}) {
  if(!(m?.HEAPU8 instanceof Uint8Array) ||
     REQUIRED.some(n=>typeof m[n]!=='function'))
    throw new Error('Actual Musashi Z-MUSIC resident preboot unavailable');
  if(!(bytes instanceof Uint8Array)||bytes.length!==ZMUSIC208_BYTES)
    throw new TypeError('A verified authentic ZMUSIC208.X is required');
  if(!Number.isInteger(maxSlices)||maxSlices<1||maxSlices>50000)
    throw new RangeError('Invalid Z-MUSIC preboot CPU budget');
  const stage=m._pwp_mu_stage_ptr()>>>0;
  if(bytes.length>(m._pwp_mu_stage_capacity()>>>0) ||
     stage>m.HEAPU8.length || bytes.length>m.HEAPU8.length-stage)
    throw new RangeError('Z-MUSIC image exceeds bounded Musashi staging');
  const originalPC=m._pwp_mu_pc()>>>0;
  m.HEAPU8.set(bytes,stage);
  const began=m._pwp_mu_tsr_begin(bytes.length);
  if(began!==1)throw new Error('Real Z-MUSIC guest bootstrap refused: '+began);
  let services=0;
  for(let slice=0;slice<maxSlices;slice++){
    const current=m._pwp_mu_run(512);
    if(current===1){
      if((slice&63)===63)await yieldControl();
      continue;
    }
    if(current!==2){
      throw new Error('Z-MUSIC guest CPU stopped at '+hex(m._pwp_mu_pc())+
        ' with status '+current);
    }
    const trapped=m._pwp_mu_trap()>>>0;
    services++;
    const result=m._pwp_mu_dispatch();
    if(result!==1){
      throw new Error('Real Z-MUSIC guest DOS/IOCS '+hex(trapped)+
        ' failed with status '+result+' at '+hex(m._pwp_mu_pc()));
    }
    if(m._pwp_mu_tsr_phase()===2){
      const handler=m._pwp_mu_guest_peek32(0x8c)>>>0;
      if(m._pwp_mu_pc()>>>0 !== originalPC ||
         handler<0x240008 || handler>=0x3c0000 || (handler&1))
        throw new Error('Guest returned with invalid CPU state or trap #3');
      const id=Array.from({length:6},(_,i)=>m._pwp_mu_guest_peek8(handler-8+i)>>>0);
      if(id.some((x,i)=>x!==[90,109,117,83,105,67][i]))
        throw new Error('Guest has no authentic ZmuSiC TSR marker');
      return Object.freeze({guestPC:originalPC,handler,services,
        steps:m._pwp_mu_tsr_steps()>>>0});
    }
    if((slice&63)===63)await yieldControl();
  }
  throw new Error('Real Z-MUSIC boot exceeded bounded guest CPU budget');
}
