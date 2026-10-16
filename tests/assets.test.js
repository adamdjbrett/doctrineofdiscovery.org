import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {assetManager,compactCss,imageDimensions} from '../lib/assets.js';
import {templateEngine} from '../lib/templates.js';

test('built assets have content hashes, preserve bytes, and cannot escape assets',()=>{
  const folder=fs.mkdtempSync('assets/.asset-test-');
  const output=fs.mkdtempSync(path.join(os.tmpdir(),'dod-assets-'));
  try {
    const source=folder+'/sample.js';fs.writeFileSync(source,'const version = 1;');
    const assets=assetManager();const first=assets.url('/'+source);
    assert.match(first,/\/assets\/built\/sample\.[a-f0-9]{16}\.js$/);
    assert.equal(assets.url('/'+source),first);
    assets.write(output);assert.equal(fs.readFileSync(path.join(output,first),'utf8'),'const version = 1;');
    fs.writeFileSync(source,'const version = 2;');assert.notEqual(assetManager().url('/'+source),first);
    assert.equal(assetManager({serve:true}).url('/'+source),'/'+source);
    assert.throws(()=>assets.url('/assets/../../package.json'),/inside assets/);
  } finally {fs.rmSync(folder,{recursive:true,force:true});fs.rmSync(output,{recursive:true,force:true});}
});

test('CSS compaction preserves quoted content, calc spacing, and license attribution',()=>{
  assert.equal(compactCss('/*! License */\n/* omit */\na:hover { content: "a : b; c"; width: calc(100% - 2px); }'),
    '/*! License */  a:hover{content:"a : b; c";width:calc(100% - 2px)}');
});

test('local SVG icons support both quote styles and fail visibly on missing icons',()=>{
  const assets=assetManager();
  const html=assets.renderIcons(`<i class='fas fa-microphone'></i><i class="far fa-clock" aria-hidden="true"></i>`);
  assert.ok(!html.includes('<i '));assert.ok(html.includes('#solid-microphone'));assert.ok(html.includes('#regular-clock'));
  assert.equal((html.match(/focusable="false"/g)||[]).length,2);
  assert.throws(()=>assets.renderIcons('<i class="fas fa-nonexistent-icon"></i>'),/Missing local icon/);
});

test('image sizing preserves aspect ratios and existing attributes without loading remote images',()=>{
  for(const [file,size] of [['assets/images/authors/rjmill10.png',[240,240]],['assets/images/Mission-Interior-from-Lookout.jpg',[1200,900]],['assets/images/optimized/robert-miller.webp',[220,220]]]) {
    assert.deepEqual(imageDimensions(fs.readFileSync(file)),size);
  }
  assert.equal(imageDimensions(Buffer.alloc(0)),null);
  const malformed=Buffer.alloc(40,255);malformed[1]=216;
  assert.equal(imageDimensions(malformed),null);
  const assets=assetManager();const original='<img src="/assets/images/authors/rjmill10.png" alt="Robert J. Miller" loading="lazy">';
  const html=assets.renderImages(original);
  assert.match(html,/width="220" height="220"/);assert.ok(html.includes('alt="Robert J. Miller" loading="lazy"'));
  assert.equal(assets.renderImages(html),html);
  assert.equal(assets.renderImages('<img src="https://example.org/photo.png">'),'<img src="https://example.org/photo.png">');
});

test('logo variants preserve 88px sizing and sharp high-density choices',()=>{
  const assets=assetManager();
  const site={logo:'/assets/images/doctrine-of-discovery-project-logo.png',title:'Test',assets};
  const html=templateEngine(site).engine.renderFileSync('masthead.html',{site});
  assert.match(html,/width="88" height="88"/);
  assert.match(html,/srcset="[^\"]+ 1x, [^\"]+ 2x, [^\"]+ 3x"/);
  for(const [name,size] of [['site-logo-1x',88],['site-logo',176],['site-logo-3x',300]]) {
    assert.deepEqual(imageDimensions(fs.readFileSync(`assets/images/optimized/${name}.webp`)),[size,size]);
  }
  site.logo='/assets/images/authors/rjmill10.png';
  assert.ok(!templateEngine(site).engine.renderFileSync('masthead.html',{site}).includes('srcset='));
});

test('analytics queues page configuration and loads once after interaction and idle',()=>{
  const site={analytics:{google:{tracking_id:'G-TEST',anonymize_ip:true}}};
  const html=templateEngine(site).engine.renderFileSync('analytics.html',{site});
  for(const idleSupported of [true,false]) {
    let idle;const appended=[];const listeners=new Map();
    const context={document:{createElement:()=>({}),head:{append:script=>appended.push(script)}},
      addEventListener:(event,callback,options)=>{assert.equal(options.once,true);assert.equal(options.passive,true);listeners.set(event,callback);},
      removeEventListener:event=>listeners.delete(event),
      setTimeout:callback=>{idle=callback;}};
    if(idleSupported)context.requestIdleCallback=callback=>{idle=callback;};
    context.window=context;vm.runInNewContext(html.match(/<script>([\s\S]*?)<\/script>/)[1],context);
    assert.equal(context.dataLayer.length,2);assert.equal(context.dataLayer[1][1],'G-TEST');
    assert.equal(appended.length,0);assert.equal(idle,undefined);
    assert.deepEqual([...listeners.keys()],['pointerdown','keydown','scroll']);
    listeners.get('keydown')();assert.equal(listeners.size,0);assert.equal(appended.length,0);idle();
    assert.equal(appended.length,1);assert.equal(appended[0].async,true);assert.ok(appended[0].src.endsWith('id=G-TEST'));
  }
});

test('Cloudflare shares the lazy analytics trigger and avoids an injected duplicate',()=>{
  for(const google of [undefined,{tracking_id:'G-TEST'}]) for(const injected of [false,true]) {
    const site={analytics:{google,cloudflare:{token:'existing-public-token'}}};
    const html=templateEngine(site).engine.renderFileSync('analytics.html',{site});
    const listeners=new Map(),appended=[];let idle;
    const context={document:{querySelector:selector=>{assert.ok(selector.includes('static.cloudflareinsights.com'));return injected?{}:null;},
      createElement:()=>({setAttribute(name,value){this[name]=value;}}),head:{append:script=>appended.push(script)}},
      addEventListener:(event,callback)=>listeners.set(event,callback),removeEventListener:event=>listeners.delete(event),
      requestIdleCallback:callback=>{idle=callback;}};
    context.window=context;vm.runInNewContext(html.match(/<script>([\s\S]*?)<\/script>/)[1],context);
    assert.equal(appended.length,0);assert.equal(idle,undefined);
    listeners.get('pointerdown')();assert.equal(listeners.size,0);assert.equal(appended.length,0);idle();
    const beacons=appended.filter(script=>script.src.includes('cloudflareinsights'));
    assert.equal(beacons.length,injected?0:1);
    if(!injected) {
      assert.equal(beacons[0].async,true);
      assert.deepEqual(JSON.parse(beacons[0]['data-cf-beacon']),{token:'existing-public-token'});
    }
    assert.equal(appended.length,(google?1:0)+(injected?0:1));
  }
  const site={analytics:{cloudflare:{token:''}}};
  assert.equal(templateEngine(site).engine.renderFileSync('analytics.html',{site}).trim(),'');
});
