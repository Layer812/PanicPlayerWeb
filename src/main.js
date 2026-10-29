// Panic Player Web — Copyright (c) 2026 Layer812
// SPDX-License-Identifier: MIT (original Layer812-owned code only)
// Third-party components and .PAN media retain separate notices.
import {PanLibrary} from './pan-library.js';
import {discoverGithubPans,downloadGithubPan} from './github-pan.mjs';
import {parsePanId,resolveGithubPanId} from './pan-url.mjs';
import {VideoOutput} from './video-output.js';
import {AudioOutput} from './audio-output.js';
import {recoverLinkedAudio} from './url-audio-recovery.mjs';
import {loadEngine,isZmusicEnabled,isPublishedZmusic} from './engine-loader.js';
import {isGuestSpaceKey,shouldIgnoreGuestSpaceTarget} from './guest-space-key.mjs';
import {findPan16PaletteCandidates, MAX_PAN_PALETTE_SCAN} from './pan-palette-evidence.mjs';
import {diagnostics,renderDiagnostics,sampleDiagnostics,fingerprintPan} from './diagnostic-panel.js';

const byId = (id) => document.getElementById(id);
const el = Object.fromEntries([
 'vdisp-status','screen','screen-shell','screen-overlay','overlay-title','overlay-description','screen-filename','screen-mode',
 'prev','play','next','repeat','folder-auto','fullscreen','status','audio-status','count','open-files','open-folder','clear',
 'file-input','folder-input','drop-zone','file-list','github-status'
].map(id => [id,byId(id)]));

const library = new PanLibrary();
const video = new VideoOutput(el.screen);
const audio = new AudioOutput();
const experimentalZmusic = isZmusicEnabled(location);
const publicZmusic = isPublishedZmusic(location);
let engine = null;
let playing = false;
let repeat = false;
let folderAuto = false;
let finishing = false;
let transition = false;
let generation = 0;
let firstVisible = false;
let retainedFrame = false;
let deliveredDisplayUpdates = 0;
let requestedPanId = null, panLinkStatus = null, panLinkError = false;
let linkedPanSelected = false, audioAutoplayBlocked = false;
let audioRecoveryBusy = false;
try { requestedPanId = parsePanId(location.search); }
catch (e) { panLinkStatus = e?.message ?? String(e); panLinkError = true; }

video.blank();

