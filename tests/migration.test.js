import configure from '../eleventy.config.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dateValue, calendarDate, frontMatter, files, isoDate, sortByModified, outputPath, postUrl, seoDescription } from '../lib/content.js';
import { markdownify, tableOfContents, templateEngine } from '../lib/templates.js';
import { getSite, redirectHtml } from '../lib/site.js';
import { citation, postMetadata, standardRecords } from '../lib/metadata.js';

test('New York wall times follow daylight saving and explicit offsets', () => {
  assert.equal(isoDate('2026-01-15T12:00:00'),'2026-01-15T12:00:00.000-05:00');
  assert.equal(isoDate('2026-07-15T12:00:00'),'2026-07-15T12:00:00.000-04:00');
  assert.equal(calendarDate('2026-07-15T01:00:00Z'),'2026-07-14');
  assert.throws(()=>dateValue('2022-06-13T:13:37:23'));
});
test('front matter supports empty blocks, trailing delimiter spaces and quoted dates', () => {
  assert.deepEqual(frontMatter('---\n---\nBody'),{data:{},body:'Body'});
  assert.equal(frontMatter('---\ndate: 2020-01-01\npublished: false\n--- \nBody').data.date,'2020-01-01');
  assert.equal(frontMatter('---\npublished: false\n---\nBody').data.published,false);
});
test('every content document has a valid publication date in front matter', () => {
  for(const filename of ['src/_posts','src/_pages','src/_authors','src/_drafts'].flatMap(files).concat(['src/index.html','src/atom.xml','src/metadata.json'])) {
    const {data}=frontMatter(fs.readFileSync(filename,'utf8'));
    assert.ok(data.date,filename); assert.ok(dateValue(data.date).isValid,filename);
  }
});
test('modified ordering falls back to publication and resolves ties consistently', () => {
  const docs=[{url:'/b/',date:'2020-01-01'},{url:'/a/',date:'2020-01-01'},
    {url:'/c/',date:'2019-01-01',last_modified_at:'2021-01-01'}];
  assert.deepEqual(docs.sort(sortByModified).map(d=>d.url),['/c/','/a/','/b/']);
});
test('public URL case and custom permalinks survive conversion', () => {
  assert.equal(postUrl({categories:['blog','Resource']},'2012-05-05-The-Evidence.md'),'/blog/resource/The-Evidence/');
  assert.equal(postUrl({permalink:'/inter-caetera/'},'2018-01-01-test.md'),'/inter-caetera/');
  assert.equal(outputPath('/authors/adam-dj-brett'),'authors/adam-dj-brett.html');
  assert.throws(()=>outputPath('/../outside'));
  assert.throws(()=>redirectHtml('javascript:alert(1)','https://example.com'));
});
test('Markdown preserves heading IDs, Kramdown attributes, tables and footnote links', () => {
  const html=markdownify('## Read [Online Resources](/online-resources/)\n\n## Morning Session II --11.00-12.30 (Local Time)\n\n[Register](/contact/){: .btn #register}\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\nText[^note].\n\n[^note]: Detail.');
  assert.match(html,/id="read-online-resources"/);
  assert.match(html,/id="morning-session-ii-1100-1230-local-time"/);
  assert.match(html,/class="btn" id="register"|id="register" class="btn"/);
  const gallery = markdownify('<figure>\n\n      <a href="/image.jpg">\n          <img src="/image.jpg" alt="Image">\n      </a>\n\n</figure>');
  assert.match(gallery,/<a href="\/image.jpg">/); assert.ok(!gallery.includes('&lt;a'));
  assert.match(html,/<table>/); assert.match(html,/href="#fn:note"/); assert.match(html,/id="fn:note"/);
  assert.match(html,/href="#fnref:note"/);
});
test('SEO descriptions preserve explicit text and generate bounded descriptions', () => {
  const long='Original description '.repeat(12);
  assert.equal(seoDescription({description:long},''),long);
  assert.equal(seoDescription({description:'Locked',seo_description_lock:true},''),'Locked');
  const generated=seoDescription({title:'Article'},'An article about history.');
  assert.ok(generated.length>=140 && generated.length<=160); assert.ok(!generated.includes('<'));
});
test('site uses Git modifications, precomputed author lists, and unique output paths', async () => {
  const {site,documents}=await getSite();
  assert.equal(site.timezone,'America/New_York');
  const version=JSON.parse(fs.readFileSync('node_modules/@11ty/eleventy/package.json','utf8')).version;
  assert.ok(documents.find(d=>d.url==='/').html.includes(`<meta name="generator" content="Eleventy v${version}">`));
  const expectedGit=execFileSync('git',['log','-1','--format=%cI','--','src/index.html','index.html'],{encoding:'utf8'}).trim();
  assert.equal(isoDate(documents.find(d=>d.path==='index.html').last_modified_at),isoDate(expectedGit));
  assert.deepEqual([...site.posts].sort(sortByModified).map(d=>d.url),site.posts.map(d=>d.url));
  const homepagePosts=documents.filter(d=>d.paginator).sort((a,b)=>a.paginator.page-b.paginator.page).flatMap(d=>d.paginator.posts);
  assert.equal(homepagePosts.length,site.posts.length);
  for(let i=1;i<homepagePosts.length;i++) assert.ok(dateValue(homepagePosts[i-1].date)>=dateValue(homepagePosts[i].date),'Homepage pagination must show newest publications first');
  assert.equal(new Set(documents.map(d=>d.output)).size,documents.length);
  const first=site.posts[0];
  assert.ok(first.html.includes('class="page__related"'));
  const related=first.html.slice(first.html.indexOf('class="page__related"'));
  assert.ok(!related.includes(`href="${first.url}"`), 'Related posts must not link to the current post');
  for(const author of site.authors) assert.deepEqual(site.author_posts[author.username].map(p=>p.url),site.posts.filter(p=>Array.isArray(p.author)?p.author.includes(author.username):p.author===author.username).map(p=>p.url));
  for(const post of site.posts) {
    if(!post.redirect_to) {
      const scripts=[...post.html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)].map(match=>match[1]);
      assert.equal(scripts.some(url=>/\/toc(?:\.[a-f0-9]+)?\.js$/.test(url)),Boolean(post.toc));
      assert.ok(!scripts.some(url=>/\/(?:search|gallery)(?:\.[a-f0-9]+)?\.js$/.test(url)),'Optional modules must load only on interaction');
    }
    const {data}=frontMatter(fs.readFileSync('src/' + post.path,'utf8'));
    if(data.last_modified_at) assert.equal(post.last_modified_at,isoDate(data.last_modified_at));
  }
});
test('citation and metadata generation preserve publication dates and document counts', async () => {
  const {site}=await getSite();const post=site.posts.find(p=>p.url==='/inter-caetera/');
  const {ris,csl}=citation(site,post);assert.match(ris,/DA  - 2022\/06\/13/);
  assert.equal(csl[0].type,'post-weblog');assert.equal(csl[0].URL,site.url+post.url);
  assert.deepEqual(csl[0].issued['date-parts'],[[2022,6,13]]);
  const metadata=postMetadata(site,post);assert.equal(metadata.datePublished.slice(0,10),'2022-06-13');
  assert.deepEqual(metadata.author.map(author=>author.name),['Sebastian Modrow','Melissa Smith']);
  const records=standardRecords(site);assert.equal(records.manifest.documentCount,site.posts.length+10);
});

