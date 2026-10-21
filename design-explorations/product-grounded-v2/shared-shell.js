(()=>{const source=window.landingSource;const esc=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const footerGroups={
  Workspace:[...source.links.Solutions,source.links.Compare.find(p=>p.label==='Pricing')],
  Alternatives:source.links.Compare.filter(p=>p.label!=='Pricing'),
  Resources:[{label:'Guides',href:'/guides/how-to-clip-twitch-streams'},...source.links.Authority.filter(p=>!['Privacy','Terms'].includes(p.label))]
};
const excluded=new Set(source.nav.map(p=>p.href));for(const key of Object.keys(footerGroups))footerGroups[key]=footerGroups[key].filter(p=>!excluded.has(p.href));
const quietLink=({label,href})=>'<a href="'+href+'">'+esc(label)+'</a>';


window.previewShell={footer:()=>`<footer class="full-footer"><div class="footer-main"><div class="footer-intro"><div class="brand"><img src="/prototype/assets/logo-icon.svg" alt=""><img src="/prototype/assets/logo.svg" alt="Clippster"></div><p>Your moments.<br>Your creative workspace.</p><span class="footer-availability">DESKTOP · MACOS & WINDOWS</span></div><div class="footer-links">${Object.entries(footerGroups).map(([category,items])=>`<nav aria-label="${category}"><h3>${category}</h3>${items.map(quietLink).join('')}</nav>`).join('')}</div></div><div class="footer-bottom"><span>© ${new Date().getFullYear()} Clippster</span><div>${source.links.Authority.filter(p=>['Privacy','Terms'].includes(p.label)).map(quietLink).join('')}</div></div></footer>`};})();