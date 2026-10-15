# Goal 1: self-contained Jekyll theme

Validated locally on October 15, 2026. This change completes the Jekyll theme
import only; Eleventy conversion, metadata expansion, Lighthouse work, and
Pagefind remain separate goals.

## Source and runtime

- Imported 124 missing theme files from Minimal Mistakes 4.27.3, commit
  `0064dabea814bd3a2e203320a141c037fdcf67ea`.
- Preserved all 59 existing layouts, includes, Sass files, and data files
  byte-for-byte. Imported files match the tag, except the JavaScript bundle
  and source map regenerated with the locked npm toolchain.
- Added upstream MIT attribution in `LICENSE.minimal-mistakes`.
- Removed the theme gem and configuration; Jekyll is now an explicit dependency.
- Tracked the Ruby lockfile, citation generator, and SEO description plugin.
- Narrowed the root vendor ignore rule so theme vendor sources are included.
- Tested Ruby 3.3.6, Bundler 2.5.16, and Node 24.18.0.
- A separate source export installed 49 Ruby gems into an empty bundle
  directory and installed npm dependencies with `npm ci`. The installed
  bundle contains no Minimal Mistakes gem. A runtime assertion confirmed
  both `site.theme.nil?` and absence of the theme in `Gem.loaded_specs`.
- The clean source export completed the exact production `npm run build`
  command in 154.169 seconds and passed `scripts/verify_build.py`.
- Its output retained every baseline file URL, adding only the upstream
  license and Netlify `_redirects`. Build configuration, scripts, documentation,
  and installed dependencies were absent from the published output.
- Refreshed the local `_site/` with that verified output; the previous local
  output is backed up at `/private/tmp/dod-goal1/pre-goal1-site/`.

## Build corrections

The original production build failed on two existing minifier issues. For
both the baseline comparison and the final configuration:

- Disabled JSON minification because `json-minify` fails on existing
  Standard.site document text. Generated JSON content is preserved.
- Enabled Uglifier harmony mode because upstream theme sources contain ES6.

The npm build now uses the imported jQuery 3.6.0 source, includes the existing
copyright banner, and no longer calls the nonexistent `banner.js`.

Netlify configuration runs `npm run build` and publishes `_site/`, with
production mode and frozen Ruby dependencies. Incremental rendering is
disabled. The existing `_redirects` file is explicitly included in output;
build scripts, validation documentation, and `netlify.toml` are excluded.
The theme's previously published `assets/js/_main.js` URL is retained.

## Output comparison

The gem-based baseline used a saved copy of the original sources and all four
local plugins. Baseline and local comparison builds used the same fixed build
time and the same minifier corrections above.

- 785 HTML pages: 784 byte-identical; `/sitemap/` lists the same documents in
  a different filesystem-dependent order.
- Compiled `assets/css/main.css`: byte-identical.
- 496 site/post `metadata.json` files: byte-identical.
- Three Standard.site JSON endpoints: byte-identical.
- 823 CSL-JSON files and 824 RIS files: byte-identical, including pre-existing
  static citation downloads. There are 823 matched citation pairs.
- Feed, sitemap index, sitemap, PDF sitemap, and citation sitemap:
  semantically identical after ignoring element order.
- Generated redirect mapping: semantically identical.
- Source-map paths and JavaScript compression output can differ because
  sources now resolve locally and the JavaScript bundle is rebuilt.

The baseline build reported 157.619 seconds and the first local comparison
build 141.304 seconds. These are individual verification runs, not a
performance benchmark.

## Browser checks

- Homepage screenshots at desktop and mobile widths were pixel-identical
  between baseline and local output.
- Local CSS and JavaScript loaded; homepage images had no failed loads.
- Mobile navigation opened.
- Search for `Discovery` returned 293 results.
- A 20-image conference gallery opened its lightbox.
- An author archive rendered its article listing.
- The contact form retained the Formspree action, required fields, and CAPTCHA
  markup. No form submission was sent.

Local screenshots are retained under
`/Users/abrett76/github/docker/scratch-tmp/dod-goal1/`. Temporary source
exports, build logs, and baseline output are under `/private/tmp/dod-goal1/`.

## Repeatable verification

```sh
JEKYLL_ENV=production npm run build
python3 scripts/verify_build.py _site
git diff --check
```

The verifier checks representative routes, referenced theme assets and
citation links across all HTML pages, JSON records, matched citation files,
Standard.site record counts, and XML parsing.

## Limits and follow-up

- No commit, push, or Netlify deployment was performed. Review a Netlify deploy
  preview before publishing; account-level settings and integrations were not
  inspected. File-based build settings take precedence over matching dashboard
  settings.
- Existing Sass deprecation warnings remain; source modernization belongs to
  later work. Ruby warns about standard libraries that change after 3.3; the
  tested runtime is pinned to 3.3.6.
- Citation and SEO behavior was preserved, including historical static
  citations and existing metadata inconsistencies. Accuracy improvements
  remain in Goal 3.
- Lighthouse, Analytics deferral, Lunr replacement, and publication/modification
  date backfills were not started.