test('author pages show their own complete profile in the sidebar', async () => {
  const {site}=await getSite();
  for(const author of site.authors) {
    const sidebar=author.html.split('<div class="archive h-card">')[0].split('class="sidebar sticky">')[1];
    assert.ok(sidebar,author.username);
    assert.ok(sidebar.includes(`>${author.name}</a>`),author.username);
    if(author.avatar) assert.match(sidebar,/class="u-photo"/);
    if(author.bio) assert.ok(sidebar.includes('class="author__bio p-note"'),author.username);
    for(const link of author.links || []) {
      if(link.label && link.url) assert.ok(sidebar.includes(`href="${link.url}"`),`${author.username}: ${link.label}`);
    }
  }
});

test('source exports fall back when Git history is unavailable', () => {
  const result=execFileSync(process.execPath,['--input-type=module','-e',"import {modifiedDates} from './lib/content.js'; console.log(modifiedDates().size)"],
    {encoding:'utf8',env:{...process.env,GIT_DIR:'/private/tmp/dod-goal2/missing-git-directory'},stdio:['ignore','pipe','pipe']});
  assert.equal(result.trim(),'0');
});

test('Git modification dates recognize both root and src content paths', () => {
  const folder=fs.mkdtempSync('/private/tmp/dod-history-');
  let commitDate='2020-01-01T12:00:00Z';
  const git=(...args)=>execFileSync('git',args,{cwd:folder,stdio:'pipe',
    env:{...process.env,GIT_AUTHOR_DATE:commitDate,GIT_COMMITTER_DATE:commitDate}});
  const lookup=()=>JSON.parse(execFileSync(process.execPath,['--input-type=module','-e',
    `import {modifiedDates} from ${JSON.stringify(new URL('../lib/content.js',import.meta.url).href)}; process.chdir(process.argv[1]); console.log(JSON.stringify([...modifiedDates()]));`,folder],{encoding:'utf8'})).map(([name,date])=>[name,isoDate(date)]);
  try {
    git('init','-q');
    fs.writeFileSync(folder+'/index.html','Home');
    git('add','index.html');
    git('-c','user.name=Test','-c','user.email=test@example.org','commit','-qm','Root content');
    const original=lookup();
    assert.deepEqual(original,[['index.html',isoDate('2020-01-01T12:00:00Z')]]);
    fs.mkdirSync(folder+'/src');
    git('mv','index.html','src/index.html');
    commitDate='2021-01-01T12:00:00Z';
    git('-c','user.name=Test','-c','user.email=test@example.org','commit','-qm','Move to src');
    assert.deepEqual(lookup(),[['index.html',isoDate('2021-01-01T12:00:00Z')]]);
  } finally {fs.rmSync(folder,{recursive:true,force:true});}
});

