import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';

const images = {
  '/assets/images/doctrine-of-discovery-project-logo.png':'/assets/images/optimized/site-logo.webp',
  '/assets/images/skanonh-center-colonial-image-horizontal.jpg':'/assets/images/optimized/home-hero.webp',
  '/assets/images/papal-bull-doctrine-of-discovery-500x300.jpg':'/assets/images/optimized/papal-bulls.webp',
  '/assets/images/book-1659717_500x600.jpg':'/assets/images/optimized/law.webp',
  '/assets/images/Doctrine-of-discovery-Standing-Rock-1-500x600.jpg':'/assets/images/optimized/repudiations.webp'
};

export function compactCss(css) {
  return css.split(/("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\/\*[\s\S]*?\*\/)/g).map((part,index)=>{
    if (part.startsWith('/*')) return part.startsWith('/*!')?part:'';
    return index%2 ? part : part.replace(/\s+/g,' ').replace(/\s*([{}:;,])\s*/g,'$1').replace(/;}/g,'}');
  }).join('').trim();
}

export function assetManager({serve=false}={}) {
  const generated=new Map();
  function url(value) {
    if (!value || !String(value).startsWith('/assets/')) return value || '';
    if (serve && /\.(css|js)$/.test(value)) return value;
    const source=images[value] || value;
    if (!generated.has(source)) {
      let content=fs.readFileSync(source.slice(1));
      if (source.endsWith('.css')) content=Buffer.from(compactCss(content.toString()));
      const name=path.basename(source,path.extname(source));
      const hash=createHash('sha256').update(content).digest('hex').slice(0,16);
      generated.set(source,{url:`/assets/built/${name}.${hash}${path.extname(source)}`,content});
    }
    return generated.get(source).url;
  }
  const sprite=fs.readFileSync('assets/icons/fontawesome.svg','utf8');
  const icons=new Set([...sprite.matchAll(/<symbol id="([^"]+)"/g)].map(match=>match[1]));
  function renderIcons(html) {
    return html.replace(/<i\b([^>]*\bclass="([^"]+)"[^>]*)>\s*<\/i>/g,(tag,attributes,classes)=>{
      const names=classes.split(/\s+/);
      const style=names.includes('fab')?'brands':names.includes('far')?'regular':'solid';
      const name=names.find(name=>name.startsWith('fa-')&&!/^fa-(fw|lg|\dx|spin|pulse|solid|regular|brands)$/.test(name));
      if (!name) return tag;
      const id=style+'-'+name.slice(3);
      if (!icons.has(id)) throw new Error(`Missing local icon: ${id}. Add it to assets/icons/fontawesome.svg.`);
      return `<svg${attributes.replace('class="','class="site-icon ')} focusable="false"${attributes.includes('aria-hidden=')?'':' aria-hidden="true"'}><use href="${url('/assets/icons/fontawesome.svg')}#${id}"></use></svg>`;
    });
  }
  return {url,renderIcons,write(destination) {
    for(const asset of generated.values()) {
      const file=path.join(destination,asset.url.slice(1));
      fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,asset.content);
    }
  }};
}
