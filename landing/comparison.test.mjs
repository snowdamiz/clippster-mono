import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import vm from 'node:vm'
const read=(path)=>readFileSync(new URL(path,import.meta.url),'utf8')
const context=vm.createContext({})
vm.runInContext(read('./src/seo/productComparison.ts').replaceAll('export const ','var '),context)
const rows=context.productComparison.flatMap(group=>group.features)
test('comparison covers each public desktop source with an enabled implementation',()=>{
 const config=read('../client/src/config/platforms.ts')
 for(const [name,id] of [['YouTube','YouTube'],['Twitch','twitch'],['Kick','kick'],['Pump.fun','pumpfun'],['Rumble','rumble'],['X','twitter']]){
  assert.ok(rows.find(row=>row.name===name),name)
  assert.match(config,new RegExp(id+': \\{[\\s\\S]*?isComingSoon: false'),name)
 }
})
test('comparison has three populated products and no invented winner labels',()=>{
 for(const row of rows){for(const product of ['clippster','opus','capcut'])assert.ok(row[product]?.trim(),row.name);assert.equal(row.winner,undefined)}
 assert.ok(context.comparisonSources.every(source=>source.url.startsWith('https://')))
})
test('medium pack and starting plan agree with server billing definitions',()=>{
 assert.match(read('../server/lib/clippster_server/credits.ex'),/"medium" => %\{hours: 600, usd: 20.00/)
 assert.match(read('./src/pages/PricingPage.tsx'),/name: 'Medium Pack', credits: 600, price: 20,/)
 assert.match(read('../server/lib/clippster_server/subscriptions.ex'),/"basic" => %\{monthly_credits: 0, usd: 12\.99/)
 assert.ok(rows.find(row=>row.name==='Paid personal plans').clippster.includes('$12.99'))
})

test('source comparison distinguishes live watching and channel downloads',()=>{
 for(const name of ['YouTube','Twitch','Kick','Pump.fun','Rumble','X']){
  const copy=rows.find(row=>row.name===name).clippster
  assert.match(copy,/VOD/)
  assert.match(copy,/watch live on desktop/)
 }
 for(const name of ['YouTube','Rumble'])assert.match(rows.find(row=>row.name===name).clippster,/channel downloads/)
 assert.doesNotMatch(rows.find(row=>row.name==='X').clippster,/Spaces/i)
})

test('comparison gives video editing, image editing and posting dedicated coverage',()=>{
 for(const category of ['Video editor','Image editor · Design Studio','Social posting and scheduling']){
  const group=context.productComparison.find(group=>group.category===category)
  assert.ok(group,category)
  assert.ok(group.features.length>=5,category)
  for(const row of group.features){
   const evidence=context.comparisonCodeEvidence[row.name]
   assert.ok(evidence?.length,row.name)
   for(const path of evidence)assert.ok(read('../'+path).length,path)
  }
 }
})
