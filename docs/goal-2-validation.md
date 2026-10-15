# Goal 2: Eleventy, plain CSS, and native JavaScript

Validated October 15, 2026. This report covers Goal 2 only. Expanded metadata,
OAI-PMH, IndexNow, Lighthouse certification, Pagefind, and Analytics deferral
remain later goals. No commit, push, or Netlify deployment was performed.

## What changed

- Replaced Jekyll with Eleventy 3.1.6 on Node 24. The build no longer needs
  Ruby, Bundler, Jekyll plugins, or a theme package.
- Kept `_posts/`, `_pages/`, `_authors/`, YAML front matter, and local Liquid
  templates. `site.11ty.js` uses Eleventy pagination to publish the prepared
  records; `lib/site.js` prepares shared indexes and renders their templates.
- Ported citation generation, SEO descriptions, per-post metadata, and
  Standard.site outputs to tracked build-time JavaScript. Historical citation
  files are retained alongside regenerated post citations.
- Converted the existing stylesheet to readable `assets/css/main.css` and
  removed the Sass sources and compilation dependency.
- Removed jQuery, Magnific Popup, greedy navigation, FitVids, Gumshoe,
  throttling, smooth-scroll plugins, and their old bundles/source maps.
- Preserved the Jekyll theme's greedy navigation, Follow dropdown, search overlay,
  heading permalinks, nested TOC, and gallery CSS classes. Small vanilla scripts
  replace their jQuery behavior; gallery focus handling uses a native dialog.
- Search remains Lunr for this goal, with a vanilla JavaScript loader. Its library
  and JSON data load only after a nonempty search, including the restored overlay.
  Pagefind remains Goal 5.
- Removed duplicate Analytics markup and restricted CAPTCHA to the contact
  form. Analytics loading itself is still immediate, pending Goal 5.
- Removed unused theme layouts/includes and Ruby build configuration. Build
  source files and historical development documents are no longer published.
- Updated Netlify's build/runtime settings, preserved redirects and CMS paths,
  and added MIME-sniffing/referrer headers with revalidation for unversioned
  assets. A strict CSP was not introduced because forms and embedded services
  require separate compatibility work.

## Dates and ordering

`timezone: America/New_York` in `_config.yml` is the timezone used by the
build. Date-only values and timestamps without offsets use New York time;
explicit offsets are respected and converted consistently. Tests cover
winter, summer, and a UTC timestamp crossing the local calendar boundary.

Added 463 publication dates to front matter:

| Content | Added dates | Evidence |
| --- | ---: | --- |
| Posts | 304 | Dated filenames |
| Pages | 72 | Earliest Git commit, following renames |
| Authors | 74 | Earliest Git commit, following renames |
| Drafts | 10 | Filename or earliest Git commit |
| Root content templates | 3 | Earliest Git commit |

All 662 content documents now have valid publication dates. Six posts had
malformed date strings; those were normalized to the same publication
instants Jekyll had interpreted, including the existing years. One of those
posts also had the same malformed modification date corrected.

Explicit `last_modified_at` values are preserved. Missing modification values
are read from each source file's latest Git commit at build time. Files not
covered by the available history fall back to publication dates. A source
export without Git history remains buildable with that fallback. Filesystem
copy dates are not used.

The homepage, category/tag archives, and author post listings use modification
order with publication fallback and URL tie-breaking. Year archives group by
publication year, using modification order within each year. The Atom feed
remains in publication order and distinguishes publication/update timestamps.

CMS post/page editors retain publication-date fields and offer an optional
modification-date override. New category pages now also receive a date field.

## Verification

- Clean local clone plus the pending changes: `npm ci`, `npm run build`,
  `npm test`, and `npm run verify`.
- Ten automated checks cover timezone/DST behavior, front matter, publication
  dates, modification ordering, URL preservation, redirects, Markdown
  compatibility, SEO descriptions, Git fallback, citation records, and shared
  indexes. Related posts exclude the current article.
- The generated-site verifier confirms all **785 existing public HTML pages**,
  referenced theme assets and citation downloads, **496 metadata records**,
  **823 matched citation pairs**, and **505 Standard.site documents**.
- Feeds and XML sitemaps parse successfully. No Sass or jQuery vendor files
  are published, and no unprocessed front matter/Liquid remains in HTML.
- Compared every existing heading anchor against Goal 1: none were lost.
  Footnote label anchors, Markdown tables, Kramdown attribute syntax, and
  included HTML galleries have dedicated regression coverage.
- Reviewed the two body-text count outliers: one now renders a Markdown list
  inside a blockquote correctly; the PDF archive now lists actual PDFs rather
  than also listing DOCX/BibTeX/RIS/XML files. Those other downloads remain
  available at their existing asset URLs.
- Desktop at 1440 pixels and mobile at 390 pixels had no horizontal overflow.
  Desktop primary links and the original overflow menu remained accessible.
- Browser search returned 313 results for `Discovery`, without jQuery.
- Gallery checks verified opening, image navigation, modal focus, closing,
  and focus restoration. Contact form submission was not sent.
- Preview addition/edit checks verified that HTML and metadata rebuild
  together. The temporary test document was removed, and the production
  rebuild removed its generated output. The preview server required execution
  outside the filesystem sandbox during validation.
- `git diff --check` passes.

## Measurements

The Goal 1 clean Jekyll build reported 154.169 seconds. Eleventy verification
builds generally completed in roughly 5–7 seconds; a run under concurrent
local load took longer. These are local verification measurements, not a
controlled performance benchmark or a Lighthouse score.

