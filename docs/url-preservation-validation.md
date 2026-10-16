# Public URL preservation

Checked October 15, 2026. No commit, push, or deployment was performed.

## Preserved paths

- Compared the saved Jekyll baseline at
  `/private/tmp/dod-goal1/baseline-output/` with the Eleventy output. Its page
  and media paths are retained. The existing Jekyll page fixture is unchanged.
- Restored passthrough copying for `/Screenshot-2019-03-11-02.46.46.png`,
  a historical root image missed by the original Eleventy copy rules.
- Restored the already-linked S05E01 transcript PDF from the verified podcast
  publication to its original local path. All 93 source PDFs have PDF headers.
- Added permanent redirects for known older review, subscription, land
  acknowledgement, series, and mixed-case article paths.
- Preserved seven known historical fingerprinted WebP/SVG URLs derived from
  committed asset versions. They redirect to stable current media paths.
- No existing post/page permalink or original media filename was renamed.
  Hashed CSS/JS and Pagefind bundle URLs remain build-versioned assets.

The append-only contract in `tests/fixtures/public-urls.json` protects **1,446
public file and redirect URLs**. It includes current pages/media and retained
historical paths. Recording additions preserves every existing entry; it
cannot silently bless a deletion. Builds require a working file or redirect
for each protected URL.

## Broken references repaired

The initial path-only scan found 30 broken targets, with further case and
fragment errors found by the full checker. Repairs include malformed podcast
subscription links, relative author links, outdated review links, a malformed
UN PDF URL, and case mismatches that macOS had hidden.

Restored the existing `ToC`/`S1`–`S22` and `ToC`/`S1`–`S28` section links in
two Newcomb essays. Repaired old footnote references and conference session
anchors without removing the existing valid anchors. Source-excerpt footnotes
now link to their complete canonical article rather than nonexistent local
`ftn1`/`ftn2` routes.

Breadcrumbs no longer treat every segment of a nested post permalink as an
existing category. Category/tag labels without archive entries remain visible
as text instead of broken links to nonexistent sections.

## Automated protection

`scripts/check_links.py` uses Python's standard library and runs after every
production build, before deployment can proceed. It also runs during
`npm run verify`. It checks:

- Local HTML links, images, responsive image candidates, module URLs, image/
  URL metadata, inline/standalone CSS URLs, and SVG references.
- Same-origin absolute URLs, relative paths, encoded filenames, query strings,
  and HTML/SVG fragment destinations, with exact case-sensitive path matching.
- Permanent redirects, fragment preservation, literal aliases, placeholder
  destinations, missing targets, and redirect loops.
- Every protected URL and registration of newly added public page/media URLs.

OAI routes are verified through the existing handler tests rather than treated
as filesystem paths. External hosts are not crawled during builds, keeping
validation deterministic and avoiding network delays or false failures from
rate limits. Related podcast destinations used for repairs were verified.

All **38 Node tests**, including a Python suite covering six link-checking
cases, pass. Build verification reports **790 HTML pages, 497 metadata records,
824 citation pairs, and 506 Standard.site documents**, with **zero broken local
URL/fragment targets**. The production build, including the preservation gate,
took **6.94 seconds** locally. No browser JavaScript or dependency was added.

Development HTTP checks confirmed 301 responses for an older review path,
historical hashed logo, mixed-case article URL, and `/tagged`; internal targets
remain on localhost. The restored root PNG and transcript PDF return 200 with
their correct media types. The author profile URL and OAI endpoint also return
200. Development startup took 3.33 seconds. Its temporary server was stopped
and the output restored with a production build after verification.

Netlify's actual HTTP redirect processing still needs confirmation after the
user commits and deploys. This check protects the site's own URLs; it cannot
guarantee future availability of independently operated external websites.