test('Eleventy builds src with public assets and content watching', () => {
  const copies=[],watched=[];
  const result=configure({directories:{output:'_site'},on(){},
    addPassthroughCopy:value=>copies.push(value),addWatchTarget:value=>watched.push(value)});
  assert.equal(result.dir.input,'src');
  assert.equal(result.dir.output,'_site');
  assert.ok(copies.includes('src/assets'));
  assert.ok(copies.includes('src/admin'));
  assert.ok(watched.includes('src/_posts/**'));
});

test('theme translations resolve YAML merges and TOC retains nested theme markup', async () => {
  const {site}=await getSite();
  assert.equal(site.data['ui-text'][site.locale].menu_label,'Toggle menu');
  assert.equal(tableOfContents('<h2 id="a">A</h2><h3 id="b">B &amp; C</h3><h2 id="d">D</h2>'),'<ul class="toc__menu"><li><a href="#a">A</a><ul><li><a href="#b">B &amp; C</a></li></ul></li><li><a href="#d">D</a></li></ul>');
  const page=site.posts.find(p=>p.url==='/what-is-the-doctrine-of-discovery/');
  assert.ok(page.html.includes('class="greedy-nav"'));
  assert.ok(page.html.includes('class="search-content"'));
  assert.ok(!/\d+\.\d+ minute read/.test(page.html));
});

