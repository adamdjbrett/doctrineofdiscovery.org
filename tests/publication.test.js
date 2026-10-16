import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import yaml from 'js-yaml';
import {createRequire} from 'node:module';
import {authorsFor,metadataHead,entryProperties,dublinCoreXml,siteGraph,safeJson,publicDocument} from '../lib/publication.js';
import {oaiResponse,handleOai} from '../lib/oai.js';
import {changedUrls,submitIndexNow,validateManifest,withKey} from '../lib/indexnow.js';

const site={url:'https://example.org',title:'Example & Blog',locale:'en-US',email:'editor@example.org',logo:'/logo.png',teaser:'/image.jpg',rights:'https://creativecommons.org/licenses/by/4.0/',
  author:{name:'Editorial Group'},data:{organization:{}},authors:[{username:'person',slug:'person',name:'Jane & Doe',url:'/authors/person',avatar:'/person.png'},
    {username:'group',slug:'group',name:'Editorial Group',url:'/authors/group',schema_type:'Organization'}]};
site.base_graph=siteGraph(site);
const post={url:'/article/',collection:'posts',title:'A & B',description:'An article.',authors:['person','group'],date:'2026-07-15T12:00:00',last_modified_at:'2026-07-16T12:00:00',tags:['A & B'],categories:['History'],pdf:'/paper.pdf',doi:'10.123/test'};
const dc=dublinCoreXml(site,post);
const catalog={name:site.title,email:site.email,baseURL:site.url+'/oai',records:[{identifier:'oai:example.org:one',datestamp:'2026-07-16',xml:dc}]};
const query=value=>new URLSearchParams(value);
const xmlCheck=value=>execFileSync('python3',['-c','import sys,xml.etree.ElementTree as E; E.fromstring(sys.stdin.read())'],{input:value,stdio:['pipe','pipe','pipe']});

