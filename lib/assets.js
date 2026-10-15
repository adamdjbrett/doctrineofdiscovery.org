import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';

const images = {
  '/assets/images/doctrine-of-discovery-project-logo.png':'/assets/images/optimized/site-logo.webp',
  '/assets/images/skanonh-center-colonial-image-horizontal.jpg':'/assets/images/optimized/home-hero.webp',
  '/assets/images/papal-bull-doctrine-of-discovery-500x300.jpg':'/assets/images/optimized/papal-bulls.webp',
  '/assets/images/book-1659717_500x600.jpg':'/assets/images/optimized/law.webp',
  '/assets/images/Doctrine-of-discovery-Standing-Rock-1-500x600.jpg':'/assets/images/optimized/repudiations.webp',
  '/assets/images/authors/rjmill10.png':'/assets/images/optimized/robert-miller.webp',
  '/assets/images/Mission-Interior-from-Lookout.jpg':'/assets/images/optimized/default-teaser.webp'
};

export function imageDimensions(buffer) {
  if(buffer.length<30) return null;
  if(buffer.subarray(1,4).toString()==='PNG') return [buffer.readUInt32BE(16),buffer.readUInt32BE(20)];
  if(buffer.subarray(0,3).toString()==='GIF') return [buffer.readUInt16LE(6),buffer.readUInt16LE(8)];
  if(buffer.subarray(0,4).toString()==='RIFF' && buffer.subarray(8,12).toString()==='WEBP') {
    const type=buffer.subarray(12,16).toString();
    if(type==='VP8X') return [1+buffer.readUIntLE(24,3),1+buffer.readUIntLE(27,3)];
    if(type==='VP8 ') return [buffer.readUInt16LE(26)&16383,buffer.readUInt16LE(28)&16383];
    if(type==='VP8L') {const bits=buffer.readUInt32LE(21);return [1+(bits&16383),1+((bits>>>14)&16383)];}
  }
  if(buffer[0]===255 && buffer[1]===216) {
    let offset=2;
    while(offset+9<buffer.length) {
      if(buffer[offset++]!==255) break;
      while(buffer[offset]===255)offset++;
      if(offset+8>=buffer.length)return null;
      const marker=buffer[offset++];
      if(marker===217 || marker===218) break;
      const length=buffer.readUInt16BE(offset);
      if(length<2)break;
      if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker))return [buffer.readUInt16BE(offset+5),buffer.readUInt16BE(offset+3)];
      offset+=length;
    }
  }
  return null;
}

export function compactCss(css) {
  return css.split(/("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\/\*[\s\S]*?\*\/)/g).map((part,index)=>{
    if (part.startsWith('/*')) return part.startsWith('/*!')?part:'';
    return index%2 ? part : part.replace(/\s+/g,' ').replace(/\s*([{}:;,])\s*/g,'$1').replace(/;}/g,'}');
  }).join('').trim();
}

export function assetManager({serve=false}={}) {
  const generated=new Map();
  const dimensions=new Map();
  function url(value) {
    if (!value || !String(value).startsWith('/assets/')) return value || '';
    if (serve && /\.(css|js)$/.test(value)) return value;
    const source=images[value] || value;
    if (!path.resolve(source.slice(1)).startsWith(path.resolve('assets')+path.sep)) throw new Error('Asset path must stay inside assets.');
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
    return html.replace(/<i\b([^>]*\bclass=(["'])(.*?)\2[^>]*)>\s*<\/i>/g,(tag,attributes,quote,classes)=>{
      const names=classes.split(/\s+/);
      const style=names.includes('fab')?'brands':names.includes('far')?'regular':'solid';
      const name=names.find(name=>name.startsWith('fa-')&&!/^fa-(fw|lg|\dx|spin|pulse|solid|regular|brands)$/.test(name));
      if (!name) return tag;
      const id=style+'-'+name.slice(3);
      if (!icons.has(id)) throw new Error(`Missing local icon: ${id}. Add it to assets/icons/fontawesome.svg.`);
      return `<svg${attributes.replace(/class=(["'])/,'class=$1site-icon ')} focusable="false"${attributes.includes('aria-hidden=')?'':' aria-hidden="true"'}><use href="${url('/assets/icons/fontawesome.svg')}#${id}"></use></svg>`;
    });
  }
  function renderImages(html) {
    return html.replace(/<img\b[^>]*>/g,tag=>{
      const src=tag.match(/\bsrc=(["'])(.*?)\1/)?.[2];
      if(!src?.startsWith('/assets/'))return tag;
      const source=new URL(src,'https://local.invalid').pathname;
      if(!path.resolve(source.slice(1)).startsWith(path.resolve('assets')+path.sep))throw new Error('Image path must stay inside assets.');
      const existing=[...generated.values()].find(asset=>asset.url===source);
      if(!existing && !fs.existsSync((images[source] || source).slice(1)))return tag;
      const target=existing?source:url(source);
      const asset=existing || [...generated.values()].find(asset=>asset.url===target);
      if(!dimensions.has(target))dimensions.set(target,imageDimensions(asset.content));
      const size=dimensions.get(target);
      let result=tag.replace(src,target);
      if(size && !/\b(?:width|height)=/.test(tag))result=result.replace(/\s*\/?>$/,` width="${size[0]}" height="${size[1]}">`);
      return result;
    });
  }
  return {url,renderIcons,renderImages,write(destination) {
    for(const asset of generated.values()) {
      const file=path.join(destination,asset.url.slice(1));
      fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,asset.content);
    }
  }};
}
