// Panic Player Web — Copyright (c) 2026 Layer812
// SPDX-License-Identifier: MIT (original Layer812-owned code only)
// Third-party components and .PAN media retain separate notices.
/* FIX38: Only public .PAN files in Layer812/PanicPlayerWeb/pan are discoverable.
 * No arbitrary URLs, share links, cookies, or upload.
 * Listings are metadata-only; downloads happen on PLAY or a valid ?pan=ID link. */
const OWNER = 'Layer812';
const REPOSITORY = 'PanicPlayerWeb';
const BRANCH = 'main';
const DIRECTORY = 'pan';
const API_URL = `https://api.github.com/repos/${OWNER}/${REPOSITORY}/contents/${DIRECTORY}?ref=${BRANCH}`;
const RAW_ORIGIN = `https://raw.githubusercontent.com/${OWNER}/${REPOSITORY}/${BRANCH}/${DIRECTORY}/`;
export const MAX_GITHUB_PAN_BYTES = 24 * 1024 * 1024;
const MAX_ENTRIES = 200;

function validName(name) {
  return typeof name === 'string' && name.length > 4 && name.length <= 255 &&
    !/[\\/\u0000-\u001f\u007f]/.test(name) && !/^\./.test(name) && /\.pan$/i.test(name);
}
export function trustedGithubUrl(name) {
  if (!validName(name)) throw new Error('許可されていないPANファイル名です');
  return RAW_ORIGIN + encodeURIComponent(name);
}
export function parseGithubListing(json) {
  if (!Array.isArray(json)) throw new Error('GitHubのpan/がフォルダではありません');
  if (json.length > 1000) throw new Error('GitHubのpan/に多数の項目があり安全に一覧化できません');
  return json.filter(item => item?.type === 'file' && validName(item.name) &&
    item.path === `pan/${item.name}` && Number.isSafeInteger(item.size) &&
    item.size >= 16 && item.size <= MAX_GITHUB_PAN_BYTES &&
    /^[0-9a-f]{40}$/.test(item.sha ?? '')
  ).slice(0, MAX_ENTRIES).map(item => ({
    source:'github', name:item.name, size:item.size, sha:item.sha
  }));
}
export async function discoverGithubPans(fetcher = fetch) {
  // A fixed GitHub API URL is the only metadata request. A missing repository
  // or folder is ordinary; the local library remains functional.
  const response = await fetcher(API_URL, {credentials:'omit', mode:'cors', cache:'no-store', redirect:'error'});
  if (response.status === 404) return [];
  if (!response.ok) throw new Error(`GitHub一覧取得: HTTP ${response.status}`);
  return parseGithubListing(await response.json());
}

function toHex(bytes) {return [...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,'0')).join('');}
async function checkGitBlobSha1(data, expected) {
  // Pin the selected listing entry against a race or a modified source file.
  if (!globalThis.crypto?.subtle?.digest) throw new Error('SHA照合に必要な安全なブラウザ環境ではありません');
  const prefix = new TextEncoder().encode(`blob ${data.length}\0`);
  const packed = new Uint8Array(prefix.length + data.length);
  packed.set(prefix); packed.set(data, prefix.length);
  const actual = toHex(await globalThis.crypto.subtle.digest('SHA-1',packed));
  if (actual !== expected) throw new Error('PANファイルが一覧取得後に更新されました。再読み込みしてください');
}
export async function downloadGithubPan(metadata, fetcher = fetch) {
  if (metadata?.source !== 'github' || !validName(metadata.name) ||
      !Number.isSafeInteger(metadata.size) || metadata.size < 16 ||
      metadata.size > MAX_GITHUB_PAN_BYTES || !/^[0-9a-f]{40}$/.test(metadata.sha ?? '')) {
    throw new Error('GitHub PANのメタデータが不正です');
  }
  // Intentionally ignore any URL supplied by the API or the caller.
  const response = await fetcher(trustedGithubUrl(metadata.name), {
    credentials:'omit',mode:'cors',cache:'no-store',redirect:'error'
  });
  if (!response.ok) throw new Error(`GitHub PAN取得: HTTP ${response.status}`);
  const declared = response.headers?.get?.('content-length');
  if (declared !== null && declared !== undefined && Number(declared) > MAX_GITHUB_PAN_BYTES) {
    throw new Error('PANファイルが上限24MiBを超えています');
  }
  const chunks=[];let size=0;
  if (!response.body?.getReader) throw new Error('安全なサイズ制限付きストリームを利用できません');
  const reader=response.body.getReader();
  try {
    while (true) {
      const {value,done}=await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_GITHUB_PAN_BYTES || size > metadata.size) {
        await reader.cancel();throw new Error('PANファイルが事前に確認したサイズを超えています');
      }
      chunks.push(value);
    }
  } finally {try {reader.releaseLock();} catch {/* already closed */}}
  if (size !== metadata.size) throw new Error('PANのサイズがGitHub一覧と一致しません');
  const bytes=new Uint8Array(size);let offset=0;
  for (const chunk of chunks) {bytes.set(chunk,offset);offset+=chunk.byteLength;}
  if (bytes[0]!==0x50||bytes[1]!==0x41||bytes[2]!==0x4e||
      bytes[3]!==0x49||bytes[4]!==0x43||bytes[5]!==0x1a) {
    throw new Error('PANIC形式のファイルではありません');
  }
  await checkGitBlobSha1(bytes, metadata.sha);
  return new File([bytes],metadata.name,{type:'application/octet-stream'});
}
