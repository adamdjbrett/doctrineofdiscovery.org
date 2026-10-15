import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { files, frontMatter, isoDate, calendarDate } from '../lib/content.js';

const sources = ['_posts', '_pages', '_authors', '_drafts'].flatMap(files)
  .filter(p => /\.(md|markdown|html|xml)$/.test(p)).concat(['index.html', 'atom.xml', 'metadata.json']);
let added = 0;
for (const filename of sources) {
  const text = fs.readFileSync(filename, 'utf8');
  const { data } = frontMatter(text);
  if (data.date) { isoDate(data.date); continue; }
  const namedDate = filename.split('/').at(-1).match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  const history = namedDate ? [] : execFileSync('git', ['log', '--follow', '--format=%cI', '--', filename], { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
  const date = namedDate || history.at(-1);
  if (!date) throw new Error(`Cannot infer publication date: ${filename}`);
  isoDate(date);
  const match = text.startsWith('---') ? text.match(/^---[ \t]*\r?\n([\s\S]*?)^---[ \t]*(?:\r?\n|$)/m) : null;
  const dated = match
    ? text.replace(match[0], match[0].replace(/\r?\n---[ \t]*(?:\r?\n|$)$/, `\ndate: ${namedDate ? calendarDate(date) : isoDate(date)}\n---\n`))
    : `---\ndate: ${isoDate(date)}\n---\n${text}`;
  fs.writeFileSync(filename, dated);
  added++;
}
console.log(`Added ${added} publication dates; existing dates preserved.`);
