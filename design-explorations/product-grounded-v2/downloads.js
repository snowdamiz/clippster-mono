// Mirrors the production landing page's OS/architecture selection and release API.
function detectDownloadPlatform({userAgent='',platform='',renderer=''}={}) {
  const ua=userAgent.toLowerCase(), p=platform.toLowerCase(), gpu=renderer.toLowerCase();
  const os=/mac|darwin/.test(p)||/mac os|macos/.test(ua)?'mac':/win/.test(p)||/windows/.test(ua)?'windows':/linux/.test(p+' '+ua)?'linux':'unknown';
  let arch=/arm64|aarch64/.test(ua)?'arm64':'x64';
  if(os==='mac' && /apple m|apple gpu/.test(gpu)) arch='arm64';
  else if(os==='mac' && /intel/.test(gpu)) arch='x64';
  return {os,arch};
}
function chooseDownload(downloads,platform) {
  return downloads.find(d=>d.platform===`${platform.os}-${platform.arch}`)||downloads.find(d=>d.platform.startsWith(platform.os+'-'))||null;
}
if(typeof module!=='undefined') module.exports={detectDownloadPlatform,chooseDownload};
if(typeof document!=='undefined') {
  let renderer='';
  if(/mac/i.test(navigator.platform||'')) {
    try { const canvas=document.createElement('canvas'),gl=canvas.getContext('webgl')||canvas.getContext('experimental-webgl'); const info=gl?.getExtension('WEBGL_debug_renderer_info'); if(info) renderer=gl.getParameter(info.UNMASKED_RENDERER_WEBGL); } catch {}
  }
  const platform=detectDownloadPlatform({userAgent:navigator.userAgent,platform:navigator.platform,renderer});
  const releases='https://github.com/snowdamiz/clippster-releases/releases/latest';
  const fallback=[{platform:'mac-arm64',label:'Mac (Apple Silicon)',download_url:releases},{platform:'mac-x64',label:'Mac (Intel)',download_url:releases},{platform:'windows-x64',label:'Windows',download_url:releases}];
  const primaryLinks=[...document.querySelectorAll('.copy .cta,.download-row .cta,.download-section>.cta')];
  const versions=document.querySelector('.versions p');
  function render(downloads,isFallback) {
    const primary=chooseDownload(downloads,platform);
    for(const a of primaryLinks){a.textContent=primary?`Download for ${primary.label} ↗`:'Download for Mac or Windows ↗';a.href=primary?.download_url||releases;}

    const headerDownload=document.querySelector('.header-download');
    headerDownload.href=primary?.download_url||releases;
    headerDownload.title=primary?'Download for '+primary.label:'Download for Mac or Windows';
    headerDownload.setAttribute('aria-label',headerDownload.title);
    const secondary=downloads.find(d=>!d.platform.startsWith(platform.os+'-'))||downloads.find(d=>d!==primary);
    const other=document.querySelector('.header-secondary');
    other.href=secondary?.download_url||releases;
    other.textContent=secondary?.platform.startsWith('mac')?'Mac':'Windows';
    other.title='Download for '+(secondary?.label||'other platforms');
    other.setAttribute('aria-label',other.title);
    versions.replaceChildren();
    for(const d of downloads){const a=document.createElement('a');a.href=d.download_url;a.textContent=d.label;versions.append(a);}
    const note=document.querySelector('.download-section .fine');
    note.textContent=isFallback?'Choose your installer on the official releases page.':primary?`${primary.label} selected for this device. Other versions are available above.`:'Choose the version for your Mac or Windows computer.';
  }
  render(fallback,true);
  fetch('https://api.clippster.app/api/releases/latest',{signal:AbortSignal.timeout(8000),credentials:'omit'})
    .then(r=>{if(!r.ok)throw new Error('Release unavailable');return r.json();})
    .then(data=>{const downloads=(data.downloads||[]).filter(d=>/^(mac-(arm64|x64)|windows-x64)$/.test(d.platform)&&typeof d.label==='string'&&typeof d.download_url==='string'&&d.download_url.startsWith('https://'));if(downloads.length)render(downloads,false);})
    .catch(()=>{}); // Same official release-page fallback as production.
}