test('citation, DC, schema and microformats resolve people, organizations and multiple authors consistently',()=>{
  assert.deepEqual(authorsFor(site,post).map(a=>[a.name,a['@type']]),[['Jane & Doe','Person'],['Editorial Group','Organization']]);
  const head=metadataHead(site,post);
  assert.equal((head.match(/name="citation_author"/g)||[]).length,2);
  assert.match(head,/name="citation_title" content="A &amp; B"/);
  assert.match(head,/name="citation_pdf_url" content="https:\/\/example.org\/paper.pdf"/);
  assert.match(head,/name="DCTERMS.modified" content="2026-07-16T12:00:00.000-04:00"/);
  const graph=JSON.parse(head.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  assert.equal(graph['@graph'].filter(n=>n['@type']==='Organization').length,1);
  assert.equal(graph['@graph'].find(n=>n['@type']==='BlogPosting').author.length,2);
  const properties=entryProperties(site,post);
  assert.equal((properties.match(/p-author h-card/g)||[]).length,2);
  assert.match(properties,/dt-published/);assert.match(properties,/dt-updated/);
  assert.match(properties,/hidden/);xmlCheck(dc);
  assert.equal((dc.match(/<dc:creator>/g)||[]).length,2);
  assert.equal(publicDocument({...post,hidden:true}),true,'Theme hidden only omits a document from archive listings');
  assert.equal(publicDocument({...post,published:false}),false);
  const noindex=metadataHead(site,{...post,robots_meta:'noindex,follow'});
  assert.ok(!noindex.includes('citation_title'));
  assert.throws(()=>metadataHead(site,{...post,canonical_url:'javascript:alert(1)'}));
  assert.ok(!safeJson({title:'</script><script>alert(1)</script>'}).includes('<'));
});

test('OAI supports all six verbs and emits well-formed XML',()=>{
  for(const [verb,args] of [['Identify',''],['ListMetadataFormats',''],['ListSets',''],['GetRecord','&identifier=oai:example.org:one&metadataPrefix=oai_dc'],['ListIdentifiers','&metadataPrefix=oai_dc'],['ListRecords','&metadataPrefix=oai_dc&from=2026-07-16&until=2026-07-16&set=blog']]){
    const xml=oaiResponse(catalog,query('verb='+verb+args),new Date('2026-07-17T00:00:00Z'));
    assert.match(xml,new RegExp('<'+verb+'>'));assert.ok(!xml.includes('<error'));xmlCheck(xml);
  }
});

test('OAI validates verbs, duplicates, formats, dates, identifiers, sets and tokens',()=>{
  for(const [args,code] of [['','badVerb'],['verb=Nope','badVerb'],['verb=Identify&verb=Identify','badVerb'],['verb=Identify&x=1','badArgument'],
    ['verb=ListRecords','badArgument'],['verb=ListRecords&metadataPrefix=other','cannotDisseminateFormat'],['verb=ListRecords&metadataPrefix=oai_dc&metadataPrefix=oai_dc','badArgument'],
    ['verb=ListRecords&metadataPrefix=oai_dc&from=2026-02-30','badArgument'],['verb=ListRecords&metadataPrefix=oai_dc&from=2026-07-17&until=2026-07-16','badArgument'],
    ['verb=GetRecord&metadataPrefix=oai_dc&identifier=unknown','idDoesNotExist'],['verb=ListMetadataFormats&identifier=unknown','idDoesNotExist'],
    ['verb=ListRecords&metadataPrefix=oai_dc&set=other','noRecordsMatch'],['verb=ListRecords&resumptionToken=bad','badResumptionToken'],
    ['verb=ListRecords&resumptionToken=bad&metadataPrefix=oai_dc','badArgument'],['verb=ListRecords&metadataPrefix=oai_dc&from=2027-01-01','noRecordsMatch']]){
    const xml=oaiResponse(catalog,query(args));assert.match(xml,new RegExp(`error code="${code}"`),args);xmlCheck(xml);
  }
  const escaped=oaiResponse(catalog,query('verb=GetRecord&metadataPrefix=oai_dc&identifier=%22%3E%3Cevil%3E'));
  xmlCheck(escaped);assert.ok(!escaped.includes('<evil>'));
});

test('OAI accepts form POSTs and rejects unsupported HTTP methods and bodies',async()=>{
  const response=await handleOai(new Request(site.url+'/oai',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:'verb=Identify'}),catalog);
  assert.equal(response.status,200);xmlCheck(await response.text());
  assert.equal((await handleOai(new Request(site.url+'/oai',{method:'PUT'}),catalog)).status,405);
  assert.equal((await handleOai(new Request(site.url+'/oai',{method:'POST',body:'verb=Identify'}),catalog)).status,415);
  assert.equal((await handleOai(new Request(site.url+'/oai',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:'x'.repeat(8193)}),catalog)).status,413);
});

const key='abcdef0123456789abcdef0123456789';
const manifest={host:'example.org',keyVersion:createHash('sha256').update(key).digest('hex'),key,keyLocation:'https://example.org/'+key+'.txt',records:[{url:'https://example.org/one/',hash:'a'.repeat(64)}]};

test('IndexNow selects new, changed and removed URLs and validates ownership boundaries',()=>{
  assert.deepEqual(changedUrls(manifest,null),['https://example.org/one/']);
  assert.deepEqual(changedUrls(manifest,manifest),[]);
  const rotated='1234567890abcdef1234567890abcdef';
  assert.deepEqual(changedUrls({...manifest,key:rotated,keyLocation:'https://example.org/'+rotated+'.txt',keyVersion:createHash('sha256').update(rotated).digest('hex')},manifest),['https://example.org/one/']);
  const previous={...manifest,records:[{url:'https://example.org/one/',hash:'b'.repeat(64)},{url:'https://example.org/removed/',hash:'c'.repeat(64)}]};
  assert.deepEqual(changedUrls(manifest,previous),['https://example.org/one/','https://example.org/removed/']);
  assert.throws(()=>withKey(manifest,'wrong key'));
  assert.throws(()=>validateManifest({...manifest,keyLocation:'https://other.example/key.txt'}));
  assert.throws(()=>validateManifest({...manifest,records:[{url:'https://other.example/',hash:'a'.repeat(64)}]}));
  assert.throws(()=>validateManifest({...manifest,keyLocation:'https://user:pass@example.org/'+key+'.txt'}));
});

