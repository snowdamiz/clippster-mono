import { SCENE_VISIBILITY_SCRIPT } from './sceneVisibility';
/** Runs after authored scene scripts in both the player and exported renders. */
export function sceneLayerScript(id: string): string {
  return `<script data-ai-editor-layers>(function(){
const variables=window.__hyperframes.getVariables();
const timeline=window.__timelines[${JSON.stringify(id)}];
const root=document.querySelector('[data-composition-id="${id.replace(/[^\w/-]/g, '')}"]');
if(!root)return;
let overrides={};try{const parsed=JSON.parse(variables.__editorLayers||'{}');if(parsed&&typeof parsed==='object'&&!Array.isArray(parsed))overrides=parsed;}catch{}
const children=timeline?timeline.getChildren(true,true,false):[];
const nodes=Array.from(root.querySelectorAll('*')).filter(node=>!node.closest('defs')&&!['script','style','stop','linearGradient','radialGradient','path','circle','rect','polygon','line','polyline','ellipse','g'].includes(node.localName));
function selector(node){const parts=[];while(node&&node!==root){parts.unshift(node.localName+':nth-child('+(Array.from(node.parentElement.children).indexOf(node)+1)+')');node=node.parentElement;}return parts.join(' > ');}
const layers=[];
for(const node of nodes){
 const authoredStyle=getComputedStyle(node);
 const animated=children.some(child=>child.targets?.().includes(node));
 if(node.localName!=='svg'&&node.localName!=='img'&&node.children.length&&!animated&&authoredStyle.backgroundImage==='none'&&authoredStyle.backgroundColor==='rgba(0, 0, 0, 0)')continue;
 const path=selector(node);const key='element:'+path;const change=overrides[key]||{};
 if(change.deleted){node.style.setProperty('display','none','important');continue;}
 for(const [name,value]of Object.entries(change.styles||{})){node.style.setProperty(name,value,'important');if(node.localName==='svg'&&['fill','stroke'].includes(name))for(const part of node.querySelectorAll('path,circle,rect,polygon,line,polyline,ellipse'))if(!part.closest('defs'))part.style.setProperty(name,value,'important');}
 if(change.hidden)node.style.setProperty('visibility','hidden','important');
 if(change.src){if(node.localName==='img')node.setAttribute('src',change.src);else node.style.setProperty('background-image','url('+JSON.stringify(change.src)+')','important');}
 if(change.svg&&node.localName==='svg'){const svg=new DOMParser().parseFromString(change.svg,'image/svg+xml').documentElement;if(svg.localName==='svg'){node.innerHTML=svg.innerHTML;node.setAttribute('viewBox',svg.getAttribute('viewBox')||'0 0 24 24');}}
 const style=getComputedStyle(node);const styles={};for(const name of ['translate','rotate','scale','opacity','color','background','border-color','fill','stroke','width','height'])styles[name]=node.style.getPropertyValue(name)||style.getPropertyValue(name);
 const start=Number(change.start||0),duration=Number(change.duration||variables.__editorDuration||root.dataset.duration||timeline?.duration()||1);
 const image=/url\\(/.test(style.backgroundImage);
 layers.push({key,kind:'element',category:node.localName==='svg'?'icons':node.localName==='img'||image?'images':'shapes',label:node.id||node.getAttribute('aria-label')||(node.getAttribute('class')||node.localName)+' '+(nodes.indexOf(node)+1),selector:path,start,duration,styles,src:node.getAttribute('src')||(/^url\\(["']?(.*?)["']?\\)$/.exec(style.backgroundImage)?.[1]||'')});
}
children.forEach((child,index)=>{
 const key='animation:'+index;const change=overrides[key]||{};
 if(change.deleted){child.paused(true);return;}
 if(Number.isFinite(change.start))child.startTime(Math.max(0,change.start));
 if(Number.isFinite(change.duration))child.duration(Math.max(0.001,change.duration));
 if(change.ease){child.vars.ease=change.ease;child.invalidate();}
 if(change.properties){Object.assign(child.vars,change.properties);child.invalidate();}
 if(change.fromProperties){child.vars.startAt={...child.vars.startAt,...change.fromProperties};child.invalidate();}
 if(change.hidden)child.paused(true);
 const targets=child.targets?child.targets():[];const target=targets.find(node=>node instanceof Element);const label=(target?(target.id||target.getAttribute('class')||target.localName):'Scene')+' · '+Object.keys(child.vars).filter(key=>!['duration','ease','parent','immediateRender','overwrite','startAt','delay','onComplete','onUpdate'].includes(key)).join(', ');
 function properties(vars){return Object.fromEntries(Object.entries(vars||{}).filter(([key,value])=>!['duration','ease','parent','immediateRender','overwrite','delay','repeat','repeatDelay','yoyo','runBackwards','lazy','stagger','data'].includes(key)&&(typeof value==='number'||typeof value==='string')));}
 layers.push({key,kind:'animation',category:'animation',label,tween:index,start:child.startTime(),duration:child.duration(),ease:typeof child.vars.ease==='string'?child.vars.ease:'none',properties:properties(child.vars),fromProperties:properties(child.vars.startAt)});
});
for(const layer of layers.filter(layer=>layer.kind==='element')){const change=overrides[layer.key]||{};if(change.hidden||(!Number.isFinite(change.start)&&!Number.isFinite(change.duration)))continue;const node=root.querySelector(layer.selector);if(node&&timeline){timeline.set(node,{visibility:'hidden'},0);timeline.set(node,{visibility:'visible'},layer.start);timeline.set(node,{visibility:'hidden'},layer.start+layer.duration);}}
timeline?.invalidate();
${SCENE_VISIBILITY_SCRIPT}
measureSceneLayers();
let outlined=null,outline='',outlinePriority='';
window.addEventListener('message',event=>{
 if(event.source!==window.parent||event.data?.type!=='clippster-select-layer')return;
 if(outlined){if(outline)outlined.style.setProperty('outline',outline,outlinePriority);else outlined.style.removeProperty('outline');outlined=null;}
 if(event.data.owner!==variables.__editorOwner)return;
 const layer=layers.find(layer=>layer.key===event.data.key&&layer.kind==='element');
 const node=layer&&root.querySelector(layer.selector);
 if(node){outlined=node;outline=node.style.getPropertyValue('outline');outlinePriority=node.style.getPropertyPriority('outline');node.style.setProperty('outline','3px solid #22d3ee','important');}
});
window.addEventListener('click',event=>{
 if(getComputedStyle(root).visibility==='hidden'||getComputedStyle(root).display==='none')return;
 const elements=layers.filter(layer=>layer.kind==='element'&&!overrides[layer.key]?.deleted).map(layer=>({layer,node:root.querySelector(layer.selector)}));
 const candidates=elements.filter(item=>item.node?.contains(event.target));
 const fallback=elements.filter(({node})=>{if(!node)return false;const rect=node.getBoundingClientRect(),style=getComputedStyle(node);return style.visibility==='visible'&&Number(style.opacity)>.001&&event.clientX>=rect.left&&event.clientX<=rect.right&&event.clientY>=rect.top&&event.clientY<=rect.bottom;}).sort((a,b)=>{const ar=a.node.getBoundingClientRect(),br=b.node.getBoundingClientRect();return ar.width*ar.height-br.width*br.height;});
 const item=candidates.sort((a,b)=>b.layer.selector.length-a.layer.selector.length)[0]||fallback[0];
 if(item)window.parent.postMessage({type:'clippster-layer-selected',owner:variables.__editorOwner,key:item.layer.key},'*');
});
if(variables.__editorOwner)window.parent.postMessage({type:'clippster-scene-layers',owner:variables.__editorOwner,layers},'*');
})();</script>`;
}
