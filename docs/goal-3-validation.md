# Goal 3: publication metadata and discovery

Implemented locally on October 15, 2026, against Goal 2 commit `f29c3aa`.
Stop here for the user's commit and Netlify validation. Lighthouse and
Pagefind/analytics work remain separate goals.

## Changes

- Shared publication records supply Zotero/Highwire, Dublin Core,
  Schema.org, microformats, RIS, and CSL-JSON metadata. Explicit coauthors
  take precedence; author IDs resolve to full names and profile URLs.
  Twenty-one existing institutional author profiles are marked as
  organizations. No profile was invented for an unlinked coauthor.
- Each theme page has one Schema.org graph with stable publisher, website,
  blog, and page identifiers. Posts add `BlogPosting`; profiles add the
  relevant person or organization. Existing publisher editorial details
  moved into `_data/organization.yml`; duplicate schema blocks were removed.
- Posts contain `h-entry` publication and modification dates and nested
  `p-author h-card` metadata. Author profiles have `h-card`. These are the
  standard microformats for the requested author metadata.
- Unique adjacent RIS, CSL-JSON, and Dublin Core exports avoid legacy slug
  collisions. Historical citation downloads remain. Suggested citations
  now honor the existing explicit coauthor front matter.
- A Netlify function and local development middleware expose OAI-PMH at
  `/oai`. All six verbs support GET and form POST; `oai_dc` and the `blog`
  set are supported. Date filters are inclusive UTC days. Datestamps use
  the latest relevant Git dates for the post, its author profiles, and
  shared metadata sources. Deletions are not retained (`deletedRecord=no`).
  Current lists fit in a single response; resumption tokens are unsupported.
- IndexNow generates a public hash manifest and ownership verification
  file. A local Netlify build plugin submits only after successful real
  production deploys, comparing the previous manifest to include additions,
  changes, and removals. It verifies the live ownership file and batches at
  10,000 URLs. Local builds/previews skip notifications. A dry-run/manual
  command supports inspection and retry. No notification was sent during
  this work.

## Validation

| Check | Result |
| --- | --- |
| `npm test` | 23 passed, zero failed |
| `npm run build` | 795 files written in 3.06 seconds; 1,728 copied |
| Build verifier | 785 HTML pages, 496 metadata records, 823 legacy citation pairs, 505 Standard.site documents |
| OAI catalog | 495 blog records with unique identifiers |
| Adjacent citation exports | 574 RIS/CSL-JSON/Dublin Core sets, including paginated content pages |
| IndexNow dry run | 434 eligible URLs; no network submission |
| OAI protocol | All six verbs plus error responses validated against official OAI-PMH and Dublin Core XSDs |
| Local endpoint | GET Identify and form POST ListRecords returned XML successfully |
| Netlify function handler | Invoked directly with Request objects locally |
| IndexNow tests | Mocked ownership validation, batching, changes/removals, key rotation, and production-only lifecycle |
| SEO descriptions | Primary description metadata unchanged across all 785 HTML outputs |
| Styling and scripts | Existing CSS and browser JavaScript bytes unchanged; no new browser JavaScript or npm dependency |
| Responsive spot check | Representative Inter Caetera desktop and 390px mobile content bounds match baseline; mobile viewport has no horizontal overflow |

Per-document exports and JSON-LD are checked by the enhanced build verifier.
New protocol and submission logic has focused tests; submission tests use
mocked network responses. Existing New York publication-date behavior and
Git-derived `last_modified_at` are retained. The local preview servers used
for validation were stopped.

## Review after committing and deploying

1. Build the commit with `npm run build`, `npm test`, and `npm run verify`.
2. Deploy a Netlify preview. Check `/oai?verb=Identify` and
   `/oai?verb=ListRecords&metadataPrefix=oai_dc`. Check form POST support
   and a representative page's citation downloads, source metadata,
   and mobile layout. A preview must not submit IndexNow notifications.
3. Check representative article/profile markup in Google's Rich Results
   tools and import a post with the Zotero browser connector. Structured
   data supplies machine-readable identity; Google controls search display
   and Knowledge Graph inclusion.
4. After a production deploy, inspect function/build-plugin logs and the
   verification file. IndexNow should submit the first eligible URL set;
   subsequent deploys submit changed and removed URLs. Retry a failed
   notification with `npm run indexnow -- --submit` using the deployed
   build/configuration.

Actual Netlify packaging, deployed routing, Zotero connector behavior,
Google's interpretation, and real IndexNow acceptance require deployment
validation. No commit, push, deployment, or real IndexNow notification was
performed here. Existing publisher editorial claims were preserved rather
than independently researched. Full-site Lighthouse validation is Goal 4.
