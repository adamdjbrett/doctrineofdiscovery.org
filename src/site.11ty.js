import { getSite } from '../lib/site.js';

export default class {
  async data() {
    const { documents } = await getSite();
    return { documents: documents.map(({ output, html }) => ({ output, html })),
      pagination: { data: 'documents', size: 1, alias: 'document' },
      permalink: data => data.document.output, eleventyExcludeFromCollections: true };
  }
  render({ document }) { return document.html; }
}
