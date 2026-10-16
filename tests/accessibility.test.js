import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {templateEngine} from '../lib/templates.js';
import {files} from '../lib/content.js';

test('both paginators identify the current page without disabling it or adding dead links',()=>{
  const site={locale:'en',paginate_path:'/page:num/',data:{'ui-text':{en:{}}}};
  const engine=templateEngine(site).engine;
  for(const template of ['paginator-v1.html','paginator-v2.html']) {
    for(const page of [1,17,34]) {
      const paginator={page,total_pages:34,first_page:1,last_page:34,first_page_path:'/',last_page_path:'/page34/',
        previous_page:page>1?page-1:null,next_page:page<34?page+1:null,
        previous_page_path:`/page${page-1}/`,next_page_path:`/page${page+1}/`,
        page_trail:[page].map(num=>({num,path:`/page${num}/`}))};
      const html=engine.renderFileSync(template,{site,paginator});
      assert.match(html,/aria-label="Pagination"/);
      assert.equal((html.match(/aria-current="page"/g)||[]).length,1);
      assert.ok(html.includes(`<span class="current" aria-current="page">${page}</span>`));
      assert.ok(!/<a\b[^>]*(?:class="[^"]*disabled|href="#")/.test(html));
    }
  }
});

test('pagination text colors meet AA normal-text contrast',()=>{
  const css=fs.readFileSync('assets/css/main.css','utf8');
  const current=css.match(/\.pagination li a\.current,\.pagination li span\.current\s*\{([^}]+)}/)[1];
  const disabled=css.match(/\.pagination li a\.disabled,\.pagination li span\.disabled\s*\{([^}]+)}/)[1];
  const luminance=hex=>hex.replace('#','').match(/../g).map(v=>parseInt(v,16)/255)
    .map(v=>v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[0.2126,0.7152,0.0722][i],0);
  const foreground=current.match(/color:(#[\da-f]+)/)[1].replace('#fff','#ffffff');
  const background=current.match(/background:(#[\da-f]+)/)[1];
  const contrast=(a,b)=>(Math.max(luminance(a),luminance(b))+0.05)/(Math.min(luminance(a),luminance(b))+0.05);
  assert.ok(contrast(foreground,background)>=4.5);
  assert.ok(contrast(disabled.match(/color:(#[\da-f]+)/)[1],'#ffffff')>=4.5);
});

test('post navigation keeps inactive controls out of the tab order',()=>{
  const site={locale:'en',data:{'ui-text':{en:{}}}},engine=templateEngine(site).engine;
  for(const side of ['previous','next']) {
    const html=engine.renderFileSync('post_pagination.html',{site,page:{[side]:{url:'/post/',title:'Post'}}});
    assert.match(html,/aria-label="Post navigation"/);
    assert.match(html,/<span class="pagination--pager disabled" aria-disabled="true">/);
    assert.ok(!html.includes('href="#"'));
  }
});

test('embedded media have titles and the admin document declares its language',()=>{
  for(const file of [...files('_posts'),...files('_pages'),'_includes/video']) {
    for(const tag of fs.readFileSync(file,'utf8').match(/<iframe\b[^>]*>/gi)||[]) {
      assert.match(tag,/\btitle=["'][^"']+/i,file);
    }
  }
  assert.match(fs.readFileSync('admin/index.html','utf8'),/<html lang="en">/);
});
