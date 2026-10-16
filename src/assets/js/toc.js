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
