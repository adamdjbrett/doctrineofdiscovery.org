import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { files, frontMatter, isoDate, dateValue, modifiedDates, sortByModified, postUrl, outputPath, seoDescription, plainText } from './content.js';
import { templateEngine, markdownify } from './templates.js';
import { siteGraph, metadataHead, entryProperties, publicationRecord, exportUrl } from './publication.js';
import {assetManager} from './assets.js';
import {buildSearchIndex} from './search.js';

let pending;
export const resetSite = () => { pending = undefined; };
export const getSite = () => pending ||= loadSite();
export async function loadSite() {
  const site = yaml.load(fs.readFileSync('_config.yml', 'utf8'), { schema: yaml.JSON_SCHEMA.extend({ implicit: [yaml.types.merge] }) });
  site.time = process.env.BUILD_TIME || new Date().toISOString();
  site.assets = assetManager({serve:process.env.ELEVENTY_RUN_MODE==='serve'});
  site.data = Object.fromEntries(files('_data').filter(p => /\.ya?ml$/.test(p)).map(p => [path.basename(p).replace(/\.ya?ml$/, ''), yaml.load(fs.readFileSync(p, 'utf8'), { schema: yaml.JSON_SCHEMA.extend({ implicit: [yaml.types.merge] }) })]));
  const history = modifiedDates();
  site.metadata_modified_at = ['_config.yml','_data/organization.yml','lib/publication.js','lib/metadata.js']
    .map(filename=>history.get(filename)).filter(Boolean).sort((a,b)=>dateValue(b)-dateValue(a))[0];
  const sources = ['_posts','_pages','_authors'].flatMap(files).filter(p => /\.(md|markdown|html|xml)$/.test(p)).concat(['index.html','atom.xml','metadata.json']);
  const documents = [];
  for (const source of sources) {
    const { data, body } = frontMatter(fs.readFileSync(source, 'utf8'));
    const collection = source.startsWith('_posts/') ? 'posts' : source.startsWith('_authors/') ? 'authors' : 'pages';
    if (!data.date) throw new Error(`Missing publication date in front matter: ${source}`);
    const date = isoDate(data.date);
    if (data.published === false || data.draft === true || dateValue(date).toMillis() > dateValue(site.time).toMillis()) continue;
    const slug = path.basename(source).replace(/^\d{4}-\d{2}-\d{2}-/, '').replace(/\.[^.]+$/, '');
    const url = collection === 'posts' ? postUrl(data, source) : data.permalink || (collection === 'authors' ? `/authors/${slug.toLowerCase()}` : source === 'index.html' ? '/' : `/${source}`);
    const defaults = site.defaults.find(d => d.scope.type === collection)?.values || {};
    const record = { ...defaults, ...data, title: data.title || data.name, date, last_modified_at: isoDate(data.last_modified_at || history.get(source) || date),
      slug: data.slug || slug, collection, path: source, url, output: outputPath(url), raw: body, content: body,
      categories: Array.isArray(data.categories) ? data.categories : String(data.categories || '').split(/\s+/).filter(Boolean),
      tags: Array.isArray(data.tags) ? data.tags : String(data.tags || '').split(/\s+/).filter(Boolean),
      excerpt: data.excerpt || plainText(body.split(site.excerpt_separator)[0].split(/\n\s*\n/)[0]),
      front_matter_description: data.description || '', id: collection === 'posts' ? url : null };
    record.description = seoDescription(record, body);
    documents.push(record);
  }
  site.posts = documents.filter(d => d.collection === 'posts').sort(sortByModified);
  site.authors = documents.filter(d => d.collection === 'authors').sort((a,b) => a.name.localeCompare(b.name));
  site.pages = documents.filter(d => d.collection === 'pages').sort(sortByModified);
  site.related_posts = site.posts;
  site.collections = [{ label: 'posts', output: true, docs: site.posts }, { label: 'authors', output: true, docs: site.authors }];
  site.categories = {}; site.tags = {};
  for (const post of site.posts) {
    for (const key of ['categories','tags']) for (const term of post[key]) (site[key][term] ||= []).push(post);
  }
  site.author_posts = Object.fromEntries(site.authors.map(author => [author.username, site.posts.filter(p => Array.isArray(p.author) ? p.author.includes(author.username) : p.author === author.username)]));
  for (let index = 0; index < site.posts.length; index++) {
    const small = record => record ? { title: record.title, url: record.url } : null;
    site.posts[index].previous = small(site.posts[index + 1]);
    site.posts[index].next = small(site.posts[index - 1]);
  }
  site.static_files = files('assets').map(p => ({ path: `/${p}`, name: path.basename(p), extname: path.extname(p),
    pdf: p.startsWith('assets/pdfs/') && p.endsWith('.pdf'), modified_time: fs.statSync(p).mtime.toISOString() }));
  site.base_graph = siteGraph(site);
  const templates = templateEngine(site);
  site.masthead_html = templates.engine.renderFileSync('masthead.html', { site });
  site.footer_html = templates.engine.renderFileSync('footer.html', { site });
  const context = page => ({ site, page, jekyll: { environment: process.env.ELEVENTY_ENV || 'production' }, paginator: page.paginator });
  for (const document of documents) {
    const rendered = templates.engine.parseAndRenderSync(document.raw, context(document));
    document.content = /\.(md|markdown)$/.test(document.path) ? markdownify(rendered) : rendered;
    document.word_count = templates.engine.evalValueSync('body | strip_html | number_of_words', { body: document.content });
  }
  site.search_bundle = site.search ? await buildSearchIndex(site) : null;
  const homepage = documents.find(d => d.url === '/');
  const homepagePosts = [...site.posts].sort((a,b) => dateValue(b.date)-dateValue(a.date) || a.url.localeCompare(b.url));
  const totalPages = Math.ceil(homepagePosts.length / site.paginate);
  for (let page = 1; page <= totalPages; page++) {
    const record = page === 1 ? homepage : { ...homepage, url: site.paginate_path.replace(':num', page) };
    record.output = outputPath(record.url);
    record.paginator = { page, total_pages: totalPages, total_posts: site.posts.length, per_page: site.paginate,
      posts: homepagePosts.slice((page-1)*site.paginate,page*site.paginate), first_page_path: '/', previous_page: page>1 ? page-1 : null, next_page: page<totalPages ? page+1 : null };
    if (page > 1) documents.push(record);
  }
  for (const doc of documents) {
    if (!doc.redirect_to) {
      doc.publication = publicationRecord(site,doc);
      doc.citation_urls = {ris:exportUrl(doc,'citation.ris'),csl:exportUrl(doc,'citation.csl.json')};
      doc.head_metadata = metadataHead(site,doc);
      doc.entry_properties = entryProperties(site,doc);
    }
    if (doc.redirect_to) doc.html = redirectHtml(doc.redirect_to, site.url);
    else doc.html = site.assets.renderImages(site.assets.renderIcons(templates.layout(doc.layout, context(doc), doc.content)));
  }
  const redirects = {};
  const staticUrls = new Set(site.static_files.map(file => file.path));
  for (const doc of documents) {
    for (const url of [doc.redirect_from || []].flat()) {
      if (staticUrls.has(url) || documents.some(d => d.url === url)) continue;
      redirects[url] = new URL(doc.url, site.url).href;
      documents.push({ url, output: outputPath(url), html: redirectHtml(doc.url, site.url) });
    }
    if (doc.redirect_to) redirects[doc.url] = new URL(doc.redirect_to, site.url).href;
  }
  return { site, documents, redirects };
}
export function redirectHtml(target, base) {
  const url = new URL(target, base);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error(`Unsafe redirect: ${target}`);
  const escaped = url.href.replaceAll('&', '&amp;').replaceAll('"', '&quot;');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Redirecting…</title><link rel="canonical" href="${escaped}"><meta http-equiv="refresh" content="0;url=${escaped}"><meta name="robots" content="noindex"></head><body><a href="${escaped}">Continue to the requested page</a></body></html>`;
}
