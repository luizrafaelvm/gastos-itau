// Saldo Livre · execute no Scriptable para fazer o primeiro login.
// O bloco Finance é inserido automaticamente pelo build-widget.py.
// Tokens pessoais ficam no Keychain, nunca no GitHub ou no PWA.
/* Shared by the PWA, Scriptable and tests. Money is always integer cents. */
(function(root,factory){var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.Finance=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  function cents(value){
    if(typeof value==='number')return Number.isFinite(value)?Math.round(value*100):null;
    var s=String(value==null?'':value).trim().replace(/^R\$\s*/, '').replace(/\s/g,'');
    if(!s)return null;
    if(s.includes(',')){if(!/^-?(?:\d+|\d{1,3}(?:\.\d{3})+),\d{1,2}$/.test(s))return null;s=s.replace(/\./g,'').replace(',','.');}
    else if(!/^-?\d+(?:\.\d{1,2})?$/.test(s))return null;
    var n=Number(s);return Number.isSafeInteger(Math.round(n*100))?Math.round(n*100):null;
  }
  function pad(n){return String(n).padStart(2,'0');}
  function days(year,month){return new Date(Date.UTC(year,month,0)).getUTCDate();}
  function parts(now){
    var p=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now||new Date());
    var o={};p.forEach(function(x){if(x.type!=='literal')o[x.type]=Number(x.value);});return o;
  }
  function monthKey(p){return p.year+'-'+pad(p.month);}
  function date(raw,legacyYear){
    var s=String(raw==null?'':raw).trim(),m,y,d;
    if(typeof raw==='number'&&Number.isFinite(raw)&&raw>0){var e=new Date(Date.UTC(1899,11,30)+Math.floor(raw)*86400000);y=e.getUTCFullYear();m=e.getUTCMonth()+1;d=e.getUTCDate();}
    else if(/^\d{4}-\d{2}-\d{2}$/.test(s)){var a=s.split('-').map(Number);y=a[0];m=a[1];d=a[2];}
    else {var r=/^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/.exec(s);if(!r)return null;d=+r[1];m=+r[2];y=r[3]?+r[3]:Number(legacyYear);if(!y)return null;}
    if(y<1900||y>2200||m<1||m>12||d<1||d>days(y,m))return null;
    return {year:y,month:m,day:d,iso:y+'-'+pad(m)+'-'+pad(d),display:pad(d)+'/'+pad(m)+'/'+y,key:y+'-'+pad(m)};
  }
  function legacyYear(budgets){var r=budgets.find(function(b){return b.month==='__legacy_year__';});return r&&Number.isInteger(Number(r.budget))?Number(r.budget):null;}
  function budgetFor(budgets,key){
    var list=budgets.filter(function(b){return /^\d{4}-(0[1-9]|1[0-2])$/.test(b.month)&&b.month<=key&&cents(b.budget)!==null&&cents(b.budget)>=0;}).sort(function(a,b){return a.month.localeCompare(b.month);});
    var b=list[list.length-1];return b?{cents:cents(b.budget),inherited:b.month!==key,from:b.month}:null;
  }
  function summary(rows,budgets,key,now){
    var today=parts(now),year=legacyYear(budgets),unknown=0,invalid=0,duplicates=0,seen=new Set(),groups={},budgetKeys=new Set(),duplicateBudgets=0;
    budgets.forEach(function(b){if(budgetKeys.has(b.month))duplicateBudgets++;budgetKeys.add(b.month);});
    rows.forEach(function(r){var id=/\[SL:([^\]]+)\]/.exec(String(r.obs||'')),part=/ \((\d+)\/(\d+)\)$/.exec(String(r.merchant||''));if(id&&part){if(!groups[id[1]])groups[id[1]]={n:+part[2],items:[]};groups[id[1]].items.push(+part[1]);}});
    var incompleteInstallments=Object.keys(groups).filter(function(id){var g=groups[id];return g.items.length!==g.n||new Set(g.items).size!==g.n||g.items.some(function(i){return i<1||i>g.n;});}).length;
    var month=[];
    rows.forEach(function(r){
      var c=cents(r.amount),dt=date(r.date,year);
      if(c===null){invalid++;return;}
      if(!dt){if(/^\d{1,2}\/\d{1,2}$/.test(String(r.date).trim()))unknown++;else invalid++;return;}
      if(dt.key!==key)return;
      var fingerprint=[dt.iso,r.time||'',String(r.merchant||'').trim().toLowerCase(),c,r.card||''].join('|');
      if(seen.has(fingerprint))duplicates++;seen.add(fingerprint);
      month.push(Object.assign({},r,{date:dt.display,dateISO:dt.iso,cents:c}));
    });
    month.sort(function(a,b){return b.dateISO.localeCompare(a.dateISO)||String(b.time).localeCompare(String(a.time))||b.rowIndex-a.rowIndex;});
    var spent=month.reduce(function(s,r){return s+r.cents;},0),budget=budgetFor(budgets,key),available=budget?budget.cents-spent:null;
    var remaining=key===monthKey(today)?days(today.year,today.month)-today.day+1:key>monthKey(today)?days(+key.slice(0,4),+key.slice(5)):0;
    return {key:key,rows:month,budgetCents:budget?budget.cents:null,inherited:budget&&budget.inherited,spentCents:spent,availableCents:available,dailyCents:available===null||!remaining?null:Math.floor(Math.max(0,available)/remaining),daysRemaining:remaining,unknownDates:unknown,invalidRows:invalid,possibleDuplicates:duplicates,incompleteInstallments:incompleteInstallments,duplicateBudgets:duplicateBudgets,complete:!unknown&&!invalid&&!incompleteInstallments&&!duplicateBudgets,todayCents:month.filter(function(r){return r.dateISO===today.year+'-'+pad(today.month)+'-'+pad(today.day);}).reduce(function(s,r){return s+r.cents;},0)};
  }
  function installments(amount,count,dateStr,year){
    var total=cents(amount),dt=date(dateStr,year);
    if(total===null||total<=0||!Number.isInteger(count)||count<2||count>48||total<count||!dt)throw new Error('Confira valor, quantidade de parcelas e data com ano.');
    var base=Math.floor(total/count),remainder=total%count;
    return Array.from({length:count},function(_,i){var index=dt.year*12+dt.month-1+i,y=Math.floor(index/12),m=index%12+1,d=Math.min(dt.day,days(y,m));return {amount:(base+(i<remainder?1:0))/100,date:pad(d)+'/'+pad(m)+'/'+y};});
  }
  function format(c){return c===null?'—':(c/100).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});}
  return {cents:cents,date:date,parts:parts,monthKey:monthKey,days:days,legacyYear:legacyYear,budgetFor:budgetFor,summary:summary,installments:installments,format:format};
});

