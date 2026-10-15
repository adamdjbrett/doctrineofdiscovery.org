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
const script=document.querySelector('script[data-gallery]');
const form=document.querySelector('#site-search-form');
if (form && script.dataset.search) {
  const loadSearch=()=>import(script.dataset.search).catch(()=>{document.querySelector('#search-status').textContent='Search could not be loaded. Please reload and try again.';});
  form.addEventListener('focusin',loadSearch,{once:true});
  form.addEventListener('input',loadSearch,{once:true});
  form.addEventListener('submit',event=>{event.preventDefault();loadSearch();},{once:true});
  if (new URLSearchParams(location.search).get('q')) loadSearch();
}
document.addEventListener('click',async event=>{
  const link=event.target.closest('.page__content a[href]');
  if (!link || !link.querySelector(':scope > img') || !/\.(?:jpe?g|png|gif|webp|avif)(?:[?#]|$)/i.test(link.href) || event.button || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  try { (await import(script.dataset.gallery)).open(link); }
  catch { location.href=link.href; }
});
