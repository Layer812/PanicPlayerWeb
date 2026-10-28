// A URL-linked PAN can start video when the browser blocks sound. Because
// audioFrames was rejected while suspended, the original PCM timeline is gone.
// Restart the original guest (not a synthetic PCM loop) after user activation.
export async function recoverLinkedAudio({unlock,isRunning,stopKeepingAudio,restart}) {
  if([unlock,isRunning,stopKeepingAudio,restart].some(fn=>typeof fn!=='function'))
    throw new TypeError('Missing URL audio recovery callback');
  await unlock(); // called SYNCHRONOUSLY from the pointer handler
  if(!isRunning())throw new Error('ブラウザが音声再生を許可しませんでした');
  await stopKeepingAudio(); // keep the unlocked AudioContext
  await restart(); // re-run from the beginning with audio already active
}
