// Saldo Livre · execute no Scriptable para fazer o primeiro login.
// O bloco Finance é inserido automaticamente pelo build-widget.py.
// Tokens pessoais ficam no Keychain, nunca no GitHub ou no PWA.
/* FINANCE_CORE */
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
