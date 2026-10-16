import fs from 'node:fs';
import path from 'node:path';
import { calendarDate, dateValue, plainText, outputPath } from './content.js';
import { markdown } from './templates.js';
import { articleSchema, publicationRecord, authorsFor, dublinCoreXml, publicDocument, exportUrl } from './publication.js';
import { createHash } from 'node:crypto';
import { validateManifest } from './indexnow.js';

const escape = value => markdown.utils.escapeHtml(String(value ?? ''));
const corePages = ['/about/','/law/','/papal-bulls/','/faith-communities/','/bibliography/','/online-resources/','/united-nations/','/pdf-archive/','/featured/','/canopy/'];
export function postMetadata(site, post) {
  return { '@context':'https://schema.org', ...articleSchema(site,post) };
}

export function citation(site, post) {
  const slug = post.url.split('/').filter(Boolean).at(-1);
  const record = publicationRecord(site,post);
  const description = record.description;
  const authors = record.authors.map(author => author.name);
  const date = dateValue(post.date);
  const url = record.url;
  const ris = ['TY  - GEN',`TI  - ${record.title}`,...authors.map(author=>`AU  - ${author}`),`DA  - ${date.toFormat('yyyy/MM/dd')}`,`UR  - ${url}`,`LA  - ${record.language}`,
    ...(record.doi ? [`DO  - ${record.doi}`] : []),...(record.pdf ? [`L1  - ${record.pdf}`] : []),
    ...(description ? [`N1  - ${description}`] : []),...post.tags.map(tag=>`KW  - ${tag}`),`PB  - Doctrine of Discovery Project`,`T1  - ${record.title}`,'ER  -',''].join('\n');
  const csl = [{ id: slug || 'index', type: post.collection === 'posts' ? 'post-weblog' : 'webpage', title: record.title, abstract: description, URL: url,
    language: record.language, source: site.title, issued: { 'date-parts': [[date.year,date.month,date.day]] },
    author: authors.map(literal=>({literal})), ...(record.doi ? {DOI:record.doi} : {}), ...(post.tags.length ? { keyword: post.tags } : {}) }];
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
  site.assets.write(destination);
  site.search_bundle?.write(destination);
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
    write(exportUrl(post,'citation.ris').slice(1),ris);
    json(exportUrl(post,'citation.csl.json').slice(1),csl);
    write(exportUrl(post,'dc.xml').slice(1),'<?xml version="1.0" encoding="UTF-8"?>\n'+dublinCoreXml(site,post));
  }
  for (const page of documents.filter(doc=>doc.collection==='pages' && !doc.redirect_to && doc.output.endsWith('.html'))) {
    const {ris,csl}=citation(site,page);
    write(exportUrl(page,'citation.ris').slice(1),ris);
    json(exportUrl(page,'citation.csl.json').slice(1),csl);
    write(exportUrl(page,'dc.xml').slice(1),'<?xml version="1.0" encoding="UTF-8"?>\n'+dublinCoreXml(site,page));
  }
  if (site.standard_site.enabled) {
    const records = standardRecords(site);
    for (const [key,value] of Object.entries(records)) json(`standard.site/${key}.json`,value);
  }
  json('redirects.json',redirects);
  write('_redirects',fs.readFileSync('_redirects','utf8').trimEnd()+'\n'+
    Object.entries(redirects).map(([from,to])=>`${from} ${to} 301!`).join('\n')+'\n');
  const posts = [...site.posts].sort((a,b)=>dateValue(b.date)-dateValue(a.date)||a.url.localeCompare(b.url));
  write('feed.xml',`<?xml version="1.0" encoding="UTF-8"?>\n<feed xmlns="http://www.w3.org/2005/Atom"><id>${escape(site.url+'/')}</id><title>${escape(site.title)}</title><subtitle>${escape(site.description)}</subtitle><updated>${dateValue(site.posts[0]?.last_modified_at || site.time).toUTC().toISO()}</updated><link href="${site.url}/feed.xml" rel="self"/><link href="${site.url}/"/>${posts.slice(0,10).map(post=>`<entry><id>${escape(site.url+post.url)}</id><title>${escape(post.title)}</title><link href="${escape(site.url+post.url)}"/><published>${post.date}</published><updated>${post.last_modified_at}</updated><author><name>${escape(authorsFor(site,post).map(author=>author.name).join("; "))}</name></author><summary>${escape(plainText(post.excerpt))}</summary><content type="html">${escape(post.content)}</content></entry>`).join('')}</feed>`);
  const urls = documents.filter(doc => doc.date && doc.sitemap !== false && !doc.redirect_to && outputPath(doc.url).endsWith('.html'));
  const entries = urls.map(doc=>`<url><loc>${escape(site.url+doc.url)}</loc><lastmod>${doc.last_modified_at}</lastmod></url>`);
  const records = site.posts.filter(publicDocument).map(post=>({
    identifier:`oai:${new URL(site.url).hostname}:${encodeURIComponent(post.url)}`,
    datestamp:dateValue([post.last_modified_at || post.date,site.metadata_modified_at,
      ...site.authors.filter(author=>publicationRecord(site,post).authors.some(value=>value.url===new URL(author.url,site.url).href)).map(author=>author.last_modified_at)]
      .filter(Boolean).sort((a,b)=>dateValue(b)-dateValue(a))[0]).toUTC().toISODate(), xml:dublinCoreXml(site,post)
  })).sort((a,b)=>a.identifier.localeCompare(b.identifier));
  json('oai/records.json',{name:site.title,email:site.email,baseURL:site.url+'/oai',records});
  const indexable = documents.filter(doc=>doc.date && publicDocument(doc) && doc.output.endsWith('.html') && new URL(doc.canonical_url || doc.url,site.url).href === new URL(doc.url,site.url).href);
  const indexnow=validateManifest({host:new URL(site.url).host,key:site.indexnow.key,keyLocation:site.url+'/'+site.indexnow.key+'.txt',
    records:indexable.map(doc=>({url:new URL(doc.url,site.url).href,hash:createHash('sha256').update(doc.html).digest('hex')})).sort((a,b)=>a.url.localeCompare(b.url))});
  json('indexnow.json',{host:indexnow.host,keyVersion:createHash('sha256').update(indexnow.key).digest('hex'),records:indexnow.records});
  write(site.indexnow.key+'.txt',site.indexnow.key+'\n');
  write('sitemap.xml',`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries.join('')}</urlset>`);
}
