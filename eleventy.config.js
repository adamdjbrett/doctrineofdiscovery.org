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
  config.on('eleventy.after', async ({ directories }) => {
    writeMetadata(await getSite(),directories.output);
  });
  if (process.env.ELEVENTY_RUN_MODE === 'serve') {
    config.setServerOptions({ middleware: [async (req,res,next) => {
      const url=new URL(req.url,'http://localhost');
      if (!['/oai','/oai/'].includes(url.pathname)) {
        if (['GET','HEAD'].includes(req.method)) {
          const rule=fs.readFileSync(path.join(config.directories.output,'_redirects'),'utf8').split('\n')
            .map(line=>line.trim().split(/\s+/)).find(parts=>parts[0]===url.pathname && /^30[12378]!?$/.test(parts[2] || '301'));
          if(rule) {
            const {site}=await getSite();
            const target=new URL(rule[1],site.url);
            if(!target.search)target.search=url.search;
            const location=target.origin===new URL(site.url).origin?target.pathname+target.search+target.hash:target.href;
            res.writeHead(parseInt(rule[2] || '301',10),{Location:location});res.end();return;
          }
        }
        return next();
      }
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
    const clientAssets = ['src/assets/css/**', 'src/assets/js/**'];
    for (const target of clientAssets) config.watchIgnores.add(target);
    config.setServerOptions({
      watch: ['src/assets/css', 'src/assets/js'],
      // Generated citations take precedence over historical source copies.
      aliases: {
        '/assets/citations/': path.resolve(config.directories.output, 'assets/citations') + path.sep,
        '/assets/built/': path.resolve(config.directories.output, 'assets/built') + path.sep
      }
    });
  }
  config.addPassthroughCopy('src/assets');
  config.addPassthroughCopy('src/admin');
  config.addPassthroughCopy('src/Screenshot-2019-03-11-02.46.46.png');
  for (const filename of ['_redirects','_headers','robots.txt','favicon.ico','CNAME','BingSiteAuth.xml','googlebfdcfddbdbfcbd99.html','humans.txt','sw.js','offline.html']) config.addPassthroughCopy('src/' + filename);
  for (const filename of ['LICENSE','LICENSE.minimal-mistakes']) config.addPassthroughCopy({ [filename]: filename });
  for (const target of ['src/_posts/**','src/_pages/**','src/_authors/**','src/_includes/**','src/_layouts/**','src/_data/**','src/_config.yml','lib/**']) config.addWatchTarget(target, { resetConfig: true });
  return { templateFormats: ['11ty.js'], dir: { input: 'src', output: '_site', data: '_eleventy_data', includes: '_includes' } };
}
