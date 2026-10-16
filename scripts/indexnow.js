import fs from 'node:fs';
import yaml from 'js-yaml';
import { withKey, submitIndexNow } from '../lib/indexnow.js';

const flags=process.argv.slice(2);
if (flags.some(flag=>!['--submit','--dry-run'].includes(flag)) || (flags.includes('--submit')&&flags.includes('--dry-run'))) throw new Error('Use --dry-run (default) or --submit.');
const manifest=withKey(JSON.parse(fs.readFileSync('_site/indexnow.json','utf8')),yaml.load(fs.readFileSync('src/_config.yml','utf8')).indexnow.key);
if (flags.includes('--submit')) console.log(`IndexNow accepted ${await submitIndexNow(manifest,manifest.records.map(record=>record.url))} URLs.`);
else console.log(`IndexNow dry run: ${manifest.records.length} URLs for ${manifest.host}. Review _site/indexnow.json; add --submit after deploying to notify IndexNow.`);
