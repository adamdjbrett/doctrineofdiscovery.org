import {createHash} from 'node:crypto';
const endpoint='https://api.indexnow.org/indexnow';

export function validateManifest(manifest) {
  if (!/^[a-zA-Z0-9-]{8,128}$/.test(manifest.key || '')) throw new Error('Invalid IndexNow verification key.');
  const location=new URL(manifest.keyLocation);
  if (location.protocol!=='https:' || location.username || location.password || location.host!==manifest.host || location.pathname!==`/${manifest.key}.txt` || location.search || location.hash) throw new Error('Invalid IndexNow key location.');
  if (!Array.isArray(manifest.records)) throw new Error('Invalid IndexNow records.');
  for (const record of manifest.records) {
    const url=new URL(record.url);
    if (url.protocol!=='https:' || url.host!==manifest.host || url.username || url.password || url.hash || !/^[a-f0-9]{64}$/.test(record.hash)) throw new Error('Invalid IndexNow record.');
  }
  return manifest;
}

export function withKey(manifest,key) {
  if (createHash('sha256').update(key).digest('hex')!==manifest.keyVersion) throw new Error('IndexNow key does not match this build.');
  return validateManifest({...manifest,key,keyLocation:`https://${manifest.host}/${key}.txt`});
}

export function changedUrls(current,previous) {
  validateManifest(current);
  if (!previous) return current.records.map(record=>record.url);
  validateManifest({...previous,key:current.key,keyLocation:current.keyLocation});
  if (previous.host!==current.host) throw new Error('IndexNow host changed.');
  if (previous.keyVersion!==current.keyVersion) return [...new Set([...current.records,...previous.records].map(record=>record.url))];
  const old=new Map(previous.records.map(record=>[record.url,record.hash]));
  const present=new Set(current.records.map(record=>record.url));
  return [...new Set([...current.records.filter(record=>old.get(record.url)!==record.hash).map(record=>record.url),
    ...previous.records.filter(record=>!present.has(record.url)).map(record=>record.url)])];
}

export async function submitIndexNow(manifest,urls,{fetcher=fetch}={}) {
  validateManifest(manifest);
  urls=[...new Set(urls)];
  for (const value of urls) {
    const url=new URL(value);
    if (url.protocol!=='https:' || url.host!==manifest.host || url.username || url.password || url.hash) throw new Error('Refusing an off-site IndexNow URL.');
  }
  if (!urls.length) return 0;
  const keyResponse=await fetcher(manifest.keyLocation,{redirect:'error',signal:AbortSignal.timeout(15000)});
  if (!keyResponse.ok || (await keyResponse.text()).trim()!==manifest.key) throw new Error('The deployed IndexNow verification file is not ready.');
  for (let start=0;start<urls.length;start+=10000) {
    const response=await fetcher(endpoint,{method:'POST',redirect:'error',signal:AbortSignal.timeout(15000),
      headers:{'Content-Type':'application/json; charset=utf-8'},
      body:JSON.stringify({host:manifest.host,key:manifest.key,keyLocation:manifest.keyLocation,urlList:urls.slice(start,start+10000)})});
    if (![200,202].includes(response.status)) throw new Error(`IndexNow returned HTTP ${response.status}.`);
  }
  return urls.length;
}
