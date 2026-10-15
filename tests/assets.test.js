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

test('analytics queues page configuration immediately and loads only after load and idle',()=>{
  const site={analytics:{google:{tracking_id:'G-TEST',anonymize_ip:true}}};
  const html=templateEngine(site).engine.renderFileSync('analytics-providers/google-gtag.html',{site});
  for(const idleSupported of [true,false]) {
    let load,idle;const appended=[];
    const context={document:{createElement:()=>({}),head:{append:script=>appended.push(script)}},
      addEventListener:(event,callback,options)=>{assert.equal(event,'load');assert.equal(options.once,true);load=callback;},
      setTimeout:callback=>{idle=callback;}};
    if(idleSupported)context.requestIdleCallback=callback=>{idle=callback;};
    context.window=context;vm.runInNewContext(html.match(/<script>([\s\S]*?)<\/script>/)[1],context);
    assert.equal(context.dataLayer.length,2);assert.equal(context.dataLayer[1][1],'G-TEST');
    assert.equal(appended.length,0);load();assert.equal(appended.length,0);idle();
    assert.equal(appended.length,1);assert.equal(appended[0].async,true);assert.ok(appended[0].src.endsWith('id=G-TEST'));
  }
});
