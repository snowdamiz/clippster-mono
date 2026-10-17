
const siteHeader=document.querySelector('.site-header'),menuToggle=document.querySelector('.menu-toggle');
document.querySelector('#site-nav').replaceChildren(...window.landingSource.nav.map(({href,label})=>{
const a=document.createElement('a');a.href=href;a.textContent=label;
if(href==='/')a.setAttribute('aria-current','page');return a;
}));
function setHeaderMenu(open){
siteHeader.classList.toggle('menu-open',open);menuToggle.setAttribute('aria-expanded',String(open));
menuToggle.setAttribute('aria-label',open?'Close menu':'Open menu');menuToggle.textContent=open?'×':'☰';
}
menuToggle.addEventListener('click',()=>setHeaderMenu(menuToggle.getAttribute('aria-expanded')!=='true'));
siteHeader.addEventListener('keydown',e=>{if(e.key==='Escape'){setHeaderMenu(false);menuToggle.focus();}});
document.addEventListener('click',e=>{if(!siteHeader.contains(e.target))setHeaderMenu(false);});
document.querySelector('#header-menu').addEventListener('click',e=>{if(e.target.closest('a'))setHeaderMenu(false);});
matchMedia('(min-width:1200px)').addEventListener('change',()=>setHeaderMenu(false));

const platforms=document.createElement("nav");platforms.className="mobile-platforms";platforms.setAttribute("aria-label","Platform guides");
[{"href":"/platforms/twitch","label":"Twitch Clipping Tool"},{"href":"/platforms/kick","label":"Kick Clipping Tool"},{"href":"/platforms/youtube","label":"YouTube Clipping & Shorts Publishing"}].forEach(({href,label})=>{const a=document.createElement("a");a.href=href;a.textContent=label;platforms.append(a);});document.querySelector("#header-menu").append(platforms);
