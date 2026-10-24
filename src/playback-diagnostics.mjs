// Panic Player Web — Copyright (c) 2026 Layer812
// SPDX-License-Identifier: MIT (original Layer812-owned code only)
// Third-party components and .PAN media retain separate notices.
/** FIX25: bounded, read-only diagnostics for the actual guest runtime.
 * A hypothesis must never be displayed as a proven PAN encoding error.
 */
const H = value => value == null ? '未取得' : `0x${(value>>>0).toString(16).toUpperCase().padStart(8,'0')}`;
const V = value => value == null ? '未取得' : String(value);
export const diagnosticHex = H;
const finite = v => typeof v === 'number' && Number.isFinite(v);
const tstamp = ms => `${(ms/1000).toFixed(1)}s`;
export class PlaybackDiagnostics {
  constructor({now=()=>Date.now()}={}){this.now=now;this.reset();}
  reset(){
    this.file=null;this.phase='準備中';this.error=null;this.latest={};this.first=null;
    this.startedMs=null;this.updatedMs=null;this.lastChangeMs=null;
    this.events=[];this.lastTracePC=null;this.samePCSamples=0;
    this.lastCounts={};this.verifiedFile=null;this.lastSnapshot=null;
  }
  log(message,now=this.now()){
    const elapsed=this.startedMs==null?0:Math.max(0,now-this.startedMs);
    this.events.push({atMs:Math.round(elapsed),message:String(message)});
    if(this.events.length>60)this.events.shift();
  }
  chooseFile(item){
    this.reset();this.file={name:item.name,path:item.path||item.name,size:item.size};
    this.log(`選択: ${this.file.path} (${this.file.size} bytes)`);
  }
  fileEvidence(evidence){
    this.verifiedFile={...evidence};
    if(evidence.error)this.log('ファイル検証を完了できません: '+evidence.error);
    else this.log(`ファイル指紋: SHA-256 ${evidence.sha256??'未算出'}`);
  }
  begin(){this.phase='実行中';this.startedMs=this.now();this.updatedMs=this.startedMs;this.lastChangeMs=this.startedMs;this.events=[];this.error=null;this.latest={};this.first=null;this.lastTracePC=null;this.samePCSamples=0;this.lastCounts={};this.log('実68000の実行開始');}
  sample(s={}){
    const now=this.now(), prior=this.latest;
    this.latest={...s}; this.updatedMs=now;
    if(!this.first)this.first={...s};
    if(finite(s.pc) && s.pc===this.lastTracePC){this.samePCSamples++;}
    else {this.samePCSamples=0;this.lastTracePC=s.pc;}
    const watch=[['panReadCalls','DOS _READ'],['panBytes','PAN読込バイト'],['irqAcks','IRQ受理'],['vdisp','V-DISP'],['outputSamples','表示変化'],['writeCount','GVRAM書込'],['crtcChanges','CRTC変更'],['adpcmControlCalls','ADPCM制御'],['adpcmChainCalls','ADPCM出力']];
    for(const [key,label] of watch){
      const before=prior[key],after=s[key];
      if(finite(after) && finite(before) && after!==before){
        if(key==='outputSamples'||key==='panReadCalls'||(key==='irqAcks'&&before===0))this.log(`${label}: ${before} → ${after}`,now);
      }
    }
    // A nonchanging screen is not automatically a corrupted PAN file.
    if(finite(s.outputSamples) && s.outputSamples!==prior.outputSamples)this.lastChangeMs=now;
    if(s.phase==='exit')this.finish('終了',s.detail);
    if(s.phase==='exception'||s.phase==='cpu-stop')this.finish('異常停止',s.detail);
  }
  finish(phase,detail=''){
    this.phase=phase;
    this.error=phase==='異常停止'?String(detail||'不明な例外'):null;
    this.log(`${phase}: ${detail||'理由未取得'}`);
  }
  evaluate(){
    const s=this.latest||{};
    const elapsed=this.startedMs==null?0:Math.max(0,this.now()-this.startedMs);
    const silentFor=this.lastChangeMs==null?0:Math.max(0,this.now()-this.lastChangeMs);
    const facts=[],hypotheses=[];
    let code='WAITING',heading='再生前です。ファイルとCPU状態を待っています。',severity='neutral';
    if(this.file)facts.push(`対象: ${this.file.path} / ${this.file.size.toLocaleString('ja-JP')} bytes`);
    if(this.verifiedFile){
      if(this.verifiedFile.sha256)facts.push(`ファイル SHA-256: ${this.verifiedFile.sha256}${this.verifiedFile.scope==='prefix'?'（先頭部分のみ）':''}`);
      if(this.verifiedFile.prefixHex)facts.push(`先頭16バイト: ${this.verifiedFile.prefixHex}`);
      if(this.verifiedFile.header)facts.push(`PANヘッダ: ${this.verifiedFile.header.summary}`);
      if(this.verifiedFile.error)facts.push(`指紋取得の失敗: ${this.verifiedFile.error}`);
    }
    if(this.startedMs!==null){
      facts.push(`経過実時間: ${tstamp(elapsed)} / 画面が変わらない期間: ${tstamp(silentFor)}`);
      facts.push(`CPU: ${V(s.steps)} 命令、PC=${H(s.pc)}、SR=${H(s.sr)}、状態=${V(s.state)}`);
      facts.push(`ゲストPAN: OPEN ${V(s.panOpenCalls)}回 / READ ${V(s.panReadCalls)}回 / 転送 ${V(s.panBytes)} bytes`);
      facts.push(`DOS/IOCS最終呼出: ${H(s.lastDosOp)} at PC=${H(s.lastDosPC)} / 戻り値 ${V(s.lastDosReturn)}`);
      facts.push(`PANファイルI/Oエラー: ${V(s.panErrorCount)}回 / 最後 ${H(s.panErrorOp)} 戻り値 ${V(s.panErrorCode)}`);
      facts.push(`画面: 異なる表示画像 ${V(s.outputSamples)}枚 / GVRAM書込 ${V(s.writeCount)}回 / 画素変更 ${V(s.pixelWrites)}回`);
      facts.push(`割込み: V-DISP ${V(s.vdisp)}回 / IRQ受理 ${V(s.irqAcks)}回 / 保留 ${V(s.irqPending)} / SCAN ${V(s.scanout)}`);
      facts.push(`MFP/CRTC: GPIP読込 ${V(s.gpipReads)}回 / R1=${H(s.r1)} / R2=${H(s.r2)} / CRTモード=${V(s.mode)}`);
      facts.push(`パレット実レジスタ: G[0]=${H(s.paletteG0)} / G[1]=${H(s.paletteG1)} / G[255]=${H(s.paletteG255)} / TEXT[0]=${H(s.paletteT0)}`);
      if(finite(s.cynthiaEnabled))facts.push(`スプライト/BG: SON ${s.cynthiaEnabled?'ON':'OFF'} / CYNTHIA DISP ${finite(s.cynthiaDisp)?(s.cynthiaDisp?'ON':'OFF'):'未取得'} / IOCS SP_ON ${V(s.spOnCalls)}回 / 有効 ${V(s.cynthiaActiveSprites)}体・属性設定 ${V(s.cynthiaRawSprites)}体 / 属性書込 ${V(s.cynthiaAttrWrites)}・PCG/BG書込 ${V(s.cynthiaPcgWrites)}・SPパレット書込 ${V(s.cynthiaPaletteWrites)}（累計バイト）`);
      if(finite(s.frameGfxNonzero)){
        const pri=finite(s.r1)?[(s.r1>>>8)&3,(s.r1>>>10)&3,(s.r1>>>12)&3]:['?','?','?'];
        facts.push(`画面レイヤー: R1優先 G/T/B=${pri.join('/')} / G実画素 ${V(s.frameGfxNonzero)}・TEXT実画素 ${V(s.frameTextNonzero)}・重複 ${V(s.frameGfxTextOverlap)} / G表示寄与 ${V(s.frameGfxVisible)}・TEXT表示寄与 ${V(s.frameTextVisible)} / Gパレット値0の画素 ${V(s.frameGfxPaletteZero)}（最終レンダリング画面）`);
      }
      if(finite(s.adpcmControlCalls)||finite(s.adpcmChainCalls))
        facts.push(`ADPCM: 制御 ${V(s.adpcmControlCalls)}回 / チェーン出力 ${V(s.adpcmChainCalls)}回（PCM実出力は音声状態欄で確認）`);
      if(finite(s.conctrlCalls))
        facts.push(`Human68k _CONCTRL: ${V(s.conctrlCalls)}回 / 現在のコンソール画面モード ${V(s.conctrlMode)}（終了時の画面復元を検証）`);
      facts.push(`ゲスト時間 ${finite(s.clockStats?.virtualMs)?s.clockStats.virtualMs.toFixed(1)+'ms':'未取得'} / CPU実測 ${finite(s.measuredMHz)?s.measuredMHz.toFixed(2)+'MHz':'未取得'}（目標16MHz）`);
      if(finite(s.clockStats?.realWallMs))
        facts.push(`CPU時計: 実経過 ${s.clockStats.realWallMs.toFixed(1)}ms / 現在の遅れ ${finite(s.clockStats.lateMs)?s.clockStats.lateMs.toFixed(1)+'ms':'未取得'} / 最大遅れ ${finite(s.clockStats.peakLateMs)?s.clockStats.peakLateMs.toFixed(1)+'ms':'未取得'} / タイマー待機 ${V(s.clockStats.sleepCalls)}回 / 再同期 ${V(s.clockStats.resyncs)}回`);
      if(finite(s.runtimeProfile?.cpuMs))
        facts.push(`実行時間内訳: Musashi ${s.runtimeProfile.cpuMs.toFixed(1)}ms / CPU時計の待機 ${s.runtimeProfile.pacerMs.toFixed(1)}ms / 描画の待機 ${s.runtimeProfile.paintYieldMs.toFixed(1)}ms / 実行スライス ${V(s.runtimeProfile.slices)}回 / 表示間引き ${V(s.runtimeProfile.skippedScanouts)}回`);
    }
    if(this.phase==='準備中')return {code,heading,severity,facts,hypotheses,elapsed,silentFor};
    if(this.phase==='異常停止'){
      code=/Unsupported DOS\/IOCS/i.test(this.error??'')?'UNSUPPORTED_GUEST_CALL':/PAN read|file request|PAN file offset/i.test(this.error??'')?'PAN_IO_ERROR':/68000 stopped|CPU status/i.test(this.error??'')?'CPU_STOP':'RUNTIME_EXCEPTION';
      heading=`【確定: 実行停止】${this.error??'詳細なし'}`; severity='error';
      hypotheses.push('表示が終わった理由はエラーです。上記メッセージと最後のPC・レジスタを確認してください。');
    } else if(this.phase==='終了'){
      code='GUEST_EXIT'; severity='warning';
      heading=`【確定: ゲスト終了】PANIC.Xが終了しました。終了コード: ${V(s.exitCode)}。`;
      hypotheses.push('正常終了か、ファイル内容への反応による早期終了かは、この事実だけでは区別できません。PANのOPEN/READ量と画面変化を照合してください。');
    } else if(this.phase==='手動停止'){
      code='USER_STOP'; heading='手動停止しました。直前のゲスト状態を保持しています。';
    } else if(finite(s.panErrorCount)&&s.panErrorCount>0) {
      code='PAN_GUEST_IO_ERROR';severity='warning';
      heading=`【観測: PANファイルI/Oエラー】DOS ${H(s.panErrorOp)} が ${V(s.panErrorCode)} を返しました（${s.panErrorCount}回）。`;
      hypotheses.push('OPEN/READ/SEEKの引数または仮想ファイル互換処理を確認してください。これはPANの画像コマンド不正を意味しません。');
    } else if(elapsed<2500){
      code='STARTING';heading='実68000を実行中。まだ再生不良の判定に必要な経過時間がありません。';
    } else if(finite(s.vdisp)&&s.vdisp>30 && finite(s.irqAcks)&&s.irqAcks===0){
      code='VDISP_WITHOUT_IRQ_ACK';severity='warning';
      heading='【観測: V-DISPは発生、IRQ受理は0回】ゲストが割込みを使っているか未確定です。';
      hypotheses.push('ゲストが割込みを許可・登録しているか、SR割込みマスク、MFP IERB/IMRB、ベクタ$46を確認してください。');
    } else if(finite(s.panReadCalls)&&s.panReadCalls===0 && elapsed>4000){
      code='NO_PAN_READ';severity='warning';heading='【観測: ゲストPAN読み込みなし】起動・OPEN・ファイル認識経路を確認する必要があります。';
      hypotheses.push('PANの先頭バイトだけでは形式不正と断定できません。DOS _OPEN/_FILES、パスとCPU停止PCを調べてください。');
    } else if(finite(s.outputSamples)&&s.outputSamples<=1 && silentFor>3500){
      code='DISPLAY_STATIC';severity='warning';
      heading=`【観測: 表示変化が停止】異なる表示画像 ${s.outputSamples}枚、${tstamp(silentFor)}変化なし。`;
      if(finite(s.steps)&&s.steps>0 && this.samePCSamples>=3){
        hypotheses.push(`CPUは実行されているものの、サンプルPCが${this.samePCSamples+1}回同一。待機ループの可能性（単なる定点サンプリングとも区別必要）。`);
      }
      if(finite(s.irqAcks)&&s.irqAcks===0)hypotheses.push('IRQが受理されていない可能性があります。V-DISP回数と合わせて判断してください。');
      if(finite(s.writeCount)&&s.writeCount>0)hypotheses.push('GVRAMへ書かれているのに表示が変わらない場合、ページ選択・CRTC・透明色・VBlank時のサンプル位置を調べてください。');
      else hypotheses.push('GVRAMへの継続的な書込みが観測できません。PANIC内部の待機・デコード進行を調べてください。');
    } else if(finite(s.outputSamples)&&s.outputSamples>1){
      code='MULTIPLE_OUTPUTS';heading=`【観測: 複数表示】異なる表示画像 ${s.outputSamples}枚を取得しました。動画の正しさ・速度は別途未検証です。`;
    } else {code='RUNNING';heading='実68000は実行中。現在は決定的な停止理由を特定できていません。';}
    if(!hypotheses.length && this.phase==='実行中')hypotheses.push('異常が確定していません。画面が動かない場合は数秒後の値と比較してください。');
    return {code,heading,severity,facts,hypotheses,elapsed,silentFor};
  }
  report(){const e=this.evaluate();return {format:'PWP-FIX25-DIAGNOSTIC-v1',generatedAt:new Date().toISOString(),
    interpretation:'観測情報は実CPUのサンプル値であり、推定原因は確定診断ではありません。',
    file:this.file,fileEvidence:this.verifiedFile,phase:this.phase,code:e.code,
    summary:e.heading,facts:e.facts,hypotheses:e.hypotheses,lastGuestSample:this.latest,
    events:[...this.events]};}
}
