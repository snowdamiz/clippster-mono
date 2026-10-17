import {useEffect,useRef,useState} from 'react'
import {workflowArt} from './workflowArt'
import {DownloadLink} from './DownloadLink'
const steps=['Bring in videos, VODs, and live sources','Find and review your clips','Make the edit your own','Build, export, and publish']
const details=['Local files, downloaded VODs, or live recordings. Your source footage stays at the start of the workflow.','Let AI create clips automatically while a stream is live, or create clips from recorded footage. Review the clips or choose a range manually.','Edit the source directly or refine a clip. Trim, frame, add sound and captions; create covers in Image Studio.','Build a clip or export your edit. Keep the file, publish now, or schedule to connected social accounts.']
export function WorkflowHero(){
 const [step,setStep]=useState(0),[paused,setPaused]=useState(false),[reduced,setReduced]=useState(()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches)
 const svg=useRef<SVGSVGElement>(null)
 useEffect(()=>{const media=window.matchMedia('(prefers-reduced-motion: reduce)');const change=()=>setReduced(media.matches);media.addEventListener('change',change);return()=>media.removeEventListener('change',change)},[])
 useEffect(()=>{if(paused||reduced)return;const timer=window.setInterval(()=>{if(!document.hidden)setStep(s=>(s+1)%4)},5000);return()=>window.clearInterval(timer)},[paused,reduced])
 useEffect(()=>{svg.current?.querySelectorAll<SVGGElement>('[data-step]').forEach(el=>{const active=Number(el.dataset.step)===step;el.classList.toggle('active',active);el.setAttribute('aria-pressed',String(active))})},[step])
 const select=(n:number)=>{setStep(n);setPaused(true)}
 const activate=(target:EventTarget)=>{const node=(target as Element).closest('[data-step]');if(node)select(Number(node.getAttribute('data-step')))}
 return <section className={'workflow-hero'+(paused?' paused':'')+(reduced?' reduced':'')} aria-label="Clippster workflow"><div className="copy"><p className="eyebrow">ONE CREATIVE WORKFLOW</p><h1>One moment.<br/>A <em>connected</em> workflow.</h1><div className="steps">{steps.map((label,i)=><button key={label} className={step===i?'active':''} aria-pressed={step===i} onClick={()=>select(i)}>{label}</button>)}</div><p id="detail">{details[step]}</p><DownloadLink className="cta" source="home_hero"/></div><svg ref={svg} id="map" viewBox="0 0 1260 760" role="group" aria-label="Clippster connected creative workflow" onClick={e=>activate(e.target)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();activate(e.target)}}} dangerouslySetInnerHTML={{__html:workflowArt}} /></section>
}