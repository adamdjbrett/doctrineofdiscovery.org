const fs=require('node:fs');
const path=require('node:path');
const yaml=require('js-yaml');
let previous;
const production=constants=>process.env.CONTEXT==='production' && process.env.NETLIFY==='true' && constants.IS_LOCAL===false;

module.exports={
  async onPreBuild({constants}) {
    previous=undefined;
    if (!production(constants)) return;
    const site=yaml.load(fs.readFileSync('_config.yml','utf8'));
    try {
      const response=await fetch(new URL('/indexnow.json',site.url),{redirect:'error',signal:AbortSignal.timeout(15000)});
      if (response.ok) previous=await response.json();
      else if (response.status!==404) console.warn(`IndexNow: previous manifest returned HTTP ${response.status}; current URLs will be submitted.`);
    } catch(error) {console.warn(`IndexNow: previous manifest unavailable (${error.message}); current URLs will be submitted.`);}
  },
  async onSuccess({constants}) {
    if (!production(constants)) return;
    try {
      const {changedUrls,submitIndexNow,withKey}=await import('../../../lib/indexnow.js');
      const current=withKey(JSON.parse(fs.readFileSync(path.join(constants.PUBLISH_DIR,'indexnow.json'),'utf8')),yaml.load(fs.readFileSync('_config.yml','utf8')).indexnow.key);
      // A malformed old manifest must not prevent notification of the new one.
      let urls;
      try {urls=changedUrls(current,previous);} catch {urls=changedUrls(current,null);}
      console.log(`IndexNow: accepted ${await submitIndexNow(current,urls)} new, changed, or removed URLs.`);
    } catch(error) {console.warn(`IndexNow notification failed after deployment: ${error.message}`);}
  }
};
