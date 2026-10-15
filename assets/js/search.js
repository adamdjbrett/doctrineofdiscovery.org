const form=document.querySelector('#site-search-form');
const input=document.querySelector('#search');
const results=document.querySelector('#results');
const status=document.querySelector('#search-status');
let library,timer,revision=0;

async function search() {
  const current=++revision;
  const query=input.value.trim();
  results.replaceChildren();
  if (!query) {status.textContent='';return;}
  status.textContent='Searching…';
  try {
    const pagefind=await (library ||= import(form.dataset.pagefind).catch(error=>{library=undefined;throw error;}));
    const {results:matches}=await pagefind.search(query);
    if(current!==revision)return;
    status.textContent=`${matches.length} result${matches.length===1?'':'s'} found`;
    let shown=0;
    const more=document.createElement('button');more.type='button';more.className='btn btn--primary';more.textContent='Show more results';
    async function showMore() {
      more.disabled=true;
      try {
        const items=await Promise.all(matches.slice(shown,shown+10).map(match=>match.data()));
        if(current!==revision)return;
        for(const item of items) {
          const wrapper=document.createElement('div');wrapper.className='list__item';
          const article=document.createElement('article');article.className='archive__item';
          const heading=document.createElement('h2');heading.className='archive__item-title';
          const link=document.createElement('a');link.href=item.url;link.textContent=item.meta.title;link.rel='permalink';
          heading.append(link);article.append(heading);
          if(item.meta.image) {
            const teaser=document.createElement('div');teaser.className='archive__item-teaser';
            const image=document.createElement('img');image.src=item.meta.image;image.alt='';image.loading='lazy';image.decoding='async';
            if(item.meta.image_width && item.meta.image_height){image.width=Number(item.meta.image_width);image.height=Number(item.meta.image_height);}
            teaser.append(image);article.append(teaser);
          }
          const summary=document.createElement('p');summary.className='archive__item-excerpt';
          // Pagefind escapes excerpt content before inserting its <mark> highlights.
          summary.innerHTML=item.excerpt;
          article.append(summary);wrapper.append(article);results.insertBefore(wrapper,more.parentNode===results?more:null);
        }
        shown+=items.length;
        if(shown<matches.length){results.append(more);more.disabled=false;}else more.remove();
      } catch {if(current===revision){status.textContent='Search results could not be loaded. Please try again.';more.disabled=false;}}
    }
    more.addEventListener('click',showMore);
    await showMore();
  } catch {if(current===revision)status.textContent='Search could not be loaded. Please try again.';}
}
input.addEventListener('input',()=>{revision++;clearTimeout(timer);timer=setTimeout(search,150);});
form.addEventListener('submit',event=>{event.preventDefault();clearTimeout(timer);search();});
input.value=new URLSearchParams(location.search).get('q') || input.value;
if(input.value)search();
