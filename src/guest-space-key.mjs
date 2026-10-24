// Panic Player Web — Copyright (c) 2026 Layer812
// SPDX-License-Identifier: MIT (original Layer812-owned code only)
/* During actual playback, SPACE is a guest key, not focused-button activation.
 * Keep text-entry and browser keyboard shortcuts independent. */
export function isGuestSpaceKey(event) {
  return (event.code==='Space'||event.key===' ') &&
    !event.ctrlKey && !event.altKey && !event.metaKey && !event.isComposing;
}
export function shouldIgnoreGuestSpaceTarget(target) {
  const tag=target?.tagName;
  if(tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT')return true;
  if(target?.isContentEditable)return true;
  return Boolean(target?.closest?.('[contenteditable="true"],[contenteditable=""]'));
}