test('IndexNow verifies deployed ownership, batches at 10000 URLs, and never submits on validation failure',async()=>{
  const calls=[];
  const fetcher=async(url,options)=>{calls.push([url,options]);return options?.method==='POST'?new Response('',{status:202}):new Response(key);};
  const urls=Array.from({length:10001},(_,i)=>'https://example.org/page/'+i+'/');
  assert.equal(await submitIndexNow(manifest,urls,{fetcher}),10001);
  assert.equal(calls.length,3);assert.equal(calls[0][0],manifest.keyLocation);
  assert.equal(JSON.parse(calls[1][1].body).urlList.length,10000);assert.equal(JSON.parse(calls[2][1].body).urlList.length,1);
  await assert.rejects(submitIndexNow(manifest,['https://other.example/'],{fetcher}));assert.equal(calls.length,3);
  await assert.rejects(submitIndexNow(manifest,urls,{fetcher:async()=>new Response('wrong key')}));
  await assert.rejects(submitIndexNow(manifest,urls,{fetcher:async(url,options)=>options?.method==='POST'?new Response('',{status:429}):new Response(key)}));
});

test('Netlify IndexNow plugin skips local and preview deploys and submits only after production success',async()=>{
  const plugin=createRequire(import.meta.url)('../netlify/plugins/indexnow/index.cjs');
  const originalFetch=globalThis.fetch;const env={CONTEXT:process.env.CONTEXT,NETLIFY:process.env.NETLIFY};
  const config=yaml.load(fs.readFileSync('src/_config.yml','utf8'));const pluginKey=config.indexnow.key;
  const pluginManifest={host:new URL(config.url).host,keyVersion:createHash('sha256').update(pluginKey).digest('hex'),records:[{url:config.url+'/',hash:'a'.repeat(64)}]};
  const folder=fs.mkdtempSync(path.join(os.tmpdir(),'dod-indexnow-'));fs.writeFileSync(path.join(folder,'indexnow.json'),JSON.stringify(pluginManifest));
  const calls=[];
  try {
    globalThis.fetch=async(url,options)=>{calls.push([String(url),options?.method]);return String(url).endsWith('/indexnow.json')?new Response('',{status:404}):options?.method==='POST'?new Response('',{status:200}):new Response(pluginKey);};
    process.env.NETLIFY='true';process.env.CONTEXT='deploy-preview';
    await plugin.onPreBuild({constants:{IS_LOCAL:false}});await plugin.onSuccess({constants:{IS_LOCAL:false,PUBLISH_DIR:folder}});assert.equal(calls.length,0);
    process.env.CONTEXT='production';await plugin.onPreBuild({constants:{IS_LOCAL:true}});await plugin.onSuccess({constants:{IS_LOCAL:true,PUBLISH_DIR:folder}});assert.equal(calls.length,0);
    await plugin.onPreBuild({constants:{IS_LOCAL:false}});assert.equal(calls.length,1);assert.ok(!calls.some(([,method])=>method==='POST'));
    await plugin.onSuccess({constants:{IS_LOCAL:false,PUBLISH_DIR:folder}});assert.equal(calls.filter(([,method])=>method==='POST').length,1);
  } finally {
    globalThis.fetch=originalFetch;for(const [name,value] of Object.entries(env)){if(value===undefined)delete process.env[name];else process.env[name]=value;}
    fs.rmSync(folder,{recursive:true,force:true});
  }
});
