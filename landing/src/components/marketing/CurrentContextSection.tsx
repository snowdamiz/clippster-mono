import {CircleSection} from './CircleSection'
export function CurrentContextSection(){return <CircleSection id="ai-context" eyebrow="02 / CONTEXT THAT STAYS CURRENT" title="AI that knows" accent="what’s happening." intro="News, markets and sports. Refreshed every 15 minutes. Context that helps turn timely conversations into clips." fact="15 minutes" factLabel="BETWEEN CONTEXT UPDATES" footer="Current events → Conversation context → Clips · Illustrative topic visuals" scenes={[
{label:'Breaking news',eyebrow:'DEVELOPING STORIES',description:'Major developments give the AI context for conversations as stories unfold.',visual:'news',lines:['A story breaks. The conversation shifts.','AI has the context.']},
{label:'Crypto',eyebrow:'DIGITAL ASSET DEVELOPMENTS',description:'Digital-asset developments give timely context to crypto conversations.',visual:'crypto',lines:['Market moves. Protocol updates.','Industry developments.']},
{label:'Stocks',eyebrow:'MARKETS & COMPANY NEWS',description:'Market moves and company news help AI recognize relevant financial discussions.',visual:'stocks',lines:['The context behind a reaction.']},
{label:'Sports',eyebrow:'RESULTS & MAJOR MOMENTS',description:'Results and major sporting moments give context to live reactions.',visual:'sports',lines:['The result. The reaction.','AI understands the moment.']}
]}/> }
