import { useEffect, useRef, useState, type CSSProperties } from 'react'
const steps = [
 {title:'Connect',text:'Watch livestreams, download VODs from YouTube, Kick, Twitch, Rumble, X or Pump.fun, or import local files. No account linking is required for the source workflow.',label:'YOUR SOURCE'},
 {title:'Analyze',text:'Let AI create clips while a stream is live or from a recorded video. You can also create clips manually, then review and edit the results.',label:'FIND YOUR MOMENT'},
 {title:'Edit',text:'Auto-crop to vertical, style captions, and apply effects with presets. Refine the timeline and adapt the aspect ratio for your destination.',label:'MAKE IT YOURS'},
 {title:'Export',text:'Build or export the clip. Publish now or schedule to Instagram, TikTok, X or YouTube with formats suited to short-form networks.',label:'READY TO SHARE'},
]
export function HowItWorksSection() {
  const [active, setActive] = useState(0)
  const root = useRef<HTMLElement>(null)
  const [progress, setProgress] = useState(0)
  useEffect(() => {
    const query = matchMedia('(min-width: 1000px) and (min-height: 650px) and (prefers-reduced-motion: no-preference)')
    let frame = 0
    const update = () => {
      frame = 0
      if (!query.matches || !root.current) return
      const rect = root.current.getBoundingClientRect()
      const distance = root.current.offsetHeight - (innerHeight - 100)
      const value = Math.max(0, Math.min(1, (100 - rect.top) / distance))
      setProgress(value)
      setActive(Math.min(3, Math.floor(value * 4)))
    }
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update) }
    addEventListener('scroll', schedule, {passive:true})
    addEventListener('resize', schedule)
    query.addEventListener('change', schedule)
    update()
    return () => {removeEventListener('scroll',schedule);removeEventListener('resize',schedule);query.removeEventListener('change',schedule);cancelAnimationFrame(frame)}
  }, [])
  const select = (index:number) => {
    setActive(index)
    if (root.current && matchMedia('(min-width: 1000px) and (min-height: 650px) and (prefers-reduced-motion: no-preference)').matches) {
      const top = root.current.getBoundingClientRect().top + scrollY - 100
      const distance = root.current.offsetHeight - (innerHeight - 100)
      window.scrollTo({top:top + distance * ((index + .35) / 4),behavior:'smooth'})
    }
  }
  return <section ref={root} id="how-it-works" className="page-section context-flow" style={{'--flow-progress':progress} as CSSProperties} aria-labelledby="context-flow-title">
    <div className="context-flow-sticky"><div className="context-flow-copy"><span className="chapter">HOW IT WORKS</span><h2 id="context-flow-title">Four steps.<br/><em>From source to share.</em></h2>
      <div className="context-flow-steps">{steps.map((step, i) => <button key={step.title} aria-pressed={active === i} onClick={() => select(i)}><span className="context-flow-number">0{i + 1}</span><span><strong>{step.title}</strong><span className="context-flow-description">{step.text}</span></span></button>)}</div>
    </div>
    <div className="context-flow-art" aria-label="Connect your source, create clips, edit and export">
      {steps.map((step, i) => <button key={step.label} style={{'--layer':i,'--distance':i-active} as CSSProperties} className={'context-flow-plane plane-' + i} aria-label={step.title} aria-pressed={active === i} onClick={() => select(i)}>
        <span className="context-flow-plane-label">0{i + 1} / {step.title.toUpperCase()}</span>
        <StepVisual step={i} />
      </button>)}
    </div></div>
  </section>
}

function StepVisual({step}:{step:number}) {
 return <svg className="step-visual" viewBox="0 0 240 112" aria-hidden="true">
 {step===0 && <>
   {['YouTube','Twitch','Kick','Rumble','X','Pump.fun'].map((name,i)=><g key={name} transform={'translate('+(i%3)*82+','+Math.floor(i/3)*29+')'}><circle cx="5" cy="12" r="3" fill="#46c5d7"/><text x="14" y="16">{name}</text></g>)}
   <path d="M6 67H234" stroke="#3b5966"/><path d="M9 81v19m-6-6 6 6 6-6" stroke="#55cfdb" fill="none"/><text x="27" y="87">Download a VOD</text><text x="27" y="105">or import a local video</text>
 </>}
 {step===1 && <>
   <text x="0" y="13">FULL STREAM / RECORDING</text><path d="M0 35H235" stroke="#42616e" strokeWidth="16"/>
   {[22,96,176].map((x,i)=><g key={x}><path d={'M'+x+' 35h35'} stroke="#40bfd1" strokeWidth="16"/><path d={'M'+(x+17)+' 46v14'} stroke="#74cbd6"/><rect x={x-5} y="63" width="51" height="27" rx="2" fill="#253941"/><text x={x+20} y="81" textAnchor="middle">CLIP {i+1}</text></g>)}
   <text x="0" y="109">AI creates clips · You can clip manually</text>
 </>}
 {step===2 && <>
   <rect x="0" y="0" width="78" height="61" fill="#23353e"/><path d="M22 6h34v49H22z" stroke="#54c5d6" fill="none"/><text x="39" y="25" textAnchor="middle">9:16</text><path d="M27 43h24" stroke="#d3e6ec" strokeWidth="3"/>
   <text x="91" y="16">Reframe</text><text x="91" y="35">Style captions</text><text x="91" y="54">Apply effects</text>
   <path d="M0 76h230" stroke="#3b535f" strokeWidth="12"/><path d="M30 94h160" stroke="#497783" strokeWidth="9"/><path d="M96 66v41" stroke="#a6e4eb"/>
 </>}
 {step===3 && <>
   <path d="M6 4h25l10 10v44H6z M31 4v10h10" fill="none" stroke="#75becd"/><text x="23" y="39" textAnchor="middle">MP4</text><path d="M49 30h22m-5-5 5 5-5 5" stroke="#4cc3d5" fill="none"/>
   <text x="84" y="15">Save to your device</text><text x="84" y="37">Publish now</text><text x="84" y="59">Schedule for later</text>
   <path d="M0 73H235" stroke="#3b5966"/><text x="0" y="94">Instagram · TikTok · YouTube · X</text>
 </>}
 </svg>
}
