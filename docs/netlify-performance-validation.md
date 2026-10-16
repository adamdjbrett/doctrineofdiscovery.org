# Netlify deployment time, performance, and offline support

Checked October 15, 2026. No commit, push, or deployment was performed.

## Deployment baseline

Source: the supplied `dofd-log.log`, deploy `6ad16173a6b2bf2faf8e4d10`.

| Stage | Observed duration |
| --- | --- |
| Eleventy build | 7.48 seconds |
| Installing the Jekyll Cache and Lighthouse plugins | approximately 8 seconds |
| Deploy and publish | 10.4 seconds |
| Lighthouse after publishing | approximately 16 seconds |
| Request to live site | approximately 44 seconds |
| Request through final cleanup | 62.791 seconds |

Disabled **Jekyll Cache** and **Lighthouse** in the Netlify project dashboard.
Both cards now show **Enable**, confirming that they are disabled. The local
IndexNow plugin and OAI function remain configured in `netlify.toml`.
No security scanning, branch settings, or deployment protections were changed.

Removing plugin installation and the post-deploy audit targets roughly
40 seconds for an otherwise equivalent deploy. This is an estimate from the
provided log, **not a measured new Netlify deployment or a guarantee**. Cache
availability, platform queues, network transfer, and production-only IndexNow
work can change the result. The next deployment log must confirm the one-minute
target. The final local production build took approximately four seconds.

Run Lighthouse separately against each preview that needs release validation:

```sh
npm run lighthouse -- https://YOUR-PREVIEW.netlify.app/ --output=json --output=html
```

This uses Lighthouse 13.5.0 through a temporary npm tool installation; no
Lighthouse dependency was added to the application lockfile.
[Netlify documents disabling dashboard-installed plugins here](https://docs.netlify.com/extend/install-and-use/build-plugins/).

## Page changes

- The deployed UA loader fetched both `UA-96037973-2` and GA4 `G-RWJ9WXTZ3B`.
  The configuration now uses that existing GA4 ID directly. No new analytics
  property was invented or created.
- The GA4 configuration is queued immediately. Its script loads after the
  first pointer, keyboard, or scroll event, during idle time. All interaction
  listeners are removed after the first event, preventing repeated loads.
  Visits without interaction may not be counted; this is an intentional
  measurement tradeoff for keeping analytics off the initial rendering path.
- The browser now discovers the hero preload and shared CSS immediately in
  the head. The existing stylesheet stays external and cacheable.
- The 88 × 88 logo uses high-quality 88px (6,830 bytes) and 176px (18,060 bytes)
  WebPs on ordinary/2× displays. The original lossless 300px WebP (72,444 bytes)
  remains available for denser screens. The logo has low fetch priority so
  the larger hero can load first. All variants retain content-hashed URLs.
- The web app manifest now specifies a stable root identity, start URL, scope,
  and icons usable in both ordinary and maskable contexts.
- A root service worker precaches only a small, self-contained offline notice.
  Online article requests always use the network. API paths, administrative
  paths, non-GET requests, and downloads are not intercepted. No article,
  citation, API, or analytics responses are stored by the worker. Ordinary
  localhost development does not register it; a separate `.localhost` alias
  was used for production-style browser checks.
- No new application dependency or HTTP response header was added.

## Checks

- All 35 tests pass, including single-load analytics, responsive logo variants,
  manifest/icon checks, offline fallback, and API/download exclusions.
- Build verification passes: 788 HTML pages, 497 metadata records, 824 citation
  pairs, and 506 Standard.site documents. Responsive image URLs are verified.
- Browser inspection confirmed zero analytics loaders before interaction and
  one direct GA4 loader after keyboard interaction.
- The final production-style mobile run with Lighthouse 13.5.0 scored **100
  performance, 100 accessibility, 100 best practices, and 100 SEO**. FCP was
  0.8 seconds, LCP 1.7 seconds, and total blocking time zero. The tracked
  [measurement summary](lighthouse-netlify-performance.json) records precise
  metrics and remaining diagnostics. Full reports are in
  `/private/tmp/dod-goal6/home-final.report.{json,html}`. The different versions
  and local hosting mean these are not a controlled before/after comparison
  with the supplied Netlify report.
- Browser checks confirmed that the worker controls a production-style local
  preview. With its HTTP server actually stopped, opening an author page
  displayed the offline reconnect notice. Restarting the server and following
  the homepage link restored normal content. The temporary server was stopped
  after checking recovery.
- The supplied Lighthouse 9.6.8 report scored 97 performance, 100 accessibility,
  100 best practices, 100 SEO, and 90 PWA. Its blocking time was approximately
  170ms; the missing service worker was its failed PWA audit.

Current Lighthouse no longer includes the PWA category; installation and
offline behavior need separate verification. The removal is tracked by the
[Lighthouse project](https://github.com/GoogleChrome/lighthouse/issues/15535).
The service-worker implementation follows the browser lifecycle described in
[MDN's service-worker guide](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers).

An attempted full run with legacy Lighthouse 9.6.8 timed out capturing a
screenshot on the installed browser. A PWA-only retry also did not complete
and was stopped. Neither attempt supplies a valid new PWA score.

After deployment, rerun Lighthouse on the preview, confirm service-worker
control and offline fallback, verify analytics collection in GA4, and check
the new Netlify log against the one-minute target. Full article reading offline
is not implemented; the PWA shows a reconnect notice.

## Cloudflare beacon follow-up

The production browser revealed an edge-injected Cloudflare beacon with public
token `7c09e2b61dd142e1aad1b7f6308b6761`; command-line HTML responses did not
include it. The shared analytics loader now uses that token and loads the
beacon after the first interaction and idle callback, alongside GA4. It checks
for an existing injected beacon to prevent duplicates. Browser checks found
zero Cloudflare script elements initially and exactly one after keyboard
interaction. All 36 tests and build verification pass after this change.

Automatic injection remains enabled in Cloudflare. First deploy the updated
site; then select **Enable with JS Snippet installation** in Cloudflare Web
Analytics for this site. The dashboard requires sign-in, so that change has
not been applied. Until it is changed, the automatically injected beacon
continues to load eagerly and the manual loader skips its duplicate. This
order preserves tracking while the source change awaits deployment. No new
headers or dependencies were introduced. Delayed collection may exclude visits
without interaction and affect the sample represented by browser metrics.

## Network dependency tree follow-up

The supplied production tree contains navigation → Cloudflare beacon →
`/cdn-cgi/rum`, ending at 518ms. Fresh production HTML still references
`main.ba5899b42df39305.css` and contains neither `scheduleAnalytics` nor the
manual Cloudflare loader. The local changes have not reached that deployment.
Cloudflare's dashboard is still at sign-in, so automatic injection remains on.

A fresh production-style local audit retains **100/100/100/100**. Its critical
tree consists only of navigation → stylesheet, ending at 23ms locally. There
are **no initial Cloudflare beacon, RUM, or Google Analytics requests**. The
manifest is fetched but is not in that critical tree. These timings reflect
local hosting and must not be presented as a measured production reduction
from 518ms to 23ms. See the [network measurement summary](network-dependency-validation.json).

A `fetchpriority="low"` experiment on the manifest left its actual priority
at Medium. The ineffective hint was removed. The existing manifest remains
discoverable for installation. CSS stays external, cacheable, and immediately
discoverable near the start of the head; a direct stylesheet request is needed
to render the established layout.

To finish the production fix: deploy the pending source changes, sign into
Cloudflare, switch this site's Web Analytics to **Enable with JS Snippet
installation**, then rerun the audit against the public domain. No headers,
dependencies, or extra browser loader were added for this follow-up.
