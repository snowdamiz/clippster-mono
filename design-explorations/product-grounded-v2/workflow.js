const svg=document.querySelector('#map');
const details=['Local files, downloaded VODs, or live recordings. Your source footage stays at the start of the workflow.','Use AI suggestions or choose the range yourself. Review the moment before making the cut.','Edit the source directly or refine a clip. Trim, frame, add sound and captions; create covers in Image Studio.','Build a clip or export your edit. Keep the file, publish now, or schedule to connected social accounts.'];
const nodes=[
{x:12,y:145,w:120,h:80,s:0,title:'Source video',sub:'FILE / VOD',icon:'M43 19 H72 V47 H43 Z M54 26 L65 33 L54 40 Z'},
{x:-5,y:302,w:110,h:80,s:0,title:'Live sources',sub:'WATCH / RECORD',icon:'M46 21 Q34 31 46 41 M64 21 Q76 31 64 41 M53 28 H57 V34 H53 Z'},
{x:185,y:155,w:150,h:100,s:1,title:'Find & review',sub:'AI / MANUAL',wave:true},
{x:340,y:260,w:245,h:173,s:2,title:'Video editor',sub:'TRIM / FRAME / SOUND',image:true},
{x:505,y:65,w:144,h:68,s:2,title:'Captions',sub:'YOUR WORDS',icon:'M20 18 H40 M30 18 V39 M24 39 H36'},
{x:210,y:408,w:130,h:80,s:2,title:'Image Studio',sub:'COVERS / BETA',icon:'M48 17 H80 V43 H48 Z M48 37 L58 27 L67 36 L74 28 L80 36'},
{x:620,y:365,w:150,h:100,s:3,title:'Finish & share',sub:'EXPORT / PUBLISH',icon:'M58 17 H87 V44 H58 Z M66 28 L73 35 L82 23'}
];
function node(n){return '<g class="node" data-step="'+n.s+'" role="button" tabindex="0" aria-label="'+n.title+'" transform="translate('+n.x+' '+n.y+')"><rect class="layer" y="16" width="'+n.w+'" height="'+n.h+'" rx="8"/><rect class="base" y="8" width="'+n.w+'" height="'+n.h+'" rx="8"/><rect class="face" width="'+n.w+'" height="'+n.h+'" rx="8"/>'+ (n.image?'<image class="shot" href="captures/02-editor-overview.png" x="8" y="7" width="229" height="138"/><text class="label" x="15" y="160">'+n.title+'</text>':(n.icon?'<path class="icon" d="'+n.icon+'"/>':'')+(n.wave?'<g class="wave">'+Array.from({length:30},(_,i)=>{let h=5+Math.abs(Math.sin(i*1.7))*25;return '<path d="M'+(15+i*4)+' '+(36-h/2)+' v'+h+'"/>'}).join('')+'</g>':'')+'<text class="label" x="'+(n.title==='Captions'?53:12)+'" y="'+(n.title==='Captions'?34:n.h-24)+'">'+n.title+'</text><text class="small" x="12" y="'+(n.h-10)+'">'+n.sub+'</text>')+'<circle class="led" cx="'+(n.w-13)+'" cy="13" r="2.5"/></g>'}
const paths=['M75 160 V115 H250 V180 H360 V280 H485 V400 H650','M50 340 H110 V235 H240','M580 110 H440 V280','M485 410 H590 V400 H650'];
svg.innerHTML='<defs><filter id="glow"><feGaussianBlur stdDeviation="1.8" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter><radialGradient id="fade"><stop offset="35%" stop-color="white"/><stop offset="100%" stop-color="black"/></radialGradient><mask id="mask"><rect width="1260" height="760" fill="url(#fade)"/></mask></defs><g mask="url(#mask)"><g id="grid" transform="matrix(.866,-.68,.866,.68,80,405)"></g></g><g transform="matrix(.866,-.68,.866,.68,80,405)">'+paths.map((d,i)=>'<path class="route" d="'+d+'"/><path class="signal" d="'+d+'" style="animation-delay:-'+i*2+'s"/>').join('')+nodes.map(node).join('')+'<text class="small" x="620" y="498">INSTAGRAM · TIKTOK · YOUTUBE · X</text><text class="small" x="365" y="468">CLIPPSTER / CREATIVE WORKSPACE</text></g>';
document.querySelector('#grid').innerHTML=Array.from({length:36},(_,i)=>{const n=i*55-700;return '<path class="grid" d="M'+n+' -700 V1200 M-700 '+n+' H1200"/>'}).join('');

let step=0,paused=false,time=0,last=performance.now();const media=matchMedia('(prefers-reduced-motion: reduce)');
function select(n){step=n;time=0;document.querySelector('#detail').textContent=details[n];document.querySelectorAll('[data-step]').forEach(e=>{e.classList.toggle('active',+e.dataset.step===n);e.setAttribute('aria-pressed',String(+e.dataset.step===n))})}
function pause(v){paused=v;document.body.classList.toggle('paused',v)}
function reduced(v){document.body.classList.toggle('reduced',v)}
document.querySelectorAll('[data-step]').forEach(e=>{const go=()=>{select(+e.dataset.step);pause(true)};e.onclick=go;if(e.tagName.toLowerCase()==='g')e.onkeydown=k=>{if(k.key==='Enter'||k.key===' '){k.preventDefault();go()}}});
media.onchange=e=>reduced(e.matches);document.addEventListener('visibilitychange',()=>document.body.classList.toggle('paused',paused||document.hidden));
function tick(t){const dt=Math.min(t-last,100);last=t;if(!paused&&!media.matches&&!document.hidden){time+=dt;if(time>5000)select((step+1)%4)}requestAnimationFrame(tick)}select(0);reduced(media.matches);requestAnimationFrame(tick);
