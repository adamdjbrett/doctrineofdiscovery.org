# Doctrine of Discovery
[![Netlify Status](https://api.netlify.com/api/v1/badges/f4991e96-a11b-4dab-8f6c-6575ef141b7d/deploy-status)](https://app.netlify.com/sites/doctrineofdiscovery/deploys)
[![Jekyll](https://img.shields.io/badge/Made%20with-Jekyll-1f425f.svg)](https://jekyllrb.com/)
![GitHub commit activity](https://img.shields.io/github/commit-activity/m/adamdjbrett/doctrineofdiscovery.org)
![GitHub last commit](https://img.shields.io/github/last-commit/adamdjbrett/doctrineofdiscovery.org)

## Land Acknowledgment
We begin by acknowledging with respect the Onondaga Nation, Central Fire of the Haudenosaunee Confederacy, on whose ancestral lands we now inhabit. Wherever you are located be aware of the Indigenous Peoples on whose lands you reside. We are mindful that the technology that makes this conference possible comes from the mineral extraction by multinational corporations, which decimate and displace Indigenous people and their land all over the world. May the information you glean from this website motivate you to uphold Indigenous values, protect Mother Earth, Honor Indian Treaties and hold your government and various institutions accountable who stand in the way.

## Preface
I have become frustrated with how slow and limited in accessibility WordPress is so I decided to start moving sites I administer over to [Jekyll](http://jekyllrb.com) because as static site generator it is faster, more reliable and I have more control over making it accessible.

## Build and preview

The site runs on **Eleventy 4.0.0-alpha.10** (the canary release, pinned exactly)
and **Node 24**. It deploys to Netlify using
`netlify.toml`; no Ruby, Jekyll, Sass, theme package, or jQuery is required.

```sh
npm ci
npm run build
npm test
npm run verify
npm run dev
```

`npm run dev` serves a rebuilding preview at `http://localhost:8080`.
`npm start` runs the same command, with per-file logs suppressed. During preview,
static assets are served directly, and CSS/JS edits reload without rebuilding pages.
Content edits rebuild shared archives, search data, citations, and SEO metadata.
Run `npm run build` to create the complete deployable `_site/` directory. The build
cleans that output directory before generating pages and metadata. Netlify
installs the locked npm dependencies, runs `npm run build`, and publishes
`_site/`. Redirects and HTTP headers are maintained in `_redirects` and
`_headers`. CMS access under `/admin/` and the Formspree contact form remain.

Eleventy 4 uses native Chokidar 5 directory watching and YAML 4; the older
dependency overrides and watcher adapter are no longer needed. CSS/JS live
reload watches directory paths because the new dev server does not accept
glob patterns in its `watch` option. `npm ci`, `npm audit`, and `npm test`
validate the locked setup. Funding notices are informational.
Custom content/configuration watch targets use recursive globs so Eleventy 4
detects changes inside those directories. This is a prerelease dependency;
review the [upstream releases](https://github.com/11ty/buildawesome/releases)
before upgrading the exact pin.

## Content and dates

Posts, pages, and authors remain in `_posts/`, `_pages/`, and `_authors/`.
Markdown and YAML front matter remain editable through the existing CMS.
Site settings, including **`timezone: America/New_York`**, live in `_config.yml`.
Local timestamps and date-only values are interpreted in New York, including
its daylight-saving changes.

Every content document has a publication `date`. Existing valid dates were
preserved; missing post dates came from filenames, and undated pages/authors
used their earliest recorded Git commit, following renames. To backfill a
new manually added document, run `node scripts/backfill-dates.js`.

An explicit `last_modified_at` takes precedence. Otherwise, each build reads
the file's latest Git commit date. Modified-date listings fall back to
publication dates when Git history is unavailable. Complete Git history gives
the best results; source exports without `.git` remain buildable using their
committed publication dates. Modification dates are never based on filesystem
copy times. The Atom feed, homepage, and homepage pagination use publication
order, newest first. Taxonomy listings use modified order.

## Templates, styles, and metadata

Liquid layouts and includes are maintained locally in `_layouts/` and
`_includes/`. Eleventy paginates the prepared content records in `site.11ty.js`;
`lib/site.js` builds the shared post, author, category, and tag indexes once.
Markdown compatibility, including historical heading IDs, footnotes, and
attribute syntax, is handled in `lib/templates.js`.
Definition lists use native HTML; the three existing quotation blocks retain
their rendered markup without a definition-list plugin.

Production CSS is compacted without changing the editable source. Shared
CSS/JS, local icons, and images use content-hashed URLs under `/assets/built/`.
Only that directory receives a one-year immutable cache header; changing file
contents changes its URL. Local CSS/JS preview still serves the editable files
directly. Local raster images receive intrinsic dimensions when both dimensions
are missing. Related-post images and later feature images load lazily.

Selected high-traffic images have WebP copies in `assets/images/optimized/`;
`lib/assets.js` maps their original URLs to those copies. When replacing one
of these source images, regenerate its optimized copy too. Originals remain
available for historical links. Image conversion is done before committing,
so Netlify needs no image-processing dependency.

Icons use the local Font Awesome 6.7.2 SVG subset in
`assets/icons/fontawesome.svg`, with attribution in the adjacent license.
Add a symbol there before using a new icon; the build reports missing symbols.
There is no remote icon font stylesheet. Analytics queues its configuration
immediately, then downloads after the page's load event when the browser is
idle (with a two-second idle timeout). Search remains Lunr until Goal 5.

The two custom HTTP response headers are `X-Content-Type-Options: nosniff`
and the immutable cache rule for hashed assets. The redundant explicit modern
browser referrer-policy default and zero-age asset-cache override were removed.
Netlify supplies its own transport/CDN headers. See
[Goal 4 validation](docs/goal-4-validation.md) for Lighthouse measurements.

Edit **`assets/css/main.css`** directly. It retains the established Minimal
Mistakes styles as readable CSS; there is no Sass compilation. Navigation uses
the original theme markup with vanilla JavaScript, sticky positioning uses CSS, and image
viewing uses a small native-dialog script. Search uses a vanilla JavaScript
Lunr implementation on `/search/` and in the theme search overlay; Pagefind is a separate later goal.

Citation generation, SEO descriptions, per-post metadata, and Standard.site
endpoints run at build time in `lib/metadata.js` and `lib/content.js`. Existing
citation URLs and historical downloads are retained. No browser JavaScript is
needed for metadata generation.

### Publication metadata and discovery

Posts and HTML pages expose Zotero/Highwire citation tags, Dublin Core tags,
and one coherent Schema.org graph. Posts use `BlogPosting`; author profiles
use `ProfilePage` with `Person` or `Organization`. The standard microformat
author representation is `p-author h-card` inside `h-entry`.
Explicit `authors` takes precedence over `author`; names and profile details
come from `_authors/`. Set `schema_type: Organization` for institutional
authors. Publisher details live in `_data/organization.yml`.

Each post and content HTML page has adjacent `citation.ris`, `citation.csl.json`, and
`dc.xml` exports (for example, `/inter-caetera/citation.ris`). URLs ending in
`.html` append `.citation.ris`, `.citation.csl.json`, or `.dc.xml` instead.
Legacy `/assets/citations/` downloads remain available.

`/oai?verb=Identify` exposes the OAI-PMH repository, both in local preview and
on Netlify. It supports all six verbs, GET and form POST, the `oai_dc`
metadata format, and the `blog` set. Dates use UTC days from Git history;
lists currently return all matching records in one response.

IndexNow notifications run after successful **production Netlify deploys**.
Local builds and deploy previews do not submit. The local build plugin
compares the previous production `/indexnow.json` with the new manifest,
then submits new, changed, and removed URLs after checking the deployed
ownership file. The verification key lives in `_config.yml`; the build
generates its root `.txt` verification file. The public manifest contains
URL hashes and a key fingerprint. Notifications exclude redirects, drafts,
unpublished documents, `noindex`, `sitemap: false`, and external canonical
URLs. Theme `hidden` only affects archive listings.

```sh
npm run indexnow -- --dry-run  # inspect current URL count; no notification
npm run indexnow -- --submit  # manually submit after deploying this build
```

Notification failures are logged without failing an already successful
deployment; use the manual command to retry. See
[Goal 3 validation](docs/goal-3-validation.md) for local checks and the
remaining Netlify validation steps.

The starting theme was Minimal Mistakes **4.27.3**, commit
`0064dabea814bd3a2e203320a141c037fdcf67ea`, imported during Goal 1 and adapted
for Eleventy during Goal 2. Its MIT attribution is retained in
`LICENSE.minimal-mistakes`. See [Goal 2 validation](docs/goal-2-validation.md)
for checks, measurements, and remaining limitations. The older
[Goal 1 report](docs/goal-1-validation.md) records the preceding Jekyll stage.

## Credits

### Creator

**Michael Rose**

- <https://mademistakes.com>
- <https://twitter.com/mmistakes>
- <https://github.com/mmistakes>

### Webmaster
**Adam DJ Brett**
- <https://adamdjbrett.com>
- <https://github.com/adamdjbrett>

### Contributors
  - Philip P. Arnold
  - Sandra Bigtree
  - Adam DJ Brett
  - Betty Lyons
  - American Indian Law Alliance
  - Indigenous Values Initiative

Please read [humans.txt](humans.txt) for the contributors.


### Icons + Demo Images:

- [The Noun Project](https://thenounproject.com) -- Garrett Knoll, Arthur Shlain, and [tracy tam](https://thenounproject.com/tracytam)
- [Font Awesome](http://fontawesome.io/)
- [Unsplash](https://unsplash.com/)

### Other:

- [Jekyll](http://jekyllrb.com/)
- [jQuery](http://jquery.com/)
- [Susy](http://susy.oddbird.net/)
- [Breakpoint](http://breakpoint-sass.com/)
- [Magnific Popup](http://dimsemenov.com/plugins/magnific-popup/)
- [FitVids.JS](http://fitvidsjs.com/)
- [GreedyNav.js](https://github.com/lukejacksonn/GreedyNav)
- [Smooth Scroll](https://github.com/cferdinandi/smooth-scroll)
- [Gumshoe](https://github.com/cferdinandi/gumshoe)
- [jQuery throttle / debounce](http://benalman.com/projects/jquery-throttle-debounce-plugin/)
- [Lunr](http://lunrjs.com)

## License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details. The content is licensed under a [Creative Commons Attribution 4.0 International License](https://creativecommons.org/licenses/by/4.0/).

### Technology Licenses
Please see [Minimal Mistakes Jekyll Theme by Michael Rose for the most up to date listing of the Technology Licenses](https://github.com/mmistakes/minimal-mistakes)


## Acknowledgments
Thank you to all who have contributed to the project. For more please see [humans.txt](humans.txt)
