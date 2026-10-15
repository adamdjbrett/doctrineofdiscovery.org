import fs from 'node:fs';
import path from 'node:path';
import { timezone } from './lib/content.js';
import { getSite, resetSite } from './lib/site.js';
import { writeMetadata } from './lib/metadata.js';
import { handleOai } from './lib/oai.js';

process.env.TZ = timezone;
export default function (config) {
  config.on('eleventy.before', ({ directories, runMode }) => {
    resetSite();
    if (runMode === 'build' && path.resolve(directories.output) === path.resolve('_site')) fs.rmSync('_site', { recursive: true, force: true });
  });
  config.on('eleventy.after', async ({ directories }) => writeMetadata(await getSite(),directories.output));
  if (process.env.ELEVENTY_RUN_MODE === 'serve') {
    config.setServerOptions({ middleware: [async (req,res,next) => {
      const url=new URL(req.url,'http://localhost');
      if (!['/oai','/oai/'].includes(url.pathname)) return next();
      const request=new Request(url,{method:req.method,headers:req.headers,
        ...(['GET','HEAD'].includes(req.method)?{}:{body:req,duplex:'half'})});
      const catalog=JSON.parse(await fs.promises.readFile(path.join(config.directories.output,'oai/records.json'),'utf8'));
      const response=await handleOai(request,catalog);
      res.writeHead(response.status,Object.fromEntries(response.headers));
      res.end(Buffer.from(await response.arrayBuffer()));
    }] });
  }
  const relativeOutput = path.relative(process.cwd(), path.resolve(config.directories.output));
  const outputInProject = relativeOutput !== '..' && !relativeOutput.startsWith('..' + path.sep) && !path.isAbsolute(relativeOutput);
  // The dev server allows source aliases only inside the project directory.
  if (process.env.ELEVENTY_RUN_MODE === 'serve' && outputInProject) {
    config.setServerPassthroughCopyBehavior('passthrough');
    // Styles and scripts can reload directly without rendering every page.
    const clientAssets = ['assets/css/**', 'assets/js/**'];
    for (const target of clientAssets) config.watchIgnores.add(target);
    config.setServerOptions({
      watch: clientAssets,
      // Generated citations take precedence over historical source copies.
      aliases: { '/assets/citations/': path.resolve(config.directories.output, 'assets/citations') + path.sep }
    });
  }
  config.addPassthroughCopy('assets');
  config.addPassthroughCopy('admin');
  for (const filename of ['_redirects','_headers','robots.txt','favicon.ico','CNAME','BingSiteAuth.xml','googlebfdcfddbdbfcbd99.html','humans.txt','LICENSE','LICENSE.minimal-mistakes']) config.addPassthroughCopy(filename);
  for (const target of ['_posts','_pages','_authors','_includes','_layouts','_data','_config.yml','lib']) config.addWatchTarget(target, { resetConfig: true });
  return { templateFormats: ['11ty.js'], dir: { input: '.', output: '_site', data: '_eleventy_data', includes: '_includes' } };
}
