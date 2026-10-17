import {test} from 'node:test'
import assert from 'node:assert/strict'
import {buildRecordsCsv} from './src/utils/downloadRecordsCsv.ts'
test('exports nested details, optional fields and users without email',()=>{
 const csv=buildRecordsCsv([{id:1,email:null,is_admin:false,credits:{hours_remaining:0},subscription:{tier:'creator'}},{id:2,email:'a@example.com',invited_at:'2026-10-16',beta_code:'BETA'}])
 assert.equal(csv,'\uFEFFid,email,is_admin,credits.hours_remaining,subscription.tier,invited_at,beta_code\r\n1,,false,0,creator,,\r\n2,a@example.com,,,,2026-10-16,BETA\r\n')
})
test('quotes commas, quotes and multiline fields without dropping data',()=>{
 const csv=buildRecordsCsv([{email:'a@example.com',email_delivery_error:'Failed, "retry"\nLater'}])
 assert.ok(csv.includes('"Failed, ""retry""\nLater"'))
})
