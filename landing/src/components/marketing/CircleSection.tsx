import {useState} from 'react'
type Scene={label:string;eyebrow:string;description:string;lines:string[];visual:'news'|'crypto'|'stocks'|'sports'}
export function CircleSection({id,eyebrow,title,accent,intro,fact,factLabel,scenes,footer}:{id:string;eyebrow:string;title:string;accent:string;intro:string;fact:string;factLabel:string;scenes:Scene[];footer:string}){
 const [selected,setSelected]=useState(0),[mode,setMode]=useState(0);const s=scenes[selected]
 return <section className="circle-section" aria-labelledby={id+'-title'}>
 <header className="circle-heading"><span className="chapter">{eyebrow}</span><h2 id={id+'-title'}>{title}<br/><em>{accent}</em></h2><p>{intro}</p></header>
 <div className="circle-stage"><div className="circle-facts"><strong>{fact}</strong><span className="circle-label">{factLabel}</span><p>{mode===0?'AI creates clips while the stream is live, informed by what’s happening now.':'The same current-event context helps AI recognize timely moments in recorded videos.'}</p><div className="circle-modes">{['Live clipping','VOD detection'].map((label,i)=><button key={label} aria-pressed={mode===i} onClick={()=>setMode(i)}>{label}</button>)}</div></div>
 <div className="circle-display"><svg viewBox="0 0 500 500" role="img" aria-label={s.label+': '+s.description}>
 <circle cx="250" cy="250" r="222" fill="#101a20"/><circle cx="250" cy="250" r="222" fill="none" stroke="#29404b"/>
 <circle className="circle-orbit" cx="250" cy="250" r="222" fill="none" stroke="#2ac4d9" strokeDasharray="90 1305"/>
 <text className="circle-kicker" x="250" y="104" textAnchor="middle">{s.eyebrow}</text><text className="circle-title" x="250" y="148" textAnchor="middle">{s.label}</text>
 {s.visual==='news'&&['STORY BREAKS','CONTEXT UPDATES','CONVERSATION CONNECTS'].map((label,i)=><g key={label} className="circle-news-step" style={{animationDelay:i*1.5+'s'}}><circle cx="125" cy={199+i*48} r="5" fill="none" stroke="#4ab6c7"/>{i<2&&<path d={'M125 '+(207+i*48)+' v32'} stroke="#365461"/>}<text x="148" y={203+i*48}>{label}</text></g>)}
 {s.visual==='crypto'&&<g stroke="#4796a7" fill="none">{[0,1,2,3,4,5].map(i=>{const a=i*Math.PI/3,x=250+90*Math.cos(a),y=245+60*Math.sin(a);return <g key={i}><path d={'M250 245 L'+x+' '+y}/><circle cx={x} cy={y} r="7"/></g>})}<text x="250" y="253" textAnchor="middle" fill="#b9dce4" stroke="none" fontSize="26">₿</text></g>}
 {s.visual==='stocks'&&<g><path d="M115 285 L135 270 150 279 173 249 192 263 211 238 235 249 254 219 278 230 299 203 320 215 345 183 380 196" fill="none" stroke="#45b4c6" strokeWidth="2"/><text x="250" y="320" textAnchor="middle" className="circle-kicker">ILLUSTRATIVE MARKET MOVEMENT</text></g>}
 {s.visual==='sports'&&<g stroke="#4c7180" fill="none"><path d="M130 190H370V310H130Z M250 190V310"/><circle cx="250" cy="250" r="28"/>{[0,1,2,3,4,5].map(i=><circle key={i} cx={150+i*39} cy={230+Math.sin(i*2)*30} r="3" fill="#40b5c6"/>)}<circle className="circle-ball" cx="250" cy="250" r="4" fill="#d2e6ed"/></g>}
 {s.lines.map((line,i)=><text className="circle-caption" key={line} x="250" y={370+i*21} textAnchor="middle">{line}</text>)}
 </svg><span className="circle-hint">SELECT A TOPIC · HOVER TO PAUSE</span></div>
 <div className="circle-options"><span className="circle-label">FOLLOW THE CONTEXT</span>{scenes.map((scene,i)=><button key={scene.label} aria-pressed={selected===i} onClick={()=>setSelected(i)}>{scene.label}</button>)}<p aria-live="polite">{s.description}</p></div></div><p className="circle-footnote">{footer}</p>
 </section>
}
