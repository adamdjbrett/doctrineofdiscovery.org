// Keep Minimal Mistakes' DOM and responsive navigation without jQuery.
const nav = document.querySelector('.greedy-nav');
if (nav) {
  const visible = nav.querySelector('.visible-links');
  const hidden = nav.querySelector('.hidden-links');
  const toggle = nav.querySelector('.greedy-nav__toggle');
  const links = [...visible.children];
  function fitNavigation() {
    visible.append(...links);
    toggle.classList.remove('hidden');
    const width = element => {
      const style = getComputedStyle(element);
      return element.getBoundingClientRect().width + parseFloat(style.marginLeft) + parseFloat(style.marginRight);
    };
    const reserved = [...nav.children].filter(el => el !== visible && el !== hidden).reduce((sum, el) => sum + width(el), 0);
    const available = nav.clientWidth - reserved;
    let used = 0;
    for (const link of links) {
      used += width(link);
      if (used > available) hidden.append(link);
    }
    toggle.classList.toggle('hidden', !hidden.children.length);
    toggle.setAttribute('count', hidden.children.length);
  }
  function closeMenu() {
    hidden.classList.add('hidden'); toggle.classList.remove('close'); toggle.setAttribute('aria-expanded','false');
  }
  toggle.setAttribute('aria-expanded','false');
  toggle.addEventListener('click', () => {
    const open = hidden.classList.toggle('hidden') === false;
    toggle.classList.toggle('close', open); toggle.setAttribute('aria-expanded',String(open));
  });
  hidden.addEventListener('click', closeMenu);
  document.addEventListener('keydown', event => { if (event.key === 'Escape') closeMenu(); });
  window.addEventListener('resize', fitNavigation);
  nav.querySelector('img')?.addEventListener('load', fitNavigation);
  document.fonts.ready.then(fitNavigation);
  fitNavigation();
}
const follow = document.querySelector('.author__urls-wrapper button');
follow?.addEventListener('click', () => {
  const open = document.querySelector('.author__urls').classList.toggle('is--visible');
  follow.classList.toggle('open',open); follow.setAttribute('aria-expanded',String(open));
});
const searchToggle = document.querySelector('.search__toggle');
const searchOverlay = document.querySelector('.search-content');
function toggleSearch(open) {
  if (!searchOverlay) { location.href = '/search/'; return; }
  searchOverlay.classList.toggle('is--visible',open);
  document.querySelector('.initial-content').classList.toggle('is--hidden',open);
  searchToggle.setAttribute('aria-expanded',String(open));
  if (open) searchOverlay.querySelector('input').focus(); else searchToggle.focus();
}
searchToggle?.addEventListener('click', () => toggleSearch(!searchOverlay?.classList.contains('is--visible')));
document.addEventListener('keydown', event => { if (event.key === 'Escape' && searchOverlay?.classList.contains('is--visible')) toggleSearch(false); });
for (const heading of document.querySelectorAll('.page__content h1[id], .page__content h2[id], .page__content h3[id], .page__content h4[id], .page__content h5[id], .page__content h6[id]')) {
  const anchor = document.createElement('a');
  anchor.className='header-link'; anchor.href='#'+heading.id; anchor.title='Permalink';
  anchor.innerHTML='<span class="sr-only">Permalink</span><i class="fas fa-link" aria-hidden="true"></i>';
  heading.append(anchor);
}
// Native dialog retains the theme's Magnific Popup appearance and keyboard support.
const images = [...document.querySelectorAll('.page__content a[href]')].filter(link => link.querySelector(':scope > img') && /\.(?:jpe?g|png|gif|webp|avif)(?:[?#]|$)/i.test(link.href));
if (images.length) {
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
  images.forEach((link,index) => link.addEventListener('click', event => {
    if (event.button || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault(); show(index); dialog.showModal();
  }));
  dialog.addEventListener('click', event => { if (event.target === dialog || event.target.classList.contains('mfp-container')) dialog.close(); });
  dialog.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); show(current + (event.key === 'ArrowLeft' ? -1 : 1)); }
  });
}
for (const frame of document.querySelectorAll('#main iframe[src*="youtube"], #main iframe[src*="vimeo"]')) {
  if (frame.closest('.responsive-video-container')) continue;
  const wrapper=document.createElement('div'); wrapper.className='fluid-width-video-wrapper';
  wrapper.style.paddingTop = ((Number(frame.height)||9)/(Number(frame.width)||16)*100)+'%';
  frame.before(wrapper); wrapper.append(frame); frame.removeAttribute('width'); frame.removeAttribute('height');
}
const tocLinks=[...document.querySelectorAll('nav.toc a[href^="#"]')];
if (tocLinks.length) {
  const sections=tocLinks.map(link=>({link,heading:document.getElementById(decodeURIComponent(link.hash.slice(1)))})).filter(item=>item.heading);
  let active, scheduled=false;
  function updateToc() {
    scheduled=false;
    const current=sections.filter(item=>item.heading.getBoundingClientRect().top<=20).at(-1);
    if (active===current) return;
    active?.link.parentElement.classList.remove('active'); active?.heading.classList.remove('active');
    current?.link.parentElement.classList.add('active'); current?.heading.classList.add('active'); active=current;
    const sidebar=current?.link.closest('.sidebar__right.sticky');
    if (sidebar && getComputedStyle(sidebar).position==='sticky') current.link.scrollIntoView({block:'nearest'});
  }
  window.addEventListener('scroll',()=>{if(!scheduled){scheduled=true;requestAnimationFrame(updateToc);}}, {passive:true});
  updateToc();
}
