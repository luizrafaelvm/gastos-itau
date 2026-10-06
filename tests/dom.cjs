const {JSDOM,ResourceLoader,VirtualConsole}=require('jsdom');const {indexedDB}=require('fake-indexeddb');const fs=require('node:fs');const path=require('node:path');const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
class LocalResources extends ResourceLoader {fetch(url){const file=path.join(root,new URL(url).pathname);return fs.existsSync(file)?Promise.resolve(fs.readFileSync(file)):null;}}
const fakeMsal='window.msal={PublicClientApplication:class {initialize(){return Promise.resolve();}handleRedirectPromise(){return Promise.resolve(null);}getAllAccounts(){return [{homeAccountId:"test-only"}];}acquireTokenSilent(){return Promise.resolve({accessToken:"simulation-only"});}logoutRedirect(){return Promise.resolve();}}};';
let rows=[['06/10/2026','10h00','Mercado',1360,'4141','','','','']],budgets=[['2026-10',5000,'2026-10-06T10:00:00Z']];
const columns=['Date','Time','Merchant','Amount','Card','Latitude','Longitude','Obs','Categoria'].map((name,index)=>({name,index}));let online=true,loseBatchResponse=false;
const html=fs.readFileSync(path.join(root,'index.html'),'utf8').replace(/<script>\s*[^<]*?"use strict";!function[\s\S]*?<\/script>/,`<script>${fakeMsal}</script>`);
const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
const dom=new JSDOM(html,{url:'http://localhost/',runScripts:'dangerously',resources:new LocalResources(),virtualConsole:vc,beforeParse(w){w.localStorage.setItem('saldo-livre-connection',JSON.stringify({"clientId": "00000000-0000-0000-0000-000000000000", "tenantId": "11111111-1111-1111-1111-111111111111", "driveId": "drive", "fileId": "file"}));w.indexedDB=indexedDB;w.structuredClone=structuredClone;w.scrollTo=()=>{};w.confirm=()=>true;Object.defineProperty(w.navigator,'onLine',{get:()=>online});Object.defineProperty(w.crypto,'randomUUID',{value:()=>require('node:crypto').randomUUID()});w.fetch=async(url,options={})=>{
 if(!online)throw new Error('offline');const p=decodeURIComponent(new URL(url).pathname),method=options.method||'GET',body=options.body?JSON.parse(options.body):null;let data;
 if(p.endsWith('/Gastos/columns'))data={value:columns};
 else if(p.endsWith('/Gastos/rows')&&method==='GET')data={value:rows.map((r,index)=>({index,values:[r]}))};
 else if(p.endsWith('/Orcamentos/rows')&&method==='GET')data={value:budgets.map((r,index)=>({index,values:[r]}))};
 else if(p.endsWith('/Orcamentos')&&method==='GET')data={id:'budget',name:'Orcamentos'};
 else if(p.endsWith('/Gastos/rows/add')){rows.push(...body.values);data={values:body.values};if(loseBatchResponse){loseBatchResponse=false;throw new Error('response lost after write');}}
 else if(p.endsWith('/Orcamentos/rows/add')){budgets.push(...body.values);data={values:body.values};}
 else if(/\/Orcamentos\/rows\/itemAt/.test(p)){const index=+p.match(/index=(\d+)/)[1];if(method==='PATCH')budgets[index]=body.values[0];else if(method==='DELETE')budgets.splice(index,1);data={};}
 else if(/\/Gastos\/rows\/itemAt/.test(p)){const index=+p.match(/index=(\d+)/)[1];if(method==='PATCH')rows[index]=body.values[0];else if(method==='DELETE')rows.splice(index,1);data={};}
 else throw new Error('Unexpected mock '+method+' '+p);
 return new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json'}});
 };}});
const w=dom.window,d=w.document;
async function wait(predicate){for(let i=0;i<300;i++){if(predicate())return;await new Promise(r=>setTimeout(r,10));}throw new Error('Timed out waiting for UI: '+d.getElementById('errBanner').textContent);}
const set=(id,value)=>d.getElementById(id).value=value;
(async()=>{
 await wait(()=>w.dataLoaded);w.selMes=10;w.selAno=2026;w.renderMonth();assert.equal(d.getElementById('hTotal').textContent,'3.640,00');assert.equal(d.querySelector('.prog-track'),null);
 w.openManual();set('manualAmount','80,50');set('manualMerchant','<img src=x onerror=alert(1)>');set('manualDate','2026-10-06');await w.saveManual();assert.equal(rows.length,2);assert.equal(d.getElementById('hTotal').textContent,'3.559,50');assert.equal(d.querySelector('.txmerch img'),null);
 w.openBudget();set('budgetInput','6.000,00');await w.saveBudget();assert.equal(d.getElementById('hTotal').textContent,'4.559,50');
 w.openDetail(w.currentSummary.rows.find(r=>r.merchant==='Mercado'));w.abrirModal();set('mInput','3');loseBatchResponse=true;await w.saveInstallments();assert(w.pendingInstallment());assert.equal(rows.length,4);await w.resumeInstallment();assert.equal(w.pendingInstallment(),null);assert.equal(rows.length,4);assert.equal(rows.filter(r=>String(r[7]).includes('[SL:')).reduce((s,r)=>s+Math.round(r[3]*100),0),136000);
 online=false;await w.showOffline();assert(w.readOnlyOffline);w.openManual();set('manualAmount','1');set('manualMerchant','offline');await w.saveManual();assert.match(d.getElementById('manualStatus').textContent,/internet/);assert.equal(rows.length,4);
 online=true;await w.loadWorkbook();assert.equal(w.readOnlyOffline,false);w.allRows.push({date:'06/10',amount:20,merchant:'Sem ano'});w.renderMonth();assert.equal(d.getElementById('hTotal').textContent,'—');assert.match(d.getElementById('qualityNote').textContent,/sem ano/);
 assert.deepEqual(errors,[]);dom.window.close();console.log('PASS: DOM integration: shared budget, manual expense, escaped HTML, exact installments, lost-response recovery without duplication, IndexedDB offline and unknown-date guard.');
})().catch(e=>{console.error(e);dom.window.close();process.exit(1);});
