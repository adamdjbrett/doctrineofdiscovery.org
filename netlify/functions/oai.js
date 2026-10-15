import fs from 'node:fs/promises';
import { handleOai } from '../../lib/oai.js';

let catalog;
export default async function(request) {
  try { catalog ||= JSON.parse(await fs.readFile('_site/oai/records.json','utf8')); }
  catch { return new Response('Metadata catalog unavailable.',{status:503}); }
  return handleOai(request,catalog);
}
