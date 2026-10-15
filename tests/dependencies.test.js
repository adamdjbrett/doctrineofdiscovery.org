import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { execFileSync } from 'node:child_process';
import chokidar from 'chokidar';

test('native directory watcher detects additions, edits and deletions', { timeout: 15000 }, async t => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'dod-watch-'));
  const watcher = chokidar.watch(folder, { ignoreInitial: true, usePolling: true, interval: 25, awaitWriteFinish: { stabilityThreshold: 50, pollInterval: 10 } });
  t.after(async () => { await watcher.close(); fs.rmSync(folder, { recursive: true, force: true }); });
  await once(watcher, 'ready');
  const filename = path.join(folder, 'article.md');
  let event = once(watcher, 'add');
  fs.writeFileSync(filename, 'First version');
  assert.equal((await event)[0], filename);
  await delay(50);
  event = once(watcher, 'change');
  fs.appendFileSync(filename, '\nUpdated version');
  assert.equal((await event)[0], filename);
  await delay(50);
  event = once(watcher, 'unlink');
  fs.unlinkSync(filename);
  assert.equal((await event)[0], filename);
});

test('Eleventy parses YAML front matter with the deduplicated YAML 4 dependency', () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'dod-yaml-'));
  try {
    fs.writeFileSync(path.join(folder, 'eleventy.config.cjs'), 'module.exports = () => ({ templateFormats: ["md"] });');
    fs.writeFileSync(path.join(folder, 'index.md'), '---\ntitle: Security smoke test\nsettings: &settings\n  label: Alias works\ncopy: *settings\n---\n# {{ title }}\n\n{{ copy.label }}\n');
    execFileSync(process.execPath, ['node_modules/@11ty/eleventy/cmd.cjs', `--input=${folder}`, `--output=${folder}/out`, `--config=${folder}/eleventy.config.cjs`, '--quiet'], { stdio: 'pipe' });
    const html = fs.readFileSync(path.join(folder, 'out/index.html'), 'utf8');
    assert.match(html, /<h1>Security smoke test<\/h1>/);
    assert.match(html, /<p>Alias works<\/p>/);
  } finally { fs.rmSync(folder, { recursive: true, force: true }); }
});
