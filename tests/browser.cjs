/* Microsoft and Excel are simulated. No real account, token or workbook is touched. */
const {chromium}=require('playwright');const fs=require('node:fs');const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true});const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,deviceScaleFactor:1,serviceWorkers:'allow'});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const columns=['Date','Time','Merchant','Amount','Card','Latitude','Longitude','Obs','Categoria'].map((name,index)=>({name,index}));
 let rows=[['06/10/2026','10h00','Mercado',1360,'4141','','','','']],budgets=[['2026-10',5000,'2026-10-06T10:00:00Z']];
 const fakeMsal='window.msal={PublicClientApplication:class {initialize(){return Promise.resolve();}handleRedirectPromise(){return Promise.resolve(null);}getAllAccounts(){return [{homeAccountId:"test-only"}];}acquireTokenSilent(){return Promise.resolve({accessToken:"simulation-only"});}logoutRedirect(){return Promise.resolve();}}};';
 await context.addInitScript(()=>localStorage.setItem('saldo-livre-connection',JSON.stringify({"clientId": "00000000-0000-0000-0000-000000000000", "tenantId": "11111111-1111-1111-1111-111111111111", "driveId": "drive", "fileId": "file"})));
 const html=fs.readFileSync('index.html','utf8').replace(/<script>\s*[^<]*?"use strict";!function[\s\S]*?<\/script>/,`<script>${fakeMsal}</script>`);
 assert(!html.includes('class PublicClientApplication'));assert(html.includes('simulation-only'));
 await page.route('http://127.0.0.1:8765/',route=>route.fulfill({contentType:'text/html',body:html}));
 await page.route('https://graph.microsoft.com/**',async route=>{
  const req=route.request(),url=new URL(req.url()),p=decodeURIComponent(url.pathname),method=req.method(),body=req.postData()?JSON.parse(req.postData()):null;let data;
  if(p.endsWith('/Gastos/columns'))data={value:columns};
  else if(p.endsWith('/Gastos/rows')&&method==='GET')data={value:rows.map((r,index)=>({index,values:[r]}))};
  else if(p.endsWith('/Orcamentos/rows')&&method==='GET')data={value:budgets.map((r,index)=>({index,values:[r]}))};
  else if(p.endsWith('/Orcamentos')&&method==='GET')data={id:'budget',name:'Orcamentos'};
  else if(p.endsWith('/Gastos/rows/add')){rows.push(...body.values);data={index:rows.length-1,values:body.values};}
  else if(p.endsWith('/Orcamentos/rows/add')){budgets.push(...body.values);data={values:body.values};}
  else if(/\/Orcamentos\/rows\/itemAt/.test(p)){const index=+p.match(/index=(\d+)/)[1];if(method==='PATCH')budgets[index]=body.values[0];else if(method==='DELETE')budgets.splice(index,1);data={};}
  else if(/\/Gastos\/rows\/itemAt/.test(p)){const index=+p.match(/index=(\d+)/)[1];if(method==='PATCH')rows[index]=body.values[0];else if(method==='DELETE')rows.splice(index,1);data={};}
  else throw new Error('Unexpected mock '+method+' '+p);
  await route.fulfill({contentType:'application/json',body:JSON.stringify(data)});
 });
 await page.goto('http://127.0.0.1:8765/');await page.waitForFunction(()=>window.dataLoaded===true);
 await page.evaluate(()=>{selAno=2026;selMes=10;renderMonth();});assert.equal(await page.locator('#hTotal').textContent(),'3.640,00');assert.equal(await page.locator('.prog-track').count(),0);
 await page.getByText('+ Novo gasto',{exact:true}).click();await page.locator('#manualAmount').fill('80,50');await page.locator('#manualMerchant').fill('<img src=x onerror=alert(1)>');await page.locator('#manualDate').fill('2026-10-06');await page.locator('#saveManualBtn').click();await page.waitForFunction(()=>document.getElementById('hTotal').textContent==='3.559,50');assert.equal(await page.locator('.txmerch img').count(),0);assert(rows[1][2].includes('<img'));
 await page.getByText('Ajustar orçamento',{exact:true}).click();await page.locator('#budgetInput').fill('6.000,00');await page.locator('#saveBudgetBtn').click();await page.waitForFunction(()=>document.getElementById('hTotal').textContent==='4.559,50');
 await page.locator('[data-tx]').filter({hasText:'Mercado'}).click();await page.locator('#parcelaBtn').click();await page.locator('#mInput').fill('3');await page.locator('#mBtnOk').click();await page.waitForFunction(()=>window.allRows.length===4);assert.equal(rows.filter(r=>String(r[7]).includes('[SL:')).length,3);assert.equal(rows.filter(r=>String(r[7]).includes('[SL:')).reduce((s,r)=>s+Math.round(r[3]*100),0),136000);
 await page.evaluate(async()=>{await saveSnapshot();});
 await page.screenshot({path:'/tmp/saldo-livre-mobile.png',fullPage:true});
 await context.setOffline(true);await page.evaluate(()=>showOffline());assert.equal(await page.evaluate(()=>readOnlyOffline),true);assert.match(await page.locator('#lastUpdate').textContent(),/Cópia salva/);await page.getByText('+ Novo gasto',{exact:true}).click();await page.locator('#manualAmount').fill('1');await page.locator('#manualMerchant').fill('offline');await page.locator('#saveManualBtn').click();assert.match(await page.locator('#manualStatus').textContent(),/internet/);assert.equal(rows.length,4);
 await page.locator('#manualModal .mbtn-cancel').click();
 await context.setOffline(false);await page.evaluate(()=>loadWorkbook());await page.waitForFunction(()=>!readOnlyOffline);
 await page.evaluate(()=>{allRows.push({date:'06/10',amount:20,merchant:'Sem ano'});renderMonth();});assert.equal(await page.locator('#hTotal').textContent(),'—');assert.match(await page.locator('#qualityNote').textContent(),/sem ano/);
 assert.deepEqual(errors,[]);await browser.close();console.log('PASS: mobile dashboard, manual/XSS-safe input, shared budget, exact installments, read-only offline and incomplete-date guard.');
})().catch(e=>{console.error(e);process.exit(1);});
