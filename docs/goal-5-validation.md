# Goal 5: Pagefind and less browser JavaScript

Implemented October 15, 2026. Stop here for the user's commit and Netlify
validation. Google Analytics was already deferred during Goal 4; that behavior
and its configured tracking ID remain.

## Changes

- Removed the vendored Lunr library and generated 403,434-byte JSON store.
  Pagefind 1.5.2 is pinned as one build-time dependency, with its matching
  optional platform binary. Clean `npm ci` reports zero vulnerabilities.
- The index contains 614 public content records, including complete article
  bodies, author biographies, titles, tags, and categories. The previous store
  truncated excerpts. Navigation, shared footers, redirects, drafts, `noindex`,
  excluded sitemap documents, search, and pagination clones are not indexed.
  Hidden source pages remain excluded, matching the old search scope.
- Kept the existing search page, overlay, and theme result styling. Focus
  loads the small controller; entering a query loads Pagefind's API, WASM,
  relevant index chunks, and the first ten result fragments. “Show more
  results” loads the next ten. Counts/errors are visible and announced by a
  live region. New queries invalidate pending results.
- Search URLs use an explicit root base, independent of the bundle's nested
  directory. The complete bundle has a content-hashed directory covered by
  the existing immutable-cache header. Metadata cache tags are also stable
  for that bundle. No additional HTTP header was needed.
- Omitted Pagefind's prebuilt UI, UI styles, highlight helper, and worker
  bundle. The API uses `noWorker: true` to avoid downloading a duplicate
  worker runtime; the WASM engine searches on the main thread. Query results
  are paginated to limit fragment downloads and DOM work.
- Generated heading permalinks during layout rendering, keeping document IDs
  and TOC labels. Replaced JS video wrappers with CSS aspect ratios derived
  from existing iframe dimensions. Existing responsive embed wrappers work.
- Moved the native image viewer into a module loaded only on the first image
  click, with ordinary-link fallback on failure. TOC behavior loads only on
  pages configured with a TOC. Removed redundant navigation recalculations
  after image/font loading; logo dimensions and fonts are already stable.
- Cached shared search and script markup using the same approach as the
  existing masthead/footer caches. Dev CSS/JS reloads still skip page/index
  rebuilds. Content builds regenerate the search index.

## Size measurements

These measurements concern the initial external application script files.
The unchanged inline no-JS toggle and analytics bootstrap, Google's scripts,
and optional modules that load later are excluded.

| Initial scripts on a page without a TOC | Before | After |
| --- | --- | --- |
| Raw JavaScript | 11,226 bytes | 3,807 bytes |
| gzip equivalent | 3,938 bytes | 1,315 bytes |

Initial application JavaScript fell **66.1%** by raw size. TOC pages add a
989-byte script. The gallery module is 2,650 bytes and loads on first use.
Pagefind's engine is an additional on-demand runtime, not part of the initial
3,807 bytes. Its JS API is larger than the old Lunr library, but it removes
browser-side index construction and whole-store fetching; no search-engine
request occurs during ordinary page loading.

## Validation

- All 31 tests passed, including full-text eligibility, bundle hashing and
  output, static heading/video behavior, conditional script loading, dates,
  citations, metadata, OAI, and mocked IndexNow submission guards.
- Production verification passed: 787 HTML pages, 497 metadata records,
  824 legacy citation pairs, and 506 Standard.site documents. The verifier
  checks lazy-module URLs, Pagefind entry/index chunks, and absence of Lunr
  and unused Pagefind UI/worker bundles.
- All 650 existing primary SEO descriptions were compared and unchanged.
- Browser checks passed for direct query URLs, the overlay, root result URLs,
  highlighted excerpts, ten-to-twenty-result pagination, stale-query clearing,
  and lazy image-viewer opening. No worker request was made.
- A mobile production-style Lighthouse run retained 100 performance,
  100 accessibility, 100 best practices, and 100 SEO, with 1.6-second LCP.
  Full reports are under `/private/tmp/dod-goal5/`.
- The populated search page also scored 100 accessibility, 100 best practices,
  and 100 SEO. Performance was not included in that additional search-state
  audit. The tracked [measurement summary](lighthouse-goal-5.json) records
  exact metrics and full-report paths.

Full builds now include native full-text indexing. The final production build
took **3.97 seconds**, and the dev server started in 4.67 seconds. A content
rebuild took 3.44 seconds; CSS edits skipped both page and index builds.
Earlier exploratory timings were noisy; an older non-listening Eleventy
watcher was found repeatedly rebuilding and stopped. Pagefind indexing is
extra build work; do not interpret the smaller initial browser payload as a
claim that full builds became faster.

Development checks also covered direct query URLs, generated bundle serving,
zero-result searches, visible load-error handling, responsive video sizing,
and no horizontal overflow at a 390-pixel viewport. The dev server was stopped
and `_site/` restored to production output. Temporary servers are stopped
after measurements.

## Netlify review

Deploy with the checked-in lockfile and normal optional dependencies enabled.
Check `/search/?q=Declaration%20Independence`, the search overlay, “Show more
results,” result URLs, gallery opening/closing, video sizing, TOC behavior,
and Lighthouse on the preview. New index contents must produce a new bundle
directory. Confirm citation/SEO/OAI endpoints and analytics collection too.

No deployment, commit, push, or real IndexNow notification was performed by
the agent. Native Pagefind execution was checked on this Mac; Netlify's Linux
installation and deployed HTTP behavior remain deployment checks.
