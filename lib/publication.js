import { calendarDate, dateValue, plainText } from './content.js';
import { markdown, markdownify } from './templates.js';

import { escape } from './xml.js';
export { escape } from './xml.js';
export const text = value => markdown.utils.unescapeAll(plainText(markdownify(String(value ?? ''))));
export const safeJson = value => JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
export function canonicalUrl(site, doc) {
  const url = new URL(doc.canonical_url || doc.url, site.url);
  if (!['http:','https:'].includes(url.protocol) || url.username || url.password) throw new Error('Invalid canonical URL: '+doc.url);
  return url.href;
}
export const publicDocument = doc => !doc.redirect_to && doc.published !== false && doc.draft !== true && doc.sitemap !== false && !/(?:^|[\s,])noindex(?:$|[\s,])/i.test(doc.robots_meta || '');
export const exportUrl = (doc, filename) => doc.url.endsWith('/') ? doc.url + filename : doc.url + '.' + filename;

export function authorsFor(site, doc) {
  const values = [doc.authors || doc.author || site.author].flat();
  return values.map(value => {
    const key = typeof value === 'string' ? value : value.username || value.name;
    const author = site.authors.find(a => [a.username,a.slug,a.name].some(v => v?.toLowerCase() === key?.toLowerCase())) || (typeof value === 'object' ? value : {name:value});
    const url = author.url || author.uri;
    const result = { '@type': author.schema_type || 'Person', name: text(author.name || key) };
    if (url) { result.url = new URL(url,site.url).href; result['@id'] = result.url + '#author'; }
    if (author.avatar) result.image = new URL(author.avatar,site.url).href;
    if (author.bio) result.description = text(author.bio);
    if (author.email) result.email = author.email;
    if (author.location) result[result['@type']==='Person'?'homeLocation':'location'] = {'@type':'Place',name:text(author.location)};
    const links = [...(author.links || []).map(link => link.url),author.uri].filter(url => /^https?:\/\//.test(url || ''));
    if (links.length) result.sameAs = [...new Set(links)];
    return result;
  });
}

export function publicationRecord(site, doc) {
  if (doc.publication) return doc.publication;
  return { title: text(doc.title || doc.name || site.title), description: text(doc.description || doc.excerpt || site.description),
    url: canonicalUrl(site,doc), localUrl: new URL(doc.url,site.url).href, authors: authorsFor(site,doc),
    published: calendarDate(doc.date), modified: calendarDate(doc.last_modified_at || doc.date),
    publishedTime: dateValue(doc.date).toISO(), modifiedTime: dateValue(doc.last_modified_at || doc.date).toISO(),
    language: (doc.lang || doc.locale || site.locale).replace('_','-'),
    tags: [...new Set([...(doc.tags || []),...(doc.categories || [])])],
    ...(doc.doi ? {doi:doc.doi} : {}), ...(doc.pdf ? {pdf:new URL(doc.pdf,site.url).href} : {}) };
}

export function articleSchema(site, doc) {
  const record = publicationRecord(site,doc);
  const image = doc.image?.path || doc.image || doc.header?.image || site.teaser || site.logo;
  return { '@type':'BlogPosting', '@id':record.url+'#article', url:record.url,
    name:record.title, headline:record.title, description:record.description,
    datePublished:record.publishedTime, dateModified:record.modifiedTime, inLanguage:record.language,
    author:record.authors, publisher:{'@id':site.url+'/#organization'},
    mainEntityOfPage:{'@id':record.url+'#webpage'}, isPartOf:{'@id':site.url+'/#blog'},
    ...(image ? {image:new URL(image,site.url).href} : {}),
    ...(record.doi ? {identifier:record.doi} : {}), ...(doc.citations ? {citation:doc.citations} : {}) };
}

export function siteGraph(site) {
  return [
    { ...site.data.organization, '@type':'Organization', '@id':site.url+'/#organization', name:site.title,
      url:site.url+'/', email:site.email, logo:{'@type':'ImageObject',url:new URL(site.logo,site.url).href} },
    { '@type':'WebSite','@id':site.url+'/#website',url:site.url+'/',name:site.title,
      publisher:{'@id':site.url+'/#organization'},inLanguage:site.locale },
    { '@type':'Blog','@id':site.url+'/#blog',url:site.url+'/',name:site.title,
      publisher:{'@id':site.url+'/#organization'},isPartOf:{'@id':site.url+'/#website'} }
  ];
}

export function metadataHead(site, doc) {
  const r = publicationRecord(site,doc);
  const tags = [];
  const meta = (name,value,property=false) => { if (value !== undefined && value !== '') tags.push(`<meta ${property?'property':'name'}="${escape(name)}" content="${escape(value)}">`); };
  for (const author of r.authors) { meta('author',author.name); if (doc.collection==='posts') meta('article:author',author.url || author.name,true); }
  if (publicDocument(doc)) {
    meta('DC.title',r.title); r.authors.forEach(author=>meta('DC.creator',author.name));
    meta('DC.identifier',r.url); meta('DC.publisher',site.title); meta('DC.description',r.description);
    meta('DC.language',r.language); meta('DC.type','Text');
    meta('DC.date',r.published); meta('DCTERMS.issued',r.publishedTime); meta('DCTERMS.modified',r.modifiedTime);
    r.tags.forEach(tag=>meta('DC.subject',tag)); if (doc.rights || site.rights) meta('DC.rights',doc.rights || site.rights);
    meta('citation_title',r.title); r.authors.forEach(author=>meta('citation_author',author.name));
    meta('citation_date',r.published); meta('citation_publication_date',r.published);
    meta('citation_public_url',r.url); meta('citation_language',r.language); meta('citation_abstract',r.description);
    meta('citation_publisher',site.title); meta('citation_keywords',r.tags.join('; '));
    meta('prism.publicationName',site.title); meta('zotero:itemType',doc.collection==='posts'?'blogPost':'webPage',true);
    if (doc.collection==='posts') meta('prism.genre','blogentry');
    if (r.doi) meta('citation_doi',r.doi);
    if (r.pdf) { meta('citation_pdf_url',r.pdf); meta('citation_abstract_html_url',r.url); }
  }
  for (const author of r.authors) if (author.url) tags.push(`<link rel="author" href="${escape(author.url)}">`);
  tags.push(`<link rel="schema.DC" href="http://purl.org/dc/elements/1.1/">`, `<link rel="schema.DCTERMS" href="http://purl.org/dc/terms/">`,
    `<link rel="service-desc" type="application/xml" title="OAI-PMH metadata repository" href="${escape(site.url+'/oai?verb=Identify')}">`);
  if ((doc.collection==='posts' || doc.output?.endsWith('.html') && doc.collection!=='authors') && publicDocument(doc)) for (const [filename,type] of [['citation.ris','application/x-research-info-systems'],['citation.csl.json','application/vnd.citationstyles.csl+json'],['dc.xml','application/xml']]) {
    tags.push(`<link rel="alternate" type="${type}" title="${escape(r.title)}" href="${escape(exportUrl(doc,filename))}">`);
  }
  const webpage = {'@type':doc.collection==='authors'?'ProfilePage':'WebPage','@id':r.url+'#webpage',url:r.url,name:r.title,
    description:r.description,isPartOf:{'@id':site.url+'/#website'},inLanguage:r.language};
  const graph = [...site.base_graph,webpage];
  if (doc.collection==='posts') {graph.push(articleSchema(site,doc)); webpage.mainEntity={'@id':r.url+'#article'};}
  else if (doc.collection==='authors') { const author=authorsFor(site,{author:doc})[0];graph.push(author);webpage.mainEntity=author['@id']?{'@id':author['@id']}:author; }
  tags.push(`<script type="application/ld+json">${safeJson({'@context':'https://schema.org','@graph':graph})}</script>`);
  return tags.join('\n');
}

export function entryProperties(site, doc) {
  const r=publicationRecord(site,doc);
  return `<div class="entry-metadata" hidden><a class="u-url" href="${escape(r.url)}">${escape(r.title)}</a><span class="p-name">${escape(r.title)}</span><span class="p-summary">${escape(r.description)}</span><time class="dt-published" datetime="${escape(r.publishedTime)}">${escape(r.publishedTime)}</time><time class="dt-updated" datetime="${escape(r.modifiedTime)}">${escape(r.modifiedTime)}</time>${r.authors.map(author=>`<span class="p-author h-card">${author.url?`<a class="u-url" href="${escape(author.url)}"><span class="p-name">${escape(author.name)}</span></a>`:`<span class="p-name">${escape(author.name)}</span>`}${author.image?`<a class="u-photo" href="${escape(author.image)}"></a>`:''}</span>`).join('')}</div>`;
}

export function dublinCoreXml(site, doc) {
  const r=publicationRecord(site,doc);
  const fields={title:[r.title],creator:r.authors.map(a=>a.name),subject:r.tags,description:[r.description],publisher:[site.title],
    date:[r.published],type:['Text'],format:['text/html'],identifier:[...new Set([r.url,r.localUrl,...(r.doi?['https://doi.org/'+r.doi.replace(/^https?:\/\/doi.org\//,'')]:[])])],
    source:[site.url+'/'],language:[r.language],rights:doc.rights||site.rights?[doc.rights||site.rights]:[]};
  return `<oai_dc:dc xmlns:oai_dc="http://www.openarchives.org/OAI/2.0/oai_dc/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.openarchives.org/OAI/2.0/oai_dc/ http://www.openarchives.org/OAI/2.0/oai_dc.xsd">${Object.entries(fields).flatMap(([key,values])=>values.map(value=>`<dc:${key}>${escape(value)}</dc:${key}>`)).join('')}</oai_dc:dc>`;
}
