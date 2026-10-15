# Goal 4: Lighthouse and HTTP response headers

Work performed October 15, 2026. Reference report:
`/Users/abrett76/Downloads/localhost_8080-20261015T162949.json`.
The earlier Netlify report path was unavailable. The supplied report measured
the local homepage on mobile: performance 71, accessibility 88, best practices
100, and SEO 92, with LCP 6.9 seconds.

## Changes

- Reduced custom HTTP response header declarations from three to two:
  retained `nosniff`, removed the explicit modern-browser referrer-policy
  default, and replaced zero-age asset caching with immutable caching solely
  for content-hashed files. Netlify's platform headers are outside `_headers`.
- Added content-hashed CSS, JS, SVG, and image URLs under `/assets/built/`.
  CSS is compacted at build time. Browser caches cannot keep an old asset
  under a newly generated URL. Development CSS/JS still reload directly.
- Replaced the remote Font Awesome stylesheet/fonts with 31 local SVG symbols,
  retaining the upstream license. Both static and JS-created heading links use
  the local icons. Unknown symbols fail the build rather than disappear.
- Added optimized WebP variants for the logo, homepage hero/features, Robert
  J. Miller's portrait, and the default related-post teaser. Originals remain
  available. Added intrinsic dimensions for local PNG/JPEG/GIF/WebP images
  that lack dimensions, and lazy loading for related-post and later feature
  images. Explicitly prioritized/preloaded the homepage background image.
- Fixed screen-reader-only text, permalink contrast/touch targets, disabled
  pagination semantics, breadcrumb list children, and descriptive feature-link
  names. Fixed one existing malformed local author-avatar path.
- Removed entrance-animation delays that hid content during first paint.
  Final layout and color styling remain. Desktop/mobile screenshots and
  navigation/search behavior were checked.
- Brought forward the planned analytics deferral: configuration/pageview data
  queues immediately; Google's script loads after the page load event during
  idle time, with a two-second idle timeout and a fallback for other browsers.
  The configured tracking ID was preserved. A single loader can cause Google
  to download both its legacy and linked GA4 bundles; there was no duplicate
  template include to remove. Pagefind and the remaining JS reduction are Goal 5.

No new npm dependency was added. The existing seven direct dependencies remain.

## Final validation

| Page / device | Performance | Accessibility | Best practices | SEO | LCP |
| --- | --- | --- | --- | --- | --- |
| Homepage / mobile | 100 | 100 | 100 | 100 | 1.6 s |
| Homepage / mobile repeat | 100 | 100 | 100 | 100 | 1.7 s |
| Homepage / desktop | 100 | 100 | 100 | 100 | 0.4 s |
| New Miller article / mobile | 100 | 100 | 100 | 100 | 1.2 s |
| Robert J. Miller profile / mobile | 100 | 100 | 100 | 100 | 1.2 s |

All five final runs recorded zero cumulative layout shift. The compact,
tracked [measurement summary](lighthouse-goal-4.json) records versions,
timestamps, metrics, remaining diagnostics, and full-report locations under
`/private/tmp/dod-goal4/`. Earlier exploratory runs are superseded by these
final runs. The supplied baseline and final production-style fixture differ
in compression/caching, so these are observed local results, not a controlled
claim about the deployed site's speed improvement.

`npm test`: 28 passed, zero failed. Production build: 797 files written in
2.97 seconds plus copied assets. Build verification passed for 787 HTML pages,
497 metadata records, 824 legacy citation pairs, and 506 Standard.site
documents. The verifier now checks generated asset URLs as well as original
styles/scripts and citation links.

At viewport widths 320, 390, 768, and 1440 pixels, the homepage did not overflow
horizontally. The logo retained its aspect ratio, all 35 rendered icon uses
resolved to local symbols, and no font-icon placeholders remained. Mobile
menu open/close and search open/close/focus checks passed. Final mobile and
desktop screenshots were visually inspected.

The normal Eleventy dev server was also checked separately: homepage, six
generated image/icon assets, editable source CSS, and OAI form POST all passed.
Temporary preview servers were stopped and `_site/` restored with a production
build for review. No commits were created by the agent.

## How measurements were taken

Full Lighthouse CLI 13.5.0 navigation audits used its default mobile simulation,
a fresh headless Chrome, and production `_site` output. A temporary local
server supplied gzip text compression and the configured hashed-asset cache
header, because Netlify applies compression but Python's basic development
server does not. This server is a measurement fixture, not a production change.
Results must be repeated on the Netlify deploy to confirm CDN behavior.

The removed referrer header specified the current browser default documented
by [MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Referrer-Policy).
[Netlify's header documentation](https://docs.netlify.com/manage/routing/headers/)
explains the platform-managed headers and the distinction between static files
and function responses; OAI keeps its function-specific content/cache headers.

The Chrome DevTools trace and responsive checks complemented the full CLI
audits. An early DevTools Lighthouse run in an isolated/background browser
context produced `NO_FCP`; that run is invalid and excluded from scores.

Commands for a deployed preview or an equivalent local production server:

```sh
npm test
npm run build
npm run verify
npx --yes --package lighthouse@13.5.0 lighthouse http://localhost:8080/ \
  --output=json --output=html --output-path=/tmp/lighthouse-home \
  --chrome-flags='--headless=new --no-sandbox'
```

The normal Eleventy development server does not emulate all production
compression/cache behavior and includes live-reload tooling. Audit the
production deployment for release decisions.

## Remaining interpretation and deployment checks

Shared stylesheet rules used by other layouts, hover states, search, print,
and the image dialog can be reported as unused during a homepage navigation.
The observed unused-CSS diagnostic estimated zero FCP/LCP savings. Removing
those rules based only on one viewport would break other site behavior.
Google's third-party scripts also contain unused code controlled by Google.
These diagnostics are distinct from failed accessibility, SEO, or best-practice
checks; do not treat a score of 100 as proof of zero remaining diagnostics.

After committing/deploying, confirm the two custom headers, gzip/Brotli,
hashed-asset cache invalidation, analytics collection, OAI/citation routes,
and mobile/desktop Lighthouse results on Netlify. No deployment or IndexNow
submission was performed during this work.
