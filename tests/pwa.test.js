import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

test('offline support keeps online pages fresh and leaves APIs and downloads alone', async () => {
  const listeners=new Map();
  const offline=new Response('Offline notice');
  let installed,claimed=false,online=true;
  vm.runInNewContext(fs.readFileSync('sw.js','utf8'),{
    URL,
    self:{location:{origin:'https://example.org'},clients:{claim:async()=>{claimed=true;}},
      addEventListener:(name,handler)=>listeners.set(name,handler)},
    caches:{open:async()=>({add:async url=>{installed=url;}}),match:async url=>url===installed?offline:undefined},
    fetch:async()=>{if(!online)throw new Error('Offline');return new Response('Fresh page');}
  });
  for(const name of ['install','activate']) {
    let pending;listeners.get(name)({waitUntil:promise=>{pending=promise;}});await pending;
  }
  assert.equal(installed,'/offline.html');assert.equal(claimed,true);
  function request(path,options={}) {
    let response;
    listeners.get('fetch')({request:{url:'https://example.org'+path,method:'GET',mode:'navigate',...options},
      respondWith:promise=>{response=promise;}});
    return response;
  }
  assert.equal(await (await request('/blog/article/')).text(),'Fresh page');
  online=false;
  for(const path of ['/','/authors/robert-miller','/about.html']) assert.equal(await request(path),offline);
  for(const path of ['/oai?verb=Identify','/admin/','/.netlify/functions/oai','/assets/paper.pdf','/feed.xml','/metadata.json']) assert.equal(request(path),undefined,path);
  assert.equal(request('/contact/',{method:'POST'}),undefined);
  assert.equal(request('/search/',{mode:'cors'}),undefined);
  assert.equal(request('/',{url:'https://external.org/'}),undefined);
});

test('installable manifest has a stable root identity and usable local icons', () => {
  const manifest=JSON.parse(fs.readFileSync('assets/images/favicons/site.webmanifest','utf8'));
  for(const key of ['id','start_url','scope']) assert.equal(manifest[key],'/');
  assert.equal(manifest.display,'standalone');
  for(const size of ['192x192','512x512']) {
    const icon=manifest.icons.find(icon=>icon.sizes===size);
    assert.ok(icon.purpose.split(' ').includes('any'));
    assert.ok(fs.existsSync(icon.src.split('?')[0].slice(1)));
  }
});
