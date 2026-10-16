# Accessibility validation — 2026-10-15

Target: WCAG 2.2 AA. This work fixes known failures and records evidence; it does not establish full-site conformance.

## Changes

- Current pagination uses white text on `#4a5157`: 8.06:1 contrast, exceeding the [AA minimum for normal text](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).
- The current page is a noninteractive span with `aria-current="page"`; disabled styles cannot obscure it. Both pagination templates label their navigation landmarks.
- Inactive previous/next controls are spans rather than focusable dead links. Active pagination links have a visible blue keyboard-focus outline.
- Embedded videos, podcasts, and document readers have descriptive titles. The CMS entry document declares English.
- The navigation title can wrap within its flex item at narrow widths instead of pushing the menu outside the viewport.

## Verification

Eight Lighthouse accessibility checks scored 100: homepage, pagination page 2, post, author, category archive, contact form, search, and embedded-video article. See [machine-readable results](accessibility-validation.json). These scores cover automated Lighthouse rules, not every WCAG success criterion. Five checks used the development server; the final pagination, search, and media checks used the production build.

All 790 generated HTML documents passed static checks for image alt attributes, iframe titles, and document language. These checks establish presence, not the quality of descriptions or media alternatives.

Regression tests cover both numbered paginator templates on first, middle, and last pages, text contrast, inactive post navigation, iframe titles, and CMS language. Run `node --test --test-concurrency=1`; all 44 tests passed. The default parallel run intermittently timed out in the pre-existing filesystem watcher test; the serial run passed.

The production build and `npm run verify` check metadata, citations, and preserved public URLs. New source image URLs added during this work were recorded without removing historical URLs.

## Conformance work still requiring manual review

- Screen-reader navigation and complete keyboard task flows, including third-party interfaces.
- Whether alternative text accurately conveys each image's purpose.
- Captions, transcripts, and audio descriptions for the media archive.
- Reading order, tagging, text alternatives, and forms in archival PDFs.
- Content-wide text resizing, zoom/reflow, error handling, and assistive-technology testing.

External video/podcast players, Netlify CMS, and original archival documents were not certified by this audit. Do not publish a full WCAG AA conformance claim based only on these automated results.