function message(s, isError=false) {
  el.status.textContent = s;
  el.status.classList.toggle('error', isError);
}
function prettyBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n/1024).toFixed(1)} KiB`;
  return `${(n/(1024*1024)).toFixed(2)} MiB`;
}
function getFilename() {
  return library.selected?.name ?? 'NO FILE';
}
function display() {
  el.count.textContent = String(library.size);
  el['screen-filename'].textContent = getFilename();
  el['screen-mode'].textContent = playing ? 'PLAYING' : (retainedFrame ? 'END' : (engine ? 'READY' : 'OFFLINE'));
  el.play.textContent = playing ? 'STOP' : 'PLAY';
  el.play.disabled = !engine || !library.selected || transition;
  el.prev.disabled = !engine || !library.size || transition;
  el.next.disabled = !engine || !library.size || transition;
  el.clear.disabled = !library.size || transition;
  el.repeat.setAttribute('aria-pressed', String(repeat));
  el['folder-auto'].setAttribute('aria-pressed', String(folderAuto));
  el['screen-overlay'].hidden = playing || retainedFrame;
  el['file-list'].replaceChildren();
  if (!library.size) {
    const p = document.createElement('p');p.className='empty';
    p.textContent='まだPANファイルが選択されていません。';el['file-list'].append(p);
  } else {
    for (const item of library.entries) {
      const selected = item.id === library.selectedId;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'file-entry' + (selected ? ' active' : '');
      button.setAttribute('role', 'option');
      button.setAttribute('aria-selected', String(selected));
      button.dataset.entryId = String(item.id);
      const fileName = document.createElement('span');fileName.className='file-name';
      fileName.textContent=item.path;
      const size = document.createElement('span');size.className='file-size';
      size.textContent=prettyBytes(item.size) + (item.remote ? ' · GitHub' : '');
      button.append(fileName, size);
      button.addEventListener('click', () => {void choose(item.id);});
      button.addEventListener('dblclick', () => {void start();});
      el['file-list'].append(button);
    }
  }
}
async function stop({retainFrame=false,keepAudio=false}={}) {
  if (!engine || transition) return;
  const token = ++generation;
  audioAutoplayBlocked=false;
  transition=true;display();
  try {if(diagnostics.phase==='実行中'){diagnostics.finish('手動停止');renderDiagnostics();}await engine.stop();playing=false;if(!keepAudio)await audio.stop();if (!retainFrame) {video.blank();firstVisible=false;} retainedFrame=retainFrame && firstVisible;}
  catch (e) {message(`終了失敗: ${e?.message ?? e}`,true);}
  finally {if (token === generation) {transition=false;playing=false;display();}}
}
async function choose(id) {
  if (id === library.selectedId) return;
  if (playing) await stop();
  library.select(id);
  video.blank();retainedFrame=false;firstVisible=false;deliveredDisplayUpdates=0;
  display();
  if(library.selected){diagnostics.chooseFile(library.selected);renderDiagnostics();if(!library.selected.remote || library.selected.file)void fingerprintPan(library.selected,(id,pos,len)=>library.readRange(id,pos,len));}
  if (library.selected) message(`選択: ${library.selected.path}（${prettyBytes(library.selected.size)}）`);
}
async function start({automatic=false,linkedAutoplay=false}={}) {
  if (!engine || !library.selected || playing || transition) return;
  const item = library.selected;
  const token=++generation;
  audioAutoplayBlocked=false;
  transition=true;display();
  try {
    // Only ?pan=ID starts on page load. Ordinary PLAY keeps its audio gesture.
    // Browser auto-audio may be blocked; never hang forever on resume().
    if (linkedAutoplay) {
      audioAutoplayBlocked=!(await audio.tryAutoplay(800));
    } else if (!automatic) {
      await audio.enable(); // PLAY user gesture unlocks Web Audio.
      if (audio.context?.state !== 'running')
        throw new Error('PLAY操作でブラウザ音声を有効化できませんでした');
    }
    // No PAN bytes are downloaded automatically. A PLAY/PREV/NEXT action
    // fetches the selected entry from the fixed repository, then verifies it.
    if(item.remote && !item.file) {
      message(`GitHubから ${item.name} を検証して読み込んでいます…`);
      await library.prepare(item.id, downloadGithubPan);
      if (token !== generation || library.selectedId !== item.id) return;
    }
    audio.halt();
    video.blank();retainedFrame=false;firstVisible=false;deliveredDisplayUpdates=0;
    diagnostics.chooseFile(item);renderDiagnostics();
    void fingerprintPan(item,(id,pos,len)=>library.readRange(id,pos,len));
    let paletteEvidenceRecords=[];
    if(item.size<=MAX_PAN_PALETTE_SCAN){
      try{
        const bytes=await library.readRange(item.id,0,item.size);
        paletteEvidenceRecords=findPan16PaletteCandidates(bytes);
      }catch{/* Optional display evidence must never stop guest playback. */}
    }
    await engine.load({id:item.id,name:item.name,size:item.size,paletteEvidenceRecords});
    if (token !== generation) return;
    diagnostics.begin();renderDiagnostics();
    await engine.start();
    playing = true;
    message(audioAutoplayBlocked
      ? `映像再生中：${item.path}。ブラウザが音声自動再生を制限しています。音を出すには再生画面をクリックしてください。`
      : `再生中：${item.path}`);
  } catch (e) {
    playing=false;
    diagnostics.finish('異常停止',e?.message??String(e));renderDiagnostics();byId('diagnostics').open=true;
    message(`再生に失敗しました: ${e?.message ?? e}`,true);
  } finally {
    if (token === generation) {transition=false;display();}
  }
}
async function finished() {
  if (!playing || finishing) return;
  finishing = true;
  try {
    const continueCurrent = repeat;
    const continueFolder = folderAuto && library.size > 0;
    diagnostics.finish('終了', `再生終了。表示更新 ${diagnostics.latest.outputSamples??'不明'}回`);
    renderDiagnostics();
    await stop({retainFrame:firstVisible && !continueCurrent && !continueFolder,keepAudio:continueCurrent||continueFolder});
    if (continueCurrent || continueFolder) {
      if (continueFolder) library.moveWrap(1);
      display();
      await start({automatic:true});
    } else {
      message(retainedFrame ? '再生終了。最終画面を保持しています。' : '再生終了');
    }
  } finally { finishing = false; }
}
// PREV/NEXT must start playback immediately with audio, even if the prior
// track is running. Enable WebAudio before any await that could lose the
// user activation needed by browsers.
async function jumpAndPlay(delta) {
  if (!engine || !library.size || transition) return;
  let audioReady;
  try { audioReady = audio.enable(); } catch (error) {
    message(`音声を開始できません: ${error?.message??error}`, true);return;
  }
  try {
    await audioReady;
    if (playing) await stop({keepAudio:true});
    if (transition) return;
    library.moveWrap(delta);
    display();
    await start({automatic:true});
  } catch (error) {
    message(`曲送りに失敗しました: ${error?.message??error}`, true);
  }
}
async function move(delta) {
  if (!library.size || transition) return;
  if (playing) await stop();
  library.move(delta);
  display();
  if(library.selected){diagnostics.chooseFile(library.selected);renderDiagnostics();if(!library.selected.remote || library.selected.file)void fingerprintPan(library.selected,(id,pos,len)=>library.readRange(id,pos,len));}
  if (library.selected) message(`選択: ${library.selected.path}`);
}
function handleFiles(files) {
  const result = library.add(files);
  display();
  if(library.selected && diagnostics.phase==='準備中'&&!diagnostics.file){diagnostics.chooseFile(library.selected);renderDiagnostics();if(!library.selected.remote || library.selected.file)void fingerprintPan(library.selected,(id,pos,len)=>library.readRange(id,pos,len));}
  if (result.accepted) message(`${result.accepted}件を読み込みました。${library.size}件のPANを一覧表示しています。${engine ? '' : '再生コアは未接続です。'}`);
  else message(`有効な新規.PANはありません（対象外 ${result.skipped}件 / 重複 ${result.duplicates}件）。`);
}

el['open-files'].addEventListener('click',()=>el['file-input'].click());
el['open-folder'].addEventListener('click',()=>el['folder-input'].click());
el['file-input'].addEventListener('change',event=>{
  handleFiles(event.target.files);event.target.value='';
});
el['folder-input'].addEventListener('change',event=>{
  handleFiles(event.target.files);event.target.value='';
});
el.clear.addEventListener('click',async()=>{
  if(playing)await stop();library.clear();diagnostics.reset();renderDiagnostics();video.blank();retainedFrame=false;firstVisible=false;deliveredDisplayUpdates=0;display();message('PAN一覧をクリアしました。');
});
el.prev.addEventListener('click',()=>{void jumpAndPlay(-1);});
el.next.addEventListener('click',()=>{void jumpAndPlay(1);});
el.play.addEventListener('click',()=>{if(playing)void stop();else void start();});
// Browser policies can block URL audio. On a real screen click, unlock audio
// synchronously within the gesture, then restart PANIC.X FROM THE BEGINNING.
// Previously rendered audio was dropped, so resume-only loses the opening.
el['screen-shell'].addEventListener('pointerdown',()=>{
  if(!audioAutoplayBlocked || !playing || transition || audioRecoveryBusy)return;
  audioRecoveryBusy=true;
  void recoverLinkedAudio({
    unlock:()=>audio.enable(),
    isRunning:()=>audio.context?.state==='running',
    stopKeepingAudio:()=>stop({keepAudio:true}),
    restart:()=>start({automatic:true})
  }).then(()=>{
    if(playing && !audioAutoplayBlocked)
      message(`音声付きで最初から再生：${library.selected?.path??'PAN'}`);
  }).catch(error=>message(`音声付き再生の再開に失敗しました：${error?.message??error}`,true))
    .finally(()=>{audioRecoveryBusy=false;});
});
el.repeat.addEventListener('click',()=>{repeat=!repeat;if(repeat)folderAuto=false;display();message(repeat?'現在のPANを繰り返します。':'REPEATを解除しました。');});
el['folder-auto'].addEventListener('click',()=>{folderAuto=!folderAuto;if(folderAuto)repeat=false;display();message(folderAuto?'一覧の末尾から先頭へ戻る自動再生を有効にしました。':'FOLDER AUTOを解除しました。');});
el.fullscreen.addEventListener('click',async()=>{
 try {
  if(document.fullscreenElement) await document.exitFullscreen();
  else await el['screen-shell'].requestFullscreen();
 } catch(e){message(`フルスクリーンを使用できません: ${e?.message ?? e}`,true);}
});
el['file-list'].addEventListener('keydown',event=>{
  if(event.key === 'ArrowDown' || event.key === 'ArrowUp'){
    event.preventDefault();void move(event.key === 'ArrowDown' ? 1 : -1);
  } else if(event.key==='Enter' && engine){event.preventDefault();void start();}
});
document.addEventListener('keydown',event=>{
  const target=event.target;
  const tag=target?.tagName;
  if(playing && engine && isGuestSpaceKey(event) &&
     !shouldIgnoreGuestSpaceTarget(target,el['file-list'])){
    /* Prevent the browser scrolling or re-clicking a focused PLAY/PREV/NEXT
     * button. SPACE belongs to the real PANIC.X while playing; Enter still
     * activates the focused button normally. No key-repeat flood. */
    event.preventDefault();
    if(!event.repeat && !engine.space())message('SPACE入力を受け付けられませんでした。',true);
    return;
  }
  if(tag==='INPUT'||tag==='TEXTAREA'||tag==='BUTTON'||tag==='SELECT'||target===el['file-list'])return;
  if(event.key==='Escape' && engine && playing){event.preventDefault();void stop();}
});
document.addEventListener('keyup',event=>{
  if(playing && engine && isGuestSpaceKey(event) &&
     !shouldIgnoreGuestSpaceTarget(event.target,el['file-list']))
    event.preventDefault();
});
for (const eventName of ['dragenter','dragover']){
 el['drop-zone'].addEventListener(eventName,event=>{event.preventDefault();event.dataTransfer.dropEffect='copy';el['drop-zone'].classList.add('drag-over');});
}
el['drop-zone'].addEventListener('dragleave',()=>el['drop-zone'].classList.remove('drag-over'));
el['drop-zone'].addEventListener('drop',event=>{
 event.preventDefault();el['drop-zone'].classList.remove('drag-over');handleFiles(event.dataTransfer.files);
});

display();
// Metadata-only discovery. 404 = no hosted folder yet; no change to local UI.
const githubPanListing = discoverGithubPans().then(entries => {
  const added = library.addGithubPans(entries);
  el['github-status'].textContent = entries.length ?
    `GitHub pan/: ${entries.length}件を検出（PLAY時に取得）` :
    'GitHub pan/: PAN未登録';
  if (requestedPanId !== null) {
    try {
      const found = resolveGithubPanId(entries,requestedPanId);
      const entry = library.entries.find(item => item.remote?.sha === found.sha &&
        item.remote?.name === found.name && item.remote?.size === found.size);
      if (!entry) throw new Error(`指定PAN「${requestedPanId}」を登録できませんでした。`);
      library.select(entry.id);
      linkedPanSelected=true;
      panLinkStatus = `GitHub PAN: ${found.name} を自動再生します。`;
      panLinkError = false;
      diagnostics.chooseFile(library.selected);renderDiagnostics();
      // SHA-checked, size-limited download happens only on PLAY.
    } catch (e) {
      linkedPanSelected=false;
      library.clearSelection();panLinkStatus = e?.message ?? String(e);panLinkError = true;
    }
  } else if (panLinkError) library.clearSelection();
  display();
  if (panLinkStatus) message(panLinkStatus,panLinkError);
  else if (added && !diagnostics.file && library.selected) {
    diagnostics.chooseFile(library.selected);renderDiagnostics();
  }
}).catch(error => {
  el['github-status'].textContent = 'GitHub pan/: 取得できません（ローカル再生は利用可能）';
  if (requestedPanId !== null || panLinkError) {
    linkedPanSelected=false;
    library.clearSelection();display();
    panLinkStatus = panLinkError ? panLinkStatus : `PAN「${requestedPanId}」のGitHub一覧を取得できません。`;
    panLinkError = true;message(panLinkStatus,true);
  }
});
const result=await loadEngine({
  readPan:(id,offset,length)=>library.readRange(id,offset,length),
  videoFrame:(width,height,rgba)=>{video.frame(width,height,rgba);},
  guestDiagnostic:(sample)=>sampleDiagnostics(sample),
  paletteEvidence:({status,color,offset,guestG0})=>{
    const target=byId('palette-evidence-status');
    if(target)target.textContent=`パレット0補正：${status}`+
      (color===null?'':` / 色 $${color.toString(16).padStart(4,'0').toUpperCase()}`)+
      (offset<0?'':` / PAN offset 0x${offset.toString(16)}`)+
      (guestG0===null?'':` / 実GPal[0]=$${guestG0.toString(16).padStart(4,'0')}`);
  },
  guestTiming:({ticks,scanout,frameWait,irqAcks,irqLatched,gpipReads,gpipLevel,guestPC,measuredMHz,targetMHz,clockStats,skippedScanouts})=>{
    const marker=el['vdisp-status'];
    if(marker)marker.textContent=`V-DISP ${ticks} / 表示開始 ${scanout} / IRQ ${irqAcks} / 保留 ${irqLatched===null?'不明':irqLatched} / PANIC待機 ${frameWait ?? '不明'} / GPIP読取 ${gpipReads} / bit4 ${gpipLevel} / CPU ${Number.isFinite(measuredMHz)?measuredMHz.toFixed(2):'?'} / ${targetMHz??16}MHz / 表示間引き ${skippedScanouts??0}回 / 遅延 ${Number.isFinite(clockStats?.lateMs)?clockStats.lateMs.toFixed(1):'?'}ms / PC 0x${(guestPC>>>0).toString(16)}`;
  },
  displayUpdate:({number,guestSteps,guestVblank,guestScanout,signature,r2})=>{
    deliveredDisplayUpdates=number;
    // Frame details remain available through the folded diagnostic panel.
  },
  firstVisibleFrame:({number,pixelMutations})=>{firstVisible=true;retainedFrame=true;display();},
  audioControl:(kind)=>{
    if(kind===0)audio.halt('default');
    else if(kind===1)void audio.pause();
    else if(kind===2)void audio.resume();
  },
  guestAudio:({kind,rate,bytes,chains,samples})=>{
    el['audio-status'].textContent=`ADPCM: ${kind} / ${rate} Hz / ${samples} 標本 / ${chains} 区間`;
  },
  audioTimelineStart:()=>audio.beginGuestTimeline(),
  audioFrames:(samples,rate,channels,device='ADPCM',guestSeconds=null)=>{
    const ok=audio.enqueue(samples,rate,channels,device==='FM'?'FM':'default',guestSeconds);
    el['audio-status'].textContent=ok
      ?`音声：${device} ${rate}Hz / ${samples.length/channels}標本をPCM出力に渡しました`
      :`音声：${device}は生成済み。ブラウザ音声が無効、または再生キューが満杯です。`;
    return ok;
  },
  finished:()=>{void finished();},
  error:(detail)=>{
    playing=false;
    diagnostics.finish('異常停止',detail);renderDiagnostics();byId('diagnostics').open=true;
    message(`PANICコア停止: ${detail}`,true);
    display();
  }
},{experimentalZmusic});
engine=result.engine;
el['overlay-title'].textContent=engine?(publicZmusic?'PANIC.X / Z-MUSIC 2.08 / YM2151':experimentalZmusic?'REAL Z-MUSIC 2.08 / YM2151 (LOCAL PREVIEW)':'EXPERIMENTAL CPU CORE'):'PLAYBACK CORE NOT CONNECTED';
el['overlay-description'].textContent=engine?(publicZmusic?'オリジナルPANIC.X、実Musashi 68000、Z-MUSIC 2.08、YM2151 FMとADPCMに対応します。':experimentalZmusic?'原版PANIC.X＋実Z-MUSIC常駐＋YM2151 FM/ADPCM。ローカル試聴専用です。':'実Musashi / 映像 / ADPCM音声の試験実装。実再生の完全互換性は未検証です。'):'ブラウザ側のPANファイラーは動作しますが、PANICの完全な再生コアは未完成です。';
message(panLinkStatus ?? (engine?'PANファイルを選択してください。':result.reason),panLinkError || !engine);
if(!engine){diagnostics.finish('異常停止',result.reason);renderDiagnostics();byId('diagnostics').open=true;}
display();
// GitHub listing and the Musashi engine load concurrently. Start a linked PAN
// only once BOTH are ready; no ?pan means no automatic playback or download.
void githubPanListing.then(()=>{
  if(linkedPanSelected && requestedPanId && !panLinkError && engine &&
     library.selected?.remote?.source === 'github' &&
     library.selected.name.toLowerCase() === (requestedPanId+'.pan').toLowerCase()) {
    void start({automatic:true,linkedAutoplay:true});
  }
});

// Local-only one-click launch. The explicit PAN remains on the user's disk;
// the 127.0.0.1 server reads it and never writes into the source directory.
// This imports an actual .PAN file; no frames are synthesized from screenshots.
if (new URLSearchParams(location.search).get('autoload')==='1') {
  try {
    const metaResponse=await fetch('/__local_pan_meta',{cache:'no-store'});
    if (!metaResponse.ok)throw new Error('ローカルPAN情報がありません');
    const metadata=await metaResponse.json();
    const fileResponse=await fetch('/__local_pan',{cache:'no-store'});
    if (!fileResponse.ok)throw new Error('ローカルPANデータがありません');
    const actualFile=new File([await fileResponse.blob()],metadata.name,{type:'application/octet-stream'});
    if (actualFile.size!==metadata.size)throw new Error('PANサイズが一致しません');
    const importResult=library.add([actualFile]);
    if (importResult.accepted!==1)throw new Error('PANファイルの読込に失敗');
    const localEntry=library.entries.find(x=>!x.remote && x.name===actualFile.name && x.size===actualFile.size);
    if(!localEntry)throw new Error('ローカルPANの選択に失敗');
    library.select(localEntry.id);
    display();
    if (!engine) throw new Error(result.reason || '実Musashi未接続');
    message(`選択済み：${actualFile.name}。PLAYを押すと映像と音声を再生します。`);
  } catch (e) {
    diagnostics.finish('異常停止',`自動読込: ${e?.message??e}`);renderDiagnostics();byId('diagnostics').open=true;
    message(`自動再生を開始できませんでした: ${e?.message??e}`,true);
  }
}
