import fs from 'node:fs';
import { Liquid } from 'liquidjs';
import MarkdownIt from 'markdown-it';
import attrs from 'markdown-it-attrs';
import footnote from 'markdown-it-footnote';
import deflist from 'markdown-it-deflist';
import { frontMatter, dateValue, plainText } from './content.js';

export const markdown = new MarkdownIt({ html: true, linkify: true, typographer: true }).use(attrs).use(footnote).use(deflist);
const escape = markdown.utils.escapeHtml;
const headingOpen = markdown.renderer.rules.heading_open;
markdown.renderer.rules.heading_open = (tokens, index, options, env, renderer) => {
  const token = tokens[index];
  // Match Kramdown's dash typography next to numbers so old heading links survive.
  for (const child of tokens[index + 1].children) if (child.type === 'text') child.content = child.content.replace(/--(?=\d)/g, '–');
  const title = tokens[index + 1].children.filter(t => ['text','code_inline','image'].includes(t.type)).map(t=>t.content).join('');
  const slug = title.toLowerCase().replace(/[^\p{L}\p{N}\p{M}\p{Pc}\- \t]/gu, '').replace(/[ \t]/g, '-');
  env.headingIds ||= new Map();
  const count = env.headingIds.get(slug) || 0;
  env.headingIds.set(slug, count + 1);
  if (!token.attrGet('id')) token.attrSet('id', slug + (count ? `-${count}` : ''));
  return headingOpen ? headingOpen(tokens, index, options, env, renderer) : renderer.renderToken(tokens, index, options);
};
markdown.renderer.rules.footnote_anchor_name = (tokens, index) => String(tokens[index].meta.id + 1);
markdown.renderer.rules.footnote_ref = (tokens, index) => {
  const { id, subId, label } = tokens[index].meta;
  return `<sup id="fnref:${escape(label || String(id + 1))}${subId ? `:${subId}` : ''}"><a href="#fn:${escape(label || String(id + 1))}" class="footnote" role="doc-noteref">${id + 1}</a></sup>`;
};
markdown.renderer.rules.footnote_block_open = () => '<div class="footnotes" role="doc-endnotes">\n<ol>\n';
markdown.renderer.rules.footnote_block_close = () => '</ol>\n</div>\n';
markdown.renderer.rules.footnote_open = (tokens, index) => `<li id="fn:${escape(tokens[index].meta.label || String(tokens[index].meta.id + 1))}" class="footnote-item">`;
markdown.renderer.rules.footnote_anchor = (tokens, index) => `<a href="#fnref:${escape(tokens[index].meta.label || String(tokens[index].meta.id + 1))}${tokens[index].meta.subId ? `:${tokens[index].meta.subId}` : ''}" class="reversefootnote" role="doc-backlink">↩</a>`;
export const markdownify = value => markdown.render(String(value ?? '').replace(/\{:\s*([^}\n]+)\}/g, '{$1}').replace(/>\s*\n\s*</g, '>\n<'));

export function tableOfContents(html) {
  const root = [];
  const stack = [{ level: 0, children: root }];
  for (const match of String(html).matchAll(/<h([1-6])\b[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)<\/h\1>/g)) {
    if (/class="[^"]*no_toc/.test(match[0])) continue;
    const [, level, id, title] = match;
    while (stack.length > 1 && stack.at(-1).level >= Number(level)) stack.pop();
    const node = { level: Number(level), id, title: markdown.utils.unescapeAll(plainText(title)), children: [] };
    stack.at(-1).children.push(node); stack.push(node);
  }
  const list = (nodes, top = false) => `<ul${top ? ' class="toc__menu"' : ''}>${nodes.map(node => `<li><a href="#${escape(node.id)}">${escape(node.title)}</a>${node.children.length ? list(node.children) : ''}</li>`).join('')}</ul>`;
  return root.length ? list(root, true) : '';
}

export function templateEngine(site) {
  const engine = new Liquid({ root: '_includes', extname: '', cache: true, dynamicPartials: true,
    strictFilters: true });
  const markdownCache = new Map();
  engine.registerFilter('markdownify', value => {
    const text = String(value ?? '');
    if (!markdownCache.has(text)) markdownCache.set(text, markdownify(text));
    return markdownCache.get(text);
  });
  engine.registerFilter('compact_html', value => String(value).replace(/>\s+</g, '><'));
  engine.registerFilter('plain_text', plainText);
  engine.registerFilter('jsonify', value => JSON.stringify(value ?? null));
  engine.registerFilter('normalize_whitespace', value => String(value || '').replace(/\s+/g, ' ').trim());
  engine.registerFilter('number_of_words', value => plainText(value).split(/\s+/).filter(Boolean).length);
  engine.registerFilter('relative_url', value => {
    const url = typeof value === 'object' ? value?.path : value;
    if (!url) return '';
    return /^(?:https?:|mailto:|\/\/|#)/.test(url) ? url : `/${String(url).replace(/^\//, '')}`;
  });
  engine.registerFilter('absolute_url', value => {
    const url = typeof value === 'object' ? value?.path : value;
    return url ? new URL(String(url), site.url).href : '';
  });
  engine.registerFilter('slugify', value => String(value).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, ''));
  engine.registerFilter('xml_escape', escape);
  engine.registerFilter('date_to_xmlschema', value => value ? dateValue(value).toISO() : '');
  engine.registerFilter('date', (value, format = '%Y-%m-%d') => {
    if (!value) return '';
    const date = dateValue(value);
    const parts = { '%Y': 'yyyy', '%m': 'MM', '%-m': 'M', '%d': 'dd', '%-d': 'd', '%B': 'LLLL', '%b': 'LLL', '%H': 'HH', '%M': 'mm', '%S': 'ss', '%z': 'ZZZ' };
    return String(format).replace(/%-?[YmdBbHMSz]/g, key => date.toFormat(parts[key]));
  });
  engine.registerFilter('where_exp', (values, variable, expression) => {
    const parsed = engine.parse(`{% if ${expression} %}1{% endif %}`);
    const results = (values || []).map(value => engine.renderSync(parsed, { [variable]: value }));
    return (values || []).filter((_, index) => results[index] === '1');
  });
  engine.registerFilter('group_by_exp', (values, variable, expression) => {
    const parsed = engine.parse(`{{ ${expression} }}`);
    const groups = new Map();
    for (const value of values || []) {
      const name = engine.renderSync(parsed, { [variable]: value });
      if (!groups.has(name)) groups.set(name, []);
      groups.get(name).push(value);
    }
    return [...groups].map(([name, items]) => ({ name, items }));
  });
  engine.registerFilter('sort_taxonomies', values => Object.entries(values || {})
    .filter(([, posts]) => posts.length).sort((a, b) => b[1].length - a[1].length));
  engine.registerFilter('table_of_contents', tableOfContents);
  // All site filters are synchronous; avoid Promise overhead for each Liquid token.
  const layouts = new Map();
  return {
    engine,
    layout(name, context, content) {
      if (!name || name === 'none') return content;
      if (!layouts.has(name)) {
        const { data, body } = frontMatter(fs.readFileSync(`_layouts/${name}.html`, 'utf8'));
        layouts.set(name, { data, tokens: engine.parse(body) });
      }
      const { data, tokens } = layouts.get(name);
      const rendered = engine.renderSync(tokens, { ...context, content, layout: data });
      return this.layout(data.layout, context, rendered);
    }
  };
}
