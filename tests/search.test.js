import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {searchRecords,buildSearchIndex} from '../lib/search.js';
import {staticContent} from '../lib/templates.js';

const doc=(url,extra={})=>({url,output:url.slice(1)+'index.html',title:'Discovery',description:'A description',date:'2026-10-15',content:'A long article '+('history '.repeat(300))+' rareendingword',tags:['sovereignty'],categories:['law'],...extra});
const site={url:'https://example.org',locale:'en-US',title:'Example',author:{name:'Editor'},authors:[],pages:[],posts:[],assets:{url:value=>value}};

test('search indexes full content and authors without drafts, redirects, noindex, or duplicate pagination',()=>{
  const data={...site,posts:[doc('/article/'),doc('/draft/',{draft:true}),doc('/redirect/',{redirect_to:'/article/'}),doc('/private/',{robots_meta:'noindex'}),doc('/unlisted/',{sitemap:false})],
    authors:[doc('/authors/writer',{bio:'A researcher of Indigenous sovereignty'})],
    pages:[doc('/search/'),doc('/hidden/',{hidden:true}),doc('/about/'),doc('/feed.xml',{output:'feed.xml'})]};
  const records=searchRecords(data);
  assert.deepEqual(records.map(record=>record.url),['/about/','/article/','/authors/writer']);
  assert.ok(records[1].content.includes('rareendingword'));
  assert.ok(records[1].content.includes('sovereignty'));
  assert.ok(records[2].content.includes('researcher'));
  assert.equal(records[1].meta.title,'Discovery');
});

test('Pagefind creates a hashed API-only bundle and changes it when content changes',async()=>{
  const output=fs.mkdtempSync(path.join(os.tmpdir(),'dod-search-'));
  try {
    const first=await buildSearchIndex({...site,posts:[doc('/article/')]});
    first.write(output);assert.equal(first.count,1);assert.match(first.url,/^\/assets\/built\/pagefind\.[a-f0-9]{16}\/pagefind.js$/);
    const directory=path.dirname(path.join(output,first.url));
    const entry=JSON.parse(fs.readFileSync(path.join(directory,'pagefind-entry.json'),'utf8'));
    assert.equal(entry.languages.en.page_count,1);
    assert.ok(fs.existsSync(path.join(directory,'pagefind.js')));
    assert.ok(!fs.existsSync(path.join(directory,'pagefind-ui.js')));
    assert.ok(!fs.existsSync(path.join(directory,'pagefind-worker.js')));
    const repeated=await buildSearchIndex({...site,posts:[doc('/article/')]});
    assert.equal(first.url,repeated.url);
    const changed=await buildSearchIndex({...site,posts:[doc('/article/',{content:'Entirely changed body'})]});
    assert.notEqual(first.url,changed.url);
  } finally {fs.rmSync(output,{recursive:true,force:true});}
});

test('static heading links and video aspect ratios preserve IDs, content, and existing styles',()=>{
  const original=`<h2 id='rights'>Indigenous <em>rights</em></h2><iframe src="https://www.youtube.com/embed/test" width="640" height="480" style="border:0"></iframe><script>const html='<h2 id="raw">Raw</h2>';</script>`;
  const html=staticContent(original);
  assert.ok(html.includes('href="#rights"'));
  assert.ok(html.includes('Indigenous <em>rights</em>'));
  assert.ok(html.includes('style="aspect-ratio:640/480;border:0"'));
  assert.ok(html.includes(`<script>const html='<h2 id="raw">Raw</h2>';</script>`));
  assert.equal(staticContent(html),html);
  assert.equal(staticContent('<iframe src="https://example.org/widget"></iframe>'),'<iframe src="https://example.org/widget"></iframe>');
});
