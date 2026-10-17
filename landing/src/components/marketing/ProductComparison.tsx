import {Fragment} from 'react'
import {productComparison, comparisonSources} from '@/seo/productComparison'
export function ProductComparison() {
 return <section className="product-comparison" aria-labelledby="comparison-heading">
 <header><p className="comparison-eyebrow">COMPARE WORKFLOWS</p><h2 id="comparison-heading">Clippster, Opus Clip &amp; CapCut</h2><p>From live capture to video editing, image design and scheduled posts.</p></header>
 <table><colgroup><col style={{width:'28%'}}/><col style={{width:'24%'}}/><col style={{width:'24%'}}/><col style={{width:'24%'}}/></colgroup>
 <thead><tr><th scope="col">Feature</th><th scope="col">Clippster</th><th scope="col">Opus Clip</th><th scope="col">CapCut</th></tr></thead>
 <tbody>{productComparison.map(group=><Fragment key={group.category}><tr className="comparison-category"><th colSpan={4} scope="colgroup">{group.category}</th></tr>{group.features.map(row=><tr key={row.name}><th scope="row">{row.name}</th><td>{row.clippster}</td><td>{row.opus}</td><td>{row.capcut}</td></tr>)}</Fragment>)}</tbody></table>
 <div className="comparison-notes"><p>Reviewed October 15, 2026. Clippster entries were checked against implemented desktop features and server plan configuration; external services were checked against their official documentation. Feature access depends on plan. External posting and analytics depend on connected accounts and platform support. Credits are not equivalent across products.</p><p>¹ “Not documented” means not established by the linked sources, not proof a feature is unavailable. File import is different from direct platform URL import. Source availability, account access and plan restrictions apply.</p><p>Sources: {comparisonSources.map((s,i)=><Fragment key={s.url}>{i>0?' · ':''}<a href={s.url} target="_blank" rel="noreferrer">{s.label}</a></Fragment>)}</p></div>
 </section>
}
