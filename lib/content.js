import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import yaml from 'js-yaml';
import { DateTime } from 'luxon';

export const timezone = yaml.load(fs.readFileSync('_config.yml', 'utf8')).timezone;
export function files(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const name = path.posix.join(directory, entry.name);
    return entry.name.startsWith('.') ? [] : entry.isDirectory() ? files(name) : [name];
  }).sort();
}
export function frontMatter(text) {
  const match = text.startsWith('---') ? text.match(/^---[ \t]*\r?\n([\s\S]*?)^---[ \t]*(?:\r?\n|$)/m) : null;
  return { data: match ? yaml.load(match[1], { schema: yaml.JSON_SCHEMA.extend({ implicit: [yaml.types.merge] }) }) || {} : {},
    body: match ? text.slice(match[0].length) : text };
}
const dateCache = new Map();
export function dateValue(value) {
  const text = value instanceof Date ? value.toISOString() : String(value);
  if (dateCache.has(text)) return dateCache.get(text);
  const date = DateTime.fromISO(text.replace(' ', 'T'), { zone: timezone });
  if (!date.isValid) throw new Error(`Invalid date: ${text}`);
  if (dateCache.size >= 2048) dateCache.clear();
  dateCache.set(text, date);
  return date;
}
export const isoDate = value => dateValue(value).toISO();
export const calendarDate = value => dateValue(value).toFormat('yyyy-MM-dd');
export function modifiedDates() {
  const dates = new Map();
  try {
    const history = execFileSync('git', ['-c', 'core.quotepath=false', 'log', '--format=DATE:%cI', '--name-only', '--',
      '_posts', '_pages', '_authors', 'index.html', 'atom.xml', 'metadata.json', '_config.yml', '_data/organization.yml', 'lib/publication.js', 'lib/metadata.js'], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
    let date;
    for (const line of history.split('\n')) {
      if (line.startsWith('DATE:')) date = line.slice(5);
      else if (line && !dates.has(line)) dates.set(line, date);
    }
  } catch {
    console.warn('Git history unavailable; using explicit modified dates or publication dates.');
  }
  return dates;
}
export const sortByModified = (a, b) => dateValue(b.last_modified_at || b.date).toMillis()
  - dateValue(a.last_modified_at || a.date).toMillis() || a.url.localeCompare(b.url, 'en');
export function outputPath(url) {
  if (!url.startsWith('/') || url.includes('..') || /[?#]/.test(url)) throw new Error(`Invalid local URL: ${url}`);
  if (url.endsWith('/')) return `${url.slice(1)}index.html`;
  return url.slice(1) + (path.posix.extname(url) ? '' : '.html');
}
export function postUrl(data, filename) {
  const slug = data.slug || path.basename(filename).replace(/^\d{4}-\d{2}-\d{2}-/, '').replace(/\.[^.]+$/, '');
  const categories = Array.isArray(data.categories) ? data.categories : String(data.categories || '').split(/\s+/).filter(Boolean);
  return data.permalink || `/${[...categories.map(c => String(c).toLowerCase().replace(/\s+/g, '-')), slug].join('/')}/`;
}
export function plainText(value = '') {
  return String(value).replace(/{%[\s\S]*?%}|{{[\s\S]*?}}/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]*>/g, ' ').replace(/[`*_>#~]/g, '').replace(/\s+/g, ' ').trim();
}
export function seoDescription(data, body) {
  if (data.seo_description_lock === true || String(data.description || '').trim().length >= 150) return data.description;
  let text = plainText(data.description || data.excerpt || `${data.title || ''}. ${body}`).replace(/-/g, ' ');
  if (text.length < 150) text += '. Explore historical documents, analysis, and updates on the Doctrine of Discovery and its continuing impact on Indigenous peoples, law, and society.';
  if (text.length > 160) text = text.slice(0, 161).replace(/\s+\S*$/, '').replace(/[.,;:!?\s]+$/, '');
  return text;
}
