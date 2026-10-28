// Panic Player Web — Copyright (c) 2026 Layer812
// SPDX-License-Identifier: MIT (original Layer812-owned code only)
// Third-party components and .PAN media retain separate notices.
/* No PAN bytes are copied during library import: File references only. */
const natural = new Intl.Collator('ja', {numeric: true, sensitivity: 'base'});
export const MAX_READ_LENGTH = 2 * 1024 * 1024;

export function isPanName(name) {
  return typeof name === 'string' && /\.pan$/i.test(name) && name.length > 4;
}

function pathOf(file) {
  // webkitRelativePath is supplied by directory picker. Never use it as a filesystem path.
  const path = file.webkitRelativePath || file.name;
  return path.replaceAll('\\', '/').replace(/^\/+/, '');
}

export class PanLibrary {
  #items = [];
  #current = null;
  #serial = 0;
  #signatures = new Set();
  #pending = new Map();

  get size() { return this.#items.length; }
  get selectedId() { return this.#current; }
  get selected() { return this.#items.find(x => x.id === this.#current) ?? null; }
  get entries() { return this.#items.map(({file, ...meta}) => ({...meta})); }

  add(files) {
    let accepted = 0, skipped = 0, duplicates = 0;
    for (const file of Array.from(files ?? [])) {
      if (!file || !isPanName(file.name) || !Number.isSafeInteger(file.size) || file.size <= 0) {
        skipped++; continue;
      }
      const path = pathOf(file);
      const signature = JSON.stringify([path, file.size, file.lastModified ?? null]);
      if (this.#signatures.has(signature)) { duplicates++; continue; }
      const id = ++this.#serial;
      this.#items.push({id, name:file.name, path, size:file.size, signature, file});
      this.#signatures.add(signature);
      accepted++;
      if (this.#current === null) this.#current = id;
    }
    this.#items.sort((a,b) => natural.compare(a.path,b.path) || a.id-b.id);
    return {accepted, skipped, duplicates, total:this.#items.length};
  }

  addGithubPans(descriptors) {
    let accepted = 0;
    for (const source of descriptors ?? []) {
      if (source?.source !== 'github' || !isPanName(source.name) ||
          !Number.isSafeInteger(source.size) || source.size < 16 ||
          !/^[0-9a-f]{40}$/.test(source.sha ?? '')) continue;
      const path = `GitHub/pan/${source.name}`;
      const signature = JSON.stringify(['github', source.name, source.size, source.sha]);
      if (this.#signatures.has(signature)) continue;
      const id = ++this.#serial;
      this.#items.push({id,name:source.name,path,size:source.size,
        signature,file:null,remote:Object.freeze({...source})});
      this.#signatures.add(signature);
      accepted++;
      if (this.#current === null) this.#current = id;
    }
    this.#items.sort((a,b)=>natural.compare(a.path,b.path)||a.id-b.id);
    return accepted;
  }

  async prepare(id, loader) {
    const item = this.#items.find(x=>x.id===id);
    if (!item) throw new Error('PAN not present in library');
    if (item.file) return item;
    if (!item.remote || typeof loader !== 'function') throw new Error('GitHub PANを読み込めません');
    if (this.#pending.has(id)) return this.#pending.get(id);
    const promise = (async()=>{
      const file = await loader(item.remote);
      if (!file || file.size !== item.size || file.name !== item.name) {
        throw new Error('取得したGitHub PANのサイズまたは名前が一致しません');
      }
      if (!this.#items.includes(item)) throw new Error('PAN一覧が更新されました');
      item.file=file;
      return item;
    })();
    this.#pending.set(id,promise);
    try {return await promise;}
    finally {this.#pending.delete(id);}
  }

  clearSelection() { this.#current = null; }

  select(id) {
    if (!this.#items.some(x => x.id === id)) return false;
    this.#current = id;
    return true;
  }

  move(delta) {
    if (!this.#items.length) return null;
    const pos = this.#items.findIndex(x => x.id === this.#current);
    const target = Math.min(this.#items.length-1, Math.max(0, (pos < 0 ? 0 : pos)+delta));
    this.#current = this.#items[target].id;
    return this.selected;
  }

  // Playback navigation wraps around the imported folder/list. Ordinary
  // keyboard selection may still use move(), which clamps at its ends.
  moveWrap(delta) {
    if (!this.#items.length) return null;
    const pos = Math.max(0, this.#items.findIndex(x => x.id === this.#current));
    this.#current = this.#items[((pos + delta) % this.#items.length + this.#items.length) % this.#items.length].id;
    return this.selected;
  }

  clear() { this.#items = []; this.#current = null; this.#signatures.clear(); this.#pending.clear(); }

  async readRange(id, offset, length) {
    if (!Number.isSafeInteger(offset) || offset < 0 ||
        !Number.isSafeInteger(length) || length < 0 || length > MAX_READ_LENGTH) {
      throw new RangeError('Invalid PAN read offset or length');
    }
    const entry = this.#items.find(x => x.id === id);
    if (!entry) throw new Error('PAN not present in library');
    if (!entry.file) throw new Error('GitHub PANをPLAYから読み込んでください');
    if (offset > entry.size) return new Uint8Array(0);
    // No full-file copy: designed for future host-I/O callback from WASM.
    const end = Math.min(entry.size, offset + length);
    return new Uint8Array(await entry.file.slice(offset, end).arrayBuffer());
  }
}