test('synchronous Liquid filters preserve filtering, year groups and stable taxonomy order', () => {
  const {engine}=templateEngine({url:'https://example.com'});
  const posts=[{title:'A',date:'2020-01-01'}, {title:'B',date:'2021-01-01',hidden:true}, {title:'C',date:'2020-02-01'}];
  const filtered=engine.parseAndRenderSync(`{{ posts | where_exp: "post", "post.hidden != true" | map: "title" | join: "," }}`,{posts});
  assert.equal(filtered,'A,C');
  const grouped=engine.parseAndRenderSync(`{% assign years = posts | group_by_exp: 'post', 'post.date | date: "%Y"' %}{% for year in years %}{{year.name}}:{{year.items.size}};{% endfor %}`,{posts});
  assert.equal(grouped,'2020:2;2021:1;');
  const taxonomies={first:[1],largest:[1,2],second:[1],empty:[]};
  const ordered=engine.parseAndRenderSync(`{% assign groups = taxonomies | sort_taxonomies %}{% for group in groups %}{{group[0]}};{% endfor %}`,{taxonomies});
  assert.equal(ordered,'largest;first;second;');
  assert.equal(engine.parseAndRenderSync('{{text | markdownify}}',{text:'**One**'}),'<p><strong>One</strong></p>\n');
  assert.equal(engine.parseAndRenderSync('{{text | markdownify}}',{text:'**Two**'}),'<p><strong>Two</strong></p>\n');
});

test('existing citation downloads are not replaced by redirect pages', async () => {
  const {site,documents,redirects}=await getSite();
  const staticPaths=new Set(site.static_files.map(file=>file.path));
  for (const doc of documents) assert.ok(!staticPaths.has('/'+doc.output),doc.output);
  assert.equal(redirects['/assets/pdfs/citation-formats/modrow-smith-inter-caetera-scholar.bib'],undefined);
  for (const post of site.posts) assert.ok(Number.isInteger(post.word_count) && post.word_count>=0);
});

test('direct asset serving is limited to in-project previews; other builds keep copying', () => {
  const previous=process.env.ELEVENTY_RUN_MODE;
  try {
    for (const [mode,output,fast] of [['serve','_site',true],['build','_site',false],['watch','_site',false],['serve','/private/tmp/dod-preview-outside',false]]) {
      process.env.ELEVENTY_RUN_MODE=mode;
      const fake={directories:{output},watchIgnores:new Set(),on(){},addPassthroughCopy(){},addWatchTarget(){},
        setServerPassthroughCopyBehavior(value){this.behavior=value;},setServerOptions(value){this.server=value;}};
      configure(fake);
      assert.equal(fake.behavior==='passthrough',fast);
      assert.equal(fake.watchIgnores.has('src/assets/css/**'),fast);
      assert.equal(Boolean(fake.server?.aliases?.['/assets/citations/']),fast);
    }
  } finally {
    if(previous===undefined)delete process.env.ELEVENTY_RUN_MODE;else process.env.ELEVENTY_RUN_MODE=previous;
  }
});

test('dev serves permanent URL aliases locally and preserves queries and fragments', async () => {
  const previous=process.env.ELEVENTY_RUN_MODE;
  const folder=fs.mkdtempSync('/private/tmp/dod-redirects-');
  try {
    process.env.ELEVENTY_RUN_MODE='serve';
    fs.writeFileSync(folder+'/_redirects','/old/ https://doctrineofdiscovery.org/review/new/#part 301!\n/away https://podcast.doctrineofdiscovery.org/subscribe/ 301\n');
    const options=[];
    configure({directories:{output:folder},on(){},addPassthroughCopy(){},addWatchTarget(){},setServerOptions:value=>options.push(value)});
    const middleware=options.find(value=>value.middleware).middleware[0];
    for(const [url,expected] of [['/old/?source=test','/review/new/?source=test#part'],['/away','https://podcast.doctrineofdiscovery.org/subscribe/']]) {
      let response;
      await middleware({url,method:'GET'},{writeHead:(status,headers)=>{response={status,...headers};},end(){}},()=>assert.fail('Alias must redirect'));
      assert.deepEqual(response,{status:301,Location:expected});
    }
    let next=false;
    await middleware({url:'/unchanged/',method:'GET'},{},()=>{next=true;});assert.ok(next);
  } finally {
    fs.rmSync(folder,{recursive:true,force:true});
    if(previous===undefined)delete process.env.ELEVENTY_RUN_MODE;else process.env.ELEVENTY_RUN_MODE=previous;
  }
});
