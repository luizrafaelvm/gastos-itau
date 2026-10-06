(function(root){
  'use strict';
  function Client(config,tokenProvider){this.base='https://graph.microsoft.com/v1.0/drives/'+encodeURIComponent(config.driveId)+'/items/'+encodeURIComponent(config.fileId)+'/workbook';this.tokenProvider=tokenProvider;}
  Client.prototype.request=async function(path,method,body){
    var url=path.startsWith('https://')?path:this.base+path;
    if(!url.startsWith(this.base+'/'))throw new Error('Endereço Graph inesperado.');
    var token=await this.tokenProvider(),res=await fetch(url,{method:method||'GET',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
    if(!res.ok){var message='';try{var data=await res.json();message=data.error&&data.error.message||'';}catch(_){}var e=new Error('Microsoft Graph '+res.status+(message?': '+message:''));e.status=res.status;throw e;}
    if(res.status===204)return null;var text=await res.text();return text?JSON.parse(text):null;
  };
  Client.prototype.collection=async function(path){var rows=[],next=path;while(next){var data=await this.request(next);if(!Array.isArray(data.value))throw new Error('Resposta de tabela inválida.');rows=rows.concat(data.value);next=data['@odata.nextLink'];}return rows;};
  Client.prototype.rows=function(table){return this.collection('/tables/'+encodeURIComponent(table)+'/rows');};
  Client.prototype.table=async function(name){return this.request('/tables/'+encodeURIComponent(name));};
  Client.prototype.add=function(table,values){return this.request('/tables/'+encodeURIComponent(table)+'/rows/add','POST',{values:values});};
  Client.prototype.patch=function(table,index,values){return this.request('/tables/'+encodeURIComponent(table)+'/rows/itemAt(index='+index+')','PATCH',{values:[values]});};
  Client.prototype.remove=function(table,index){return this.request('/tables/'+encodeURIComponent(table)+'/rows/itemAt(index='+index+')','DELETE');};
  Client.prototype.ensureBudgets=async function(){
    try{return await this.table('Orcamentos');}catch(e){if(e.status!==404)throw e;}
    var sheets=await this.collection('/worksheets'),sheet=sheets.find(function(s){return s.name==='SaldoLivre';});
    if(!sheet)sheet=await this.request('/worksheets/add','POST',{name:'SaldoLivre'});
    var path='/worksheets/'+encodeURIComponent(sheet.id);
    // This sheet is reserved to this application. Never overwrite an existing unknown table.
    var tables=await this.collection(path+'/tables');if(tables.length)throw new Error('A aba SaldoLivre já tem uma tabela. Confira seu nome antes de criar Orcamentos.');
    var range=await this.request(path+"/range(address='A1:C2')");
    if(range.values&&range.values.some(function(r){return r.some(function(v){return v!==''&&v!==null;});}))throw new Error('A aba SaldoLivre já contém dados. Crie uma tabela Orcamentos com Month, Budget, UpdatedAt.');
    await this.request(path+"/range(address='A1:C1')",'PATCH',{values:[['Month','Budget','UpdatedAt']]});
    var table=await this.request(path+'/tables/add','POST',{address:'A1:C1',hasHeaders:true});
    return this.request('/tables/'+encodeURIComponent(table.id),'PATCH',{name:'Orcamentos'});
  };
  root.ExcelClient=Client;
  if(typeof module==='object'&&module.exports)module.exports=Client;
})(typeof globalThis!=='undefined'?globalThis:this);
