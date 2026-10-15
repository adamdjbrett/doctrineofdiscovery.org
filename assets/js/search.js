const input = document.querySelector('#search');
const results = document.querySelector('#results');
const status = document.querySelector('#search-status');
let searchData;
let library;
function loadLibrary() {
  if (window.lunr) return Promise.resolve();
  return library ||= new Promise((resolve,reject) => {
    const script = document.createElement('script'); script.src='/assets/js/lunr/lunr.min.js';
    script.onload=resolve; script.onerror=() => { script.remove(); library=undefined; reject(new Error('Search library could not be loaded')); };
    document.head.append(script);
  });
}
async function search() {
  const query = input.value.trim();
  results.replaceChildren();
  if (!query) { status.textContent = ''; return; }
  status.textContent = 'Searching…';
  try {
    await loadLibrary();
    searchData ||= fetch('/assets/js/lunr/store.json').then(response => {
      if (!response.ok) throw new Error('Search index could not be loaded');
      return response.json();
    }).then(store => ({ store, index: lunr(function () {
      this.field('title', { boost: 10 }); this.field('excerpt'); this.field('categories'); this.field('tags'); this.ref('id');
      store.forEach((item,id) => this.add({ ...item, id }));
    }) })).catch(error => { searchData = undefined; throw error; });
    const {store,index} = await searchData;
    if (input.value.trim() !== query) return;
    const matches = index.query(q => {
      for (const term of lunr.tokenizer(query)) {
        q.term(term.toString(), { boost: 10 });
        q.term(term.toString(), { wildcard: lunr.Query.wildcard.TRAILING, usePipeline: false });
      }
    });
    status.textContent = `${matches.length} result${matches.length === 1 ? '' : 's'} found`;
    const fragment = document.createDocumentFragment();
    const found = document.createElement('p'); found.className='results__found'; found.textContent=matches.length+' Result(s) found'; fragment.append(found);
    for (const match of matches) {
      const item = store[match.ref];
      const wrapper = document.createElement('div'); wrapper.className='list__item';
      const article = document.createElement('article'); article.className = 'archive__item'; article.setAttribute('itemscope',''); article.setAttribute('itemtype','https://schema.org/CreativeWork');
      const heading = document.createElement('h2'); heading.className = 'archive__item-title'; heading.setAttribute('itemprop','headline');
      const link = document.createElement('a'); link.href = item.url; link.textContent = item.title; link.rel='permalink';
      const summary = document.createElement('p'); summary.className='archive__item-excerpt'; summary.setAttribute('itemprop','description'); summary.textContent = item.excerpt.split(/\s+/).slice(0,20).join(' ')+'...';
      heading.append(link); article.append(heading);
      if (item.teaser) {
        const teaser=document.createElement('div'); teaser.className='archive__item-teaser';
        const image=document.createElement('img'); image.src=item.teaser; image.alt=''; teaser.append(image); article.append(teaser);
      }
      article.append(summary); wrapper.append(article); fragment.append(wrapper);
    }
    results.replaceChildren(fragment);
  } catch { status.textContent = 'Search could not be loaded. Please try again.'; }
}
let timer;
input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(search,150); });
document.querySelector('#site-search-form').addEventListener('submit', event => { event.preventDefault(); clearTimeout(timer); search(); });
input.value = new URLSearchParams(location.search).get('q') || '';
if (input.value) search();
