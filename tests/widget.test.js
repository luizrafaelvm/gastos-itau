const {test}=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm');const fs=require('node:fs');const F=require('../finance-core.js');
const source=fs.readFileSync(require('node:path').join(__dirname,'../widget/Saldo-Livre.js'),'utf8');
async function run({amount=1360,fail=false,cache=null,refresh=false}={}){
 const key=F.monthKey(F.parts()),date=key+'-06',storage={},secrets={},texts=[],requests=[];let complete=false;
 const tokenKey='saldo-livre-oauth-00000000-0000-0000-0000-000000000000';secrets['saldo-livre-widget-connection']=JSON.stringify({clientId:'00000000-0000-0000-0000-000000000000',tenantId:'11111111-1111-1111-1111-111111111111',driveId:'drive',fileId:'file'});secrets[tokenKey]=JSON.stringify({access_token:'mock-access',refresh_token:'mock-refresh',expires:Date.now()+(refresh?-1000:3600000)});
 if(cache)storage['/docs/saldo-livre-summary.json']=JSON.stringify(cache);
 const context={console,Intl,Date,Set,JSON,Math,Number,String,Array,Object,Promise,encodeURIComponent,
 config:{runsInWidget:true,runsInAccessoryWidget:false,widgetFamily:'medium'},
 FileManager:{local:()=>({documentsDirectory:()=>'/docs',joinPath:(a,b)=>a+'/'+b,writeString:(p,s)=>storage[p]=s,readString:p=>storage[p],fileExists:p=>p in storage})},
 Keychain:{contains:k=>k in secrets,get:k=>secrets[k],set:(k,v)=>secrets[k]=v},
 Request:class {constructor(url){this.url=url;}async loadString(){requests.push({url:this.url,headers:this.headers,body:this.body});if(fail)throw new Error('offline');this.response={statusCode:200};if(this.url.includes('/token'))return JSON.stringify({access_token:'renewed',refresh_token:'rotated',expires_in:3600});if(this.url.endsWith('/columns'))return JSON.stringify({value:['Date','Time','Merchant','Amount','Card','Obs'].map(name=>({name}))});if(this.url.includes('/Orcamentos/'))return JSON.stringify({value:[{values:[[key,5000]]}]});return JSON.stringify({value:[{index:0,values:[[date,'10h00','Mercado',amount,'4141','']]}]});}},
 ListWidget:class {setPadding(){}addSpacer(){}addText(text){texts.push(text);return {};}},
 Color:class {static white(){return {}; }},Font:{boldSystemFont:()=>({}),mediumSystemFont:()=>({}),semiboldSystemFont:()=>({}),systemFont:()=>({})},
 Script:{setWidget:w=>context.widget=w,complete:()=>complete=true}
 };
 await new vm.Script('(async()=>{'+source+'})()').runInNewContext(context);assert(complete);return {texts,requests,storage,secrets};
}
test('widget uses real shared calculations and caches summary only',async()=>{const r=await run();assert(r.texts.includes('R$ 3.640'));assert(r.texts.includes('disponível'));const cached=Object.values(r.storage).join('');assert(!cached.includes('Mercado'));assert(!cached.includes('4141'));assert(!cached.includes('mock-access'));assert.equal(r.requests.length,3);});
test('widget negative balance remains visible with zero/day',async()=>{const r=await run({amount:5327});assert(r.texts.includes('R$ -327'));assert(r.texts.includes('excedido'));assert(r.texts.includes('R$ 0/dia'));});
test('widget renews login using Keychain and rotates refresh token',async()=>{const r=await run({refresh:true});assert(r.requests[0].body.includes('grant_type=refresh_token'));assert(r.requests[1].headers.Authorization==='Bearer renewed');assert(Object.values(r.secrets).some(x=>x.includes('rotated')));});
test('offline widget shows cached balance explicitly as stale',async()=>{const r=await run({fail:true,cache:{key:F.monthKey(F.parts()),complete:true,availableCents:100000,dailyCents:12345,updatedAt:new Date().toISOString()}});assert(r.texts.includes('R$ 1.000'));assert(r.texts.some(t=>t.startsWith('desatualizado')));assert(r.texts.includes('R$ 123/dia'));});
test('widget never presents last-month cache as current saldo',async()=>{const r=await run({fail:true,cache:{key:'2020-01',complete:true,availableCents:500000,dailyCents:10000,updatedAt:new Date().toISOString()}});assert(!r.texts.includes('R$ 5.000'));assert(r.texts.includes('atualizar mês'));});