| Measure | Goal 1 | Goal 2 |
| --- | ---: | ---: |
| Homepage local JS files | 4 | 2 |
| Homepage local JS bytes | 471,107 | 11,115 |
| Homepage local JS gzip bytes | 120,628 | 3,881 |
| Locked npm packages, excluding root | 165 | 119 |
| Required Ruby gems | 49 | 0 |

JavaScript measurements exclude third-party Analytics and embedded services.
The small search loader preserves the theme overlay; Lunr and search data load on first use.
Readable HTML/CSS increases total uncompressed output from about 116.7 MB to
119.9 MB; Netlify handles transfer compression. No new HTML minifier was added.

## Remaining limits

- Git commit times are an accepted approximation of modification dates. A
  formatting/date-backfill commit also counts as a modification; shallow Git
  history can cause publication-date fallbacks for older files.
- The dependency follow-up below resolves the initial npm audit findings. Targeted
  overrides remain necessary until Eleventy updates its legacy dependency ranges.
- Live Netlify deployment, account integrations, CMS authentication, CAPTCHA
  verification, and contact delivery require the user's deploy-preview check.
- Existing metadata inconsistencies and historical static citation records
  remain for Goal 3. This goal does not claim four Lighthouse 100 scores.

## Jekyll appearance compatibility follow-up

The original compiled theme CSS remains the base stylesheet. Restored theme DOM
classes replace the initial Goal 2 disclosure-menu redesign. YAML merge aliases
now resolve language labels correctly; reading-time division follows Jekyll's
integer behavior. Nested TOC and footnote wrappers follow the old theme markup.
The build uses the same templates and assets for development and production.

Browser verification compared the saved Goal 1 Jekyll build with Eleventy:
- What-is page: zero differing screenshot pixels at 1440×1000 and 390×844.
- Inter Caetera: matching title/content start, nested TOC dimensions, typography,
  and footnote block height. Screenshot differences were limited to logo pixels.
- Assertions passed for overflow menu open/close, Follow toggle, search overlay
  focus/Escape, 313 Discovery search results, gallery open/next/close, and no jQuery.
- All 785 HTML files plus the stylesheet are byte-identical across fixed-time
  development and production builds. Both complete outputs pass the route/asset,
  citation, metadata, and XML verifier. Eleven automated tests pass.

The approved Git modification dates and archive order differ from Jekyll; the
footer accurately credits Eleventy. This is representative browser verification,
not an exhaustive pixel comparison of all pages or a live Netlify validation.

## Responsive viewport follow-up

The existing device-width viewport and theme breakpoints are retained, with
browser zoom allowed. Long URLs/citations now wrap within page, archive, and
footer columns; fieldsets can shrink below their intrinsic minimum width.
The contact form uses the compact CAPTCHA to fit narrow screens (164 pixels
rather than the normal 304-pixel widget). This intentionally changes the widget's
appearance at desktop widths too, without adding resize JavaScript.
Google documents the size option at https://developers.google.com/recaptcha/docs/display.

Browser checks passed for eight routes (home, Inter Caetera, contact, search,
what-is, categories, gallery article, PDF archive) at 320, 375, 390, 640, 767,
768, 1023, 1024, 1279, 1280, 1440, and 1920 pixels, both with the overflow menu
closed and open: 192 checks with no document overflow. Resizing occurred without
reloading each page, exercising the navigation's resize behavior. A separate
320-pixel mobile-emulation check confirmed viewport width equals document width
and the CAPTCHA fits the 288-pixel form. Production build verification and
`git diff --check` pass. No form was submitted; physical devices were not tested.

## Dependency security follow-up

A clean `npm ci` installs 119 packages and reports zero vulnerabilities with no
unreviewed install scripts. `npm audit fix` updated the dev server to 2.1.2.
Root overrides replace Chokidar 3 with Eleventy's own
`@11ty/chokidar-with-glob-support` 1.1.0 adapter, retaining glob-based targets and
ignore rules while using Chokidar 4. Its inner Chokidar dependency is explicitly
kept on version 4 to avoid a recursive alias. The obsolete optional `fsevents`
package and its blocked install script are removed from the dependency tree.

The gray-matter override reuses the site's YAML 4 dependency, matching Eleventy's
own root override. Eleventy already supplies its YAML 4 parser to gray-matter;
no deprecated `safeLoad` call is needed by the build. This removes the older
argparse/sprintf-js chain. Both reported vulnerable packages had no published
patch, so replacing the dependency chains avoids the advisories without hiding
them or downgrading Eleventy. Advisory references:
https://github.com/advisories/GHSA-vfj7-8cjw-p6xm and
https://github.com/advisories/GHSA-hp3w-g68c-fv3c.

Regression checks cover watcher glob additions/edits/deletions and an actual
Eleventy Markdown/YAML build with aliases. The full test suite passes (13 tests).
A live `npm run dev` check on localhost:8080 rebuilt a temporary new post and its
edit; the post was removed and the test server stopped. All generated HTML,
CSS and JS remained byte-identical after the dependency changes, and production
output verification passes. The npm funding message is informational and remains
enabled. No deployment or commit was performed.

## Build performance follow-up

See [build performance](build-performance.md) for the terminal-log analysis,
measurements, output comparison, and preview checks. The full production build
median is 3.16 seconds across three local runs; content edits are visible in about
2.6–2.7 seconds. CSS/JS edits use direct live reload. Sixteen automated tests pass.
Three conflicting citation redirects were removed from generated output so the
existing BibTeX/RIS/XML files are always served as downloads.
