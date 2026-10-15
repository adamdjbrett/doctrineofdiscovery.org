import fs from 'node:fs';
import path from 'node:path';
import { calendarDate, dateValue, plainText, outputPath } from './content.js';
import { markdown } from './templates.js';

const escape = value => markdown.utils.escapeHtml(String(value ?? ''));
const corePages = ['/about/','/law/','/papal-bulls/','/faith-communities/','/bibliography/','/online-resources/','/united-nations/','/pdf-archive/','/featured/','/canopy/'];
export function postMetadata(site, post) {
  const canonical = post.canonical_url || site.url + post.url;
  const author = site.authors.find(a => a.username === post.author || a.slug === post.author);
  const image = post.image?.path || post.image || post.header?.image || site.teaser || site.logo;
  const record = {
    '@context': 'https://schema.org', '@type': 'BlogPosting', '@id': canonical + '#article',
    name: post.title || site.title, headline: post.title || site.title,
    description: post.front_matter_description || plainText(post.excerpt || site.description),
    url: canonical, inLanguage: site.locale.slice(0,2), identifier: post.doi || canonical,
    datePublished: calendarDate(post.date), dateModified: calendarDate(post.last_modified_at || post.date),
    author: { '@type': 'Person', name: author?.name || (post.author ? String(post.author).split('-').map(s=>s[0]?.toUpperCase()+s.slice(1)).join(' ') : site.author.name) },
    publisher: { '@type': 'Organization', name: site.title, url: site.url },
    isPartOf: { '@type': 'Blog', '@id': site.url+'/blog/', name: site.title, url: site.url+'/blog/' }
  };
  if (image) record.image = new URL(image,site.url).href;
  if (post.citations) record.citation = post.citations;
  return record;
}
export function citation(site, post) {
  const slug = post.url.split('/').filter(Boolean).at(-1);
  const description = String(post.description || post.excerpt || '').replaceAll('\n',' ');
  const author = post.author || 'Doctrine of Discovery Project';
  const date = dateValue(post.date);
  const url = site.url + post.url;
  const ris = ['TY  - GEN',`TI  - ${post.title}`,`AU  - ${author}`,`DA  - ${date.toFormat('yyyy/MM/dd')}`,`UR  - ${url}`,
    ...(description ? [`N1  - ${description}`] : []),...post.tags.map(tag=>`KW  - ${tag}`),`PB  - Doctrine of Discovery Project`,`T1  - ${post.title}`,'ER  -',''].join('\n');
  const csl = [{ id: slug, type: 'post-weblog', title: post.title, abstract: description, URL: url,
    language: 'en', source: site.title, issued: { 'date-parts': [[date.year,date.month,date.day]] },
    author: [{ literal: author }], ...(post.tags.length ? { keyword: post.tags } : {}) }];
  return { slug, ris, csl };
}
export function standardRecords(site) {
  const config = site.standard_site;
  const publication = { $type: 'site.standard.publication', name: config.name || site.title,
    url: config.url || site.url, description: config.description || site.description };
  if (config.did) publication.did = config.did;
  if (config.publication_at_uri) publication.atUri = config.publication_at_uri;
  const documents = [...site.posts, ...site.pages.filter(p=>corePages.includes(p.url))].map(doc => ({
    $type: 'site.standard.document', site: config.publication_at_uri || publication.url, path: doc.url,
    title: plainText(doc.title) || doc.url, publishedAt: dateValue(doc.date).toUTC().toISO({ suppressMilliseconds:true }),
    ...(doc.last_modified_at !== doc.date ? { updatedAt: dateValue(doc.last_modified_at).toUTC().toISO({ suppressMilliseconds:true }) } : {}),
    ...(doc.front_matter_description || doc.excerpt ? { description: plainText(doc.front_matter_description || doc.excerpt) } : {}),
    ...(doc.tags.length || doc.categories.length ? { tags: [...new Set([...doc.tags,...doc.categories])] } : {}),
    ...(plainText(doc.raw) ? { textContent: plainText(doc.raw) } : {}),
    ...(doc.canonical_url ? { canonicalUrl: doc.canonical_url } : {}), ...(doc.link ? { externalUrl: doc.link } : {})
  })).sort((a,b)=>a.path.localeCompare(b.path));
  return { publication, documents, manifest: { $type:'site.standard.manifest', publication, documentCount: documents.length,
    documents: documents.map(({path,title,publishedAt})=>({path,title,publishedAt})) } };
}
export function writeMetadata({site,documents,redirects}, destination) {
  function write(relative, content) {
    const target = path.resolve(destination,relative);
    if (!target.startsWith(path.resolve(destination) + path.sep)) throw new Error(`Invalid output: ${relative}`);
    fs.mkdirSync(path.dirname(target),{recursive:true}); fs.writeFileSync(target,content);
  }
  const json = (relative,value) => write(relative,JSON.stringify(value,null,2)+'\n');
  for (const post of [...site.posts].sort((a,b)=>dateValue(a.date)-dateValue(b.date)||a.url.localeCompare(b.url))) {
    json(`${post.url.slice(1).replace(/\/$/,'')}/metadata.json`,postMetadata(site,post));
    const {slug,ris,csl} = citation(site,post);
    write(`assets/citations/${slug}.ris`,ris); json(`assets/citations/${slug}.csl.json`,csl);
  }
  if (site.standard_site.enabled) {
    const records = standardRecords(site);
    for (const [key,value] of Object.entries(records)) json(`standard.site/${key}.json`,value);
  }
  json('redirects.json',redirects);
  json('assets/js/lunr/store.json', [...site.authors,...site.posts,...site.pages.filter(p=>!p.redirect_to&&!p.hidden)].map(doc => ({
    title: plainText(doc.title || doc.name), excerpt: plainText(doc.excerpt || doc.raw).slice(0,1000),
    categories: doc.categories, tags: doc.tags, url: doc.url, teaser: doc.header?.teaser || site.teaser
  })));
  const posts = [...site.posts].sort((a,b)=>dateValue(b.date)-dateValue(a.date)||a.url.localeCompare(b.url));
  write('feed.xml',`<?xml version="1.0" encoding="UTF-8"?>\n<feed xmlns="http://www.w3.org/2005/Atom"><id>${escape(site.url+'/')}</id><title>${escape(site.title)}</title><subtitle>${escape(site.description)}</subtitle><updated>${dateValue(site.posts[0]?.last_modified_at || site.time).toUTC().toISO()}</updated><link href="${site.url}/feed.xml" rel="self"/><link href="${site.url}/"/>${posts.slice(0,10).map(post=>`<entry><id>${escape(site.url+post.url)}</id><title>${escape(post.title)}</title><link href="${escape(site.url+post.url)}"/><published>${post.date}</published><updated>${post.last_modified_at}</updated><author><name>${escape(site.authors.find(a=>a.username===post.author)?.name||post.author||site.author.name)}</name></author><summary>${escape(plainText(post.excerpt))}</summary><content type="html">${escape(post.content)}</content></entry>`).join('')}</feed>`);
  const urls = documents.filter(doc => doc.date && doc.sitemap !== false && !doc.redirect_to && outputPath(doc.url).endsWith('.html'));
  const entries = urls.map(doc=>`<url><loc>${escape(site.url+doc.url)}</loc><lastmod>${doc.last_modified_at}</lastmod></url>`);
  write('sitemap.xml',`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries.join('')}</urlset>`);
}
