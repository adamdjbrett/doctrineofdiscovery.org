import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import * as pagefind from 'pagefind';
import {plainText} from './content.js';
import {markdown} from './templates.js';
import {publicDocument,publicationRecord} from './publication.js';
import {imageDimensions} from './assets.js';

const text=value=>markdown.utils.unescapeAll(plainText(String(value || '').replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,' ')));

export function searchRecords(site) {
  const sizes=new Map();
  return [...site.posts,...site.authors,...site.pages.filter(doc=>!doc.hidden && doc.url!=='/search/' && doc.output.endsWith('.html'))]
    .filter(publicDocument).sort((a,b)=>a.url.localeCompare(b.url)).map(doc=>{
      const record=publicationRecord(site,doc);
      const image=doc.header?.teaser || site.teaser;
      if(image?.startsWith('/assets/') && !sizes.has(image))sizes.set(image,fs.existsSync('src' + image)?imageDimensions(fs.readFileSync('src' + image)):null);
      const size=sizes.get(image);
      return {url:doc.url,language:site.locale.split(/[-_]/)[0],
        content:text([record.title,doc.bio,doc.content,...doc.tags,...doc.categories,record.authors.map(author=>author.name).join(' ')].filter(Boolean).join('\n')),
        meta:{title:record.title,description:text(doc.bio || record.description),
          ...(image?{image:site.assets.url(image)}:{}),...(size?{image_width:String(size[0]),image_height:String(size[1])}:{})}};
    });
}

export async function buildSearchIndex(site) {
  const check=result=>{if(result.errors?.length)throw new Error('Pagefind: '+result.errors.join('; '));return result;};
  try {
    const {index}=check(await pagefind.createIndex({writePlayground:false}));
    const records=searchRecords(site);
    await Promise.all(records.map(async record=>check(await index.addCustomRecord(record))));
    // The API-only interface does not need Pagefind's prebuilt UI or highlighting bundles.
    const files=check(await index.getFiles()).files.filter(file=>!/^pagefind-(?:ui|modular-ui|component-ui|highlight|worker)[.]/.test(file.path));
    const hash=createHash('sha256');
    for(const file of [...files].sort((a,b)=>a.path.localeCompare(b.path)))hash.update(file.path).update(file.content);
    const directory=`assets/built/pagefind.${hash.digest('hex').slice(0,16)}`;
    return {url:`/${directory}/pagefind.js`,count:records.length,write(destination) {
      for(const file of files) {
        const target=path.join(destination,directory,file.path);
        fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,file.content);
      }
    }};
  } finally {await pagefind.close();}
}