const SETTINGS={
 clientId:'',
 tenantId:'',
 driveId:'',
 fileId:'',
 appUrl:'https://luizrafaelvm.github.io/gastos-itau/',
 scope:'https://graph.microsoft.com/Files.ReadWrite offline_access',
 staleMinutes:30
};
// Import the private JSON supplied in the installation package on the first app run.
const CONNECTION_KEY='saldo-livre-widget-connection';
if(Keychain.contains(CONNECTION_KEY)){
 try{const saved=JSON.parse(Keychain.get(CONNECTION_KEY));['clientId','tenantId','driveId','fileId'].forEach(k=>{SETTINGS[k]=saved[k]||'';});}catch(_){}
}
if(!SETTINGS.clientId&&!config.runsInWidget){
 const setup=new Alert();setup.title='Importar conexão';setup.message='Cole o conteúdo do arquivo configuracao-saldo-livre.json fornecido no pacote de instalação.';setup.addTextField('Configuração JSON');setup.addAction('Importar');setup.addCancelAction('Cancelar');
 if(await setup.presentAlert()>=0){const saved=JSON.parse(setup.textFieldValue(0));const guid=/^[0-9a-f-]{36}$/i;if(!guid.test(saved.clientId)||!guid.test(saved.tenantId)||!saved.driveId||!saved.fileId)throw new Error('Configuração inválida.');['clientId','tenantId','driveId','fileId'].forEach(k=>{SETTINGS[k]=saved[k];});Keychain.set(CONNECTION_KEY,JSON.stringify(saved));}
}
const TOKEN_KEY='saldo-livre-oauth-'+SETTINGS.clientId;
const fm=FileManager.local(),cachePath=fm.joinPath(fm.documentsDirectory(),'saldo-livre-summary.json');
const authBase='https://login.microsoftonline.com/'+SETTINGS.tenantId+'/oauth2/v2.0';
const graphBase='https://graph.microsoft.com/v1.0/drives/'+encodeURIComponent(SETTINGS.driveId)+'/items/'+SETTINGS.fileId+'/workbook';
function form(o){return Object.keys(o).map(k=>encodeURIComponent(k)+'='+encodeURIComponent(o[k])).join('&');}
async function http(url,method,body,token){
 const r=new Request(url);r.method=method||'GET';r.timeoutInterval=15;r.headers={};
 if(token)r.headers.Authorization='Bearer '+token;
 if(body){r.headers['Content-Type']='application/x-www-form-urlencoded';r.body=form(body);}
 const text=await r.loadString();let data;try{data=JSON.parse(text);}catch(_){throw new Error('Resposta inválida do servidor.');}
 return {status:r.response.statusCode,data};
}
function getSavedToken(){try{return Keychain.contains(TOKEN_KEY)?JSON.parse(Keychain.get(TOKEN_KEY)):null;}catch(_){return null;}}
function saveToken(data,previous){if(!data.access_token)throw new Error('Login não retornou token.');const saved={access_token:data.access_token,refresh_token:data.refresh_token||(previous&&previous.refresh_token),expires:Date.now()+Number(data.expires_in)*1000};Keychain.set(TOKEN_KEY,JSON.stringify(saved));return saved.access_token;}
async function accessToken(){
 const t=getSavedToken();if(!t)throw new Error('Abra o Scriptable e faça login.');
 if(t.expires>Date.now()+60000)return t.access_token;
 if(!t.refresh_token)throw new Error('Refaça o login no Scriptable.');
 const res=await http(authBase+'/token','POST',{client_id:SETTINGS.clientId,grant_type:'refresh_token',refresh_token:t.refresh_token,scope:SETTINGS.scope});
 if(res.status!==200)throw new Error('Login expirado. Abra o Scriptable e entre novamente.');return saveToken(res.data,t);
}
async function login(){
 const start=await http(authBase+'/devicecode','POST',{client_id:SETTINGS.clientId,scope:SETTINGS.scope});
 if(start.status!==200)throw new Error('Não foi possível iniciar o login. Ative fluxos de cliente público em Dashboard Gastos no Microsoft Entra. '+(start.data.error||''));
 const d=start.data;Pasteboard.copyString(d.user_code);
 const alert=new Alert();alert.title='Entrar com Microsoft';alert.message='Código copiado: '+d.user_code+'\nAbra '+d.verification_uri+' no Safari, entre com sua conta e depois volte ao Scriptable.';alert.addAction('Abrir login');alert.addCancelAction('Cancelar');if(await alert.presentAlert()<0)throw new Error('Login cancelado.');
 Safari.open(d.verification_uri);
 const back=new Alert();back.title='Concluir login';back.message='Depois de inserir o código no Safari, volte e toque em Verificar.';back.addAction('Verificar');back.addCancelAction('Cancelar');if(await back.presentAlert()<0)throw new Error('Login cancelado.');
 let interval=Math.max(5,Number(d.interval)||5),deadline=Date.now()+Math.min(Number(d.expires_in)||900,180)*1000;
 while(Date.now()<deadline){await new Promise(resolve=>Timer.schedule(interval*1000,false,resolve));const res=await http(authBase+'/token','POST',{client_id:SETTINGS.clientId,grant_type:'urn:ietf:params:oauth:grant-type:device_code',device_code:d.device_code});if(res.status===200)return saveToken(res.data);if(res.data.error==='slow_down'){interval+=5;continue;}if(res.data.error!=='authorization_pending')throw new Error('Login não concluído: '+res.data.error);}
 throw new Error('Tempo de login esgotado. Execute o script novamente.');
}
async function graphRows(table,token){let result=[],url=graphBase+'/tables/'+table+'/rows';while(url){if(!url.startsWith(graphBase+'/'))throw new Error('Endereço de dados inesperado.');const res=await http(url,'GET',null,token);if(res.status===404&&table==='Orcamentos')return [];if(res.status!==200)throw new Error('Falha ao atualizar Excel ('+res.status+').');if(!Array.isArray(res.data.value))throw new Error('Resposta de tabela inválida.');result=result.concat(res.data.value);url=res.data['@odata.nextLink'];}return result;}
async function fetchSummary(){
 const token=await accessToken();
 const cols=await http(graphBase+'/tables/Gastos/columns','GET',null,token);if(cols.status!==200||!Array.isArray(cols.data.value))throw new Error('Não foi possível ler as colunas.');
 const fields={date:'date',time:'time',merchant:'merchant',amount:'amount',card:'card',obs:'obs'};
 const rows=(await graphRows('Gastos',token)).map(r=>{const o={rowIndex:r.index};cols.data.value.forEach((c,i)=>{const k=String(c.name).toLowerCase();if(fields[k])o[fields[k]]=r.values[0][i];});return o;}).filter(r=>r.merchant);
 const budgets=(await graphRows('Orcamentos',token)).filter(r=>r.values[0][0]).map(r=>({month:String(r.values[0][0]),budget:r.values[0][1]}));
 const key=Finance.monthKey(Finance.parts());const s=Finance.summary(rows,budgets,key);
 const data={key,availableCents:s.availableCents,complete:s.complete,dailyCents:s.dailyCents,budgetCents:s.budgetCents,daysRemaining:s.daysRemaining,possibleDuplicates:s.possibleDuplicates,incompleteInstallments:s.incompleteInstallments,updatedAt:new Date().toISOString()};
 // Cache only the summary. No merchant, card, GPS or transaction history.
 fm.writeString(cachePath,JSON.stringify(data));return data;
}
function cached(){try{return fm.fileExists(cachePath)?JSON.parse(fm.readString(cachePath)):null;}catch(_){return null;}}
function money(c,decimals){return 'R$ '+(c/100).toLocaleString('pt-BR',{minimumFractionDigits:decimals,maximumFractionDigits:decimals});}
function draw(data,error){
 const w=new ListWidget();w.url=SETTINGS.appUrl;w.refreshAfterDate=new Date(Date.now()+15*60000);
 const lock=config.runsInAccessoryWidget,inline=config.widgetFamily==='accessoryInline',family=config.widgetFamily;
 w.backgroundColor=lock?new Color('#000000',0):new Color('#080808');w.setPadding(lock?0:16,lock?0:16,lock?0:16,lock?0:16);
 const current=Finance.monthKey(Finance.parts()),same=data&&data.key===current;
 const ready=same&&data.complete&&data.availableCents!==null;
 const stale=!!error||!data||!same||Date.now()-Date.parse(data.updatedAt)>SETTINGS.staleMinutes*60000;
 const label=ready?(data.availableCents<0?'excedido':'disponível'):data&&!same?'atualizar mês':data&&!data.complete?'conferir dados':'configurar';
 if(inline){const t=w.addText(ready?money(data.availableCents,0)+' · '+money(Math.floor((data.dailyCents||0)/100)*100,0)+'/dia'+(stale?' · desatualizado':''):label);t.font=Font.semiboldSystemFont(12);return w;}
 if(!lock)w.addSpacer();
 const large=w.addText(ready?money(data.availableCents,0):'—');large.font=Font.boldSystemFont(lock?23:family==='small'?34:family==='large'?62:54);large.minimumScaleFactor=0.5;large.lineLimit=1;large.textColor=!lock&&ready&&data.availableCents<0?new Color('#ff453a'):Color.white();
 const small=w.addText(label);small.font=Font.mediumSystemFont(lock?10:13);small.textColor=lock?Color.white():new Color('#aaaaaa');
 if(ready){w.addSpacer(lock?2:10);const daily=w.addText(money(Math.floor((data.dailyCents||0)/100)*100,0)+'/dia');daily.font=Font.semiboldSystemFont(lock?12:18);daily.textColor=Color.white();}
 if(!lock)w.addSpacer();
 if(stale){const note=w.addText('desatualizado'+(same&&data?' · '+new Date(data.updatedAt).toLocaleTimeString('pt-BR',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit'}):''));note.font=Font.systemFont(lock?8:10);note.textColor=lock?Color.white():new Color('#ffd18a');}
 if(ready&&data.possibleDuplicates){const n=w.addText('conferir duplicatas');n.font=Font.systemFont(lock?8:10);}
 if(!ready&&!lock){const hint=w.addText(error?'Abra o Scriptable para conectar.':'Defina orçamento e confira datas no app.');hint.font=Font.systemFont(10);hint.textColor=new Color('#aaaaaa');}
 return w;
}
let data=null,error=null,cancelled=false;
try{
 if(!config.runsInWidget){
  if(!SETTINGS.clientId)throw new Error('Importe a conexão fornecida no pacote de instalação.');
  if(!getSavedToken())await login();
  else {const menu=new Alert();menu.title='Saldo Livre';menu.addAction('Atualizar e visualizar');menu.addAction('Refazer login');menu.addDestructiveAction('Sair e apagar dados');menu.addCancelAction('Cancelar');const choice=await menu.presentSheet();if(choice<0)cancelled=true;else if(choice===1)await login();else if(choice===2){if(Keychain.contains(TOKEN_KEY))Keychain.remove(TOKEN_KEY);if(fm.fileExists(cachePath))fm.remove(cachePath);cancelled=true;}}
 }
 if(!cancelled)data=await fetchSummary();
}catch(e){error=e.message;data=cached();if(!config.runsInWidget){const a=new Alert();a.title='Não foi possível atualizar';a.message=error;a.addAction('OK');await a.presentAlert();}}
if(!cancelled){const widget=draw(data,error);Script.setWidget(widget);if(!config.runsInWidget)await widget.presentMedium();}
Script.complete();
