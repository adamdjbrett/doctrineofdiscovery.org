# Build and preview performance

Measured locally October 15, 2026. No dependency or browser bundle was added.

The supplied terminal output contains 1,010 lines, mostly normal per-file writes.
It shows two successful runs, reporting 6.08 and 6.00 seconds, followed by watch
mode; the second also confirms localhost:8080. All pages originate from
`site.11ty.js` because that template paginates the prepared document records.
These lines are not errors or evidence that a page was generated twice in one run.

A CPU profile identified Liquid's per-token Promise/generator handling as the
largest cost, with repeated content processing and taxonomy loops adding work.

| Check | Before | After |
| --- | --- | --- |
| Full production build | 6.00–6.08 s in supplied log; 5.76 s profiled locally | 3.18, 3.12, 3.16 s; median 3.16 s |
| New post visible in preview | Not measured separately | 2.605 s including watch delay and HTTP polling |
| Edited post visible in preview | Not measured separately | 2.690 s including watch delay and HTTP polling |
| CSS/JS source change available over HTTP | Required normal site rebuild | 0.9 ms / 4.7 ms; no HTML/metadata writes |
| Automated test suite | Roughly 22 s before these changes | 16 passing tests; render-heavy site test fell to about 2.15 s in the isolated run |

These are local observations with filesystem caches and varying background load,
not a controlled cross-machine benchmark. The production median is about 47%
lower than the six-second run in the supplied log.

## Changes

- Use Liquid's synchronous renderer for this site's synchronous filters, includes,
  and layouts. The `where_exp` and `group_by_exp` filters also render synchronously.
  Future asynchronous filters would require revisiting this choice.
- Cache Markdown filter results for the lifetime of one site render. Parse dates
  through a bounded cache of immutable Luxon values. Calculate reading-time word
  counts once per document instead of once per archive appearance.
- Render the site-only masthead and footer once per build; includes remain editable
  in their existing locations and regenerate when content/configuration rebuilds.
- Sort populated taxonomy entries once, preserving the old count order and stable
  tie order, instead of scanning every possible count twice in Liquid.
- Quiet the dev command's individual page-write messages; summaries and errors remain.
- Use Eleventy's [emulated passthrough copy](https://www.11ty.dev/docs/copy/#emulate-passthrough-copy-during---serve)
  in preview. The [dev server watcher](https://www.11ty.dev/docs/dev-server/)
  reloads source CSS/JS directly. Production still copies the full asset set.
  PDFs/images retain normal rebuild behavior because archive pages depend on them.
  Preview output outside the repository uses ordinary copying because the dev
  server restricts source aliases to paths inside the project directory.
- Prefer generated citations in the preview server, with historical source files
  available as fallbacks. This prevents passthrough aliases from serving old
  citation contents instead of the regenerated versions.

The comparison also exposed three historical citation paths listed as both source
assets and redirects. Parallel copying/rendering could produce either actual
citation data or redirect HTML at those same URLs. Redirect generation now leaves
existing static files intact, preserving the BibTeX/RIS/XML downloads under
`assets/pdfs/citation-formats/modrow-smith-inter-caetera-scholar.*`.

## Validation

All 785 HTML pages preserve their pre-optimization markup; only category/tag
index whitespace changes. CSS, JavaScript, per-post metadata, generated citations,
feeds, sitemaps, and Standard.site data are unchanged. The three historical
citation files now deterministically match their source data; `redirects.json`
no longer redirects those downloads.

Production verification passes: 785 HTML pages, 496 metadata records, 823 citation
pairs, 505 Standard.site documents. Sixteen tests pass, including stable taxonomy
ordering, synchronous expression filters, and static-file collision protection.

Live preview checks verified:
- Browser CSS live reload updates without manually refreshing.
- CSS and JS HTTP responses reflect edits without modifying HTML/metadata files.
- A temporary new post and its edit update page HTML, search store, per-post
  metadata, and Standard.site data together.
- Generated search/citation responses match their output files.

Temporary edits/posts were removed and the verification server stopped. No
Netlify deployment or commit was performed. Content changes still render the
shared site; this optimization does not introduce partial-content caching.
