// Native dialog retains the theme's Magnific Popup appearance and keyboard support.
const images = [...document.querySelectorAll('.page__content a[href]')].filter(link => link.querySelector(':scope > img') && /\.(?:jpe?g|png|gif|webp|avif)(?:[?#]|$)/i.test(link.href));
let openGallery;
export function open(link) {
if (openGallery) return openGallery(link);
if (!images.length) { location.href=link.href; return; }
  const dialog = document.createElement('dialog');
  dialog.className = 'image-viewer mfp-wrap mfp-gallery mfp-ready';
  dialog.setAttribute('aria-label', 'Image viewer');
  dialog.innerHTML = `<div class="mfp-container mfp-image-holder"><div class="mfp-content"><div class="mfp-figure"><button type="button" class="mfp-close" aria-label="Close">×</button><figure><img class="mfp-img" alt=""><figcaption><div class="mfp-bottom-bar"><div class="mfp-title"></div><div class="mfp-counter"></div></div></figcaption></figure></div></div><button type="button" class="mfp-arrow mfp-arrow-left" aria-label="Previous image"></button><button type="button" class="mfp-arrow mfp-arrow-right" aria-label="Next image"></button></div>`;
  const image = dialog.querySelector('img');
  const caption = dialog.querySelector('.mfp-title');
  let current = 0;
  function show(index) {
    current = (index + images.length) % images.length;
    image.src = images[current].href;
    image.alt = images[current].querySelector('img')?.alt || '';
    image.style.maxHeight = innerHeight+'px';
    caption.textContent = images[current].title || '';
    dialog.querySelector('.mfp-counter').textContent = `${current + 1} of ${images.length}`;
  }
  image.addEventListener('error', () => { caption.replaceChildren(); const link=document.createElement('a'); link.href=image.src; link.textContent='Image could not be loaded. Open original.'; caption.append(link); });
  dialog.querySelector('.mfp-close').addEventListener('click',()=>dialog.close());
  dialog.querySelector('.mfp-arrow-left').addEventListener('click',()=>show(current-1));
  dialog.querySelector('.mfp-arrow-right').addEventListener('click',()=>show(current+1));
  image.addEventListener('click',()=>show(current+1));
  document.body.append(dialog);
  openGallery=link=>{ show(images.indexOf(link)); dialog.showModal(); };
  openGallery(link);
  dialog.addEventListener('click', event => { if (event.target === dialog || event.target.classList.contains('mfp-container')) dialog.close(); });
  dialog.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); show(current + (event.key === 'ArrowLeft' ? -1 : 1)); }
  });
}
