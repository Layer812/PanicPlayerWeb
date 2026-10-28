// GitHub Pages PAN selector: URL parameter is an ID, not a fetch URL.
const ID = /^[A-Za-z0-9]{1,64}$/;
export function parsePanId(search) {
  const query = new URLSearchParams(search);
  if (!query.has('pan')) return null;
  const values=query.getAll('pan');
  if(values.length!==1 || !ID.test(values[0]))
    throw new Error('PAN指定は英数字1～64文字だけです（例: ?pan=DENKO1）。');
  return values[0];
}
export function resolveGithubPanId(list,id) {
  if(!ID.test(id))throw new Error('PANの指定名が不正です。');
  if(!Array.isArray(list))throw new TypeError('GitHub PAN一覧が不正です');
  const want=(id+'.pan').toLowerCase();
  const matches=list.filter(x=>x?.source==='github'&&typeof x.name==='string'&&
    x.name.toLowerCase()===want && /^[A-Za-z0-9]{1,64}\.pan$/i.test(x.name));
  if(!matches.length)throw new Error(`指定されたPAN「${id}」はGitHub pan/にありません。`);
  if(matches.length!==1)throw new Error('大文字・小文字の異なる同名PANがあり、選択できません。');
  return matches[0];
}
