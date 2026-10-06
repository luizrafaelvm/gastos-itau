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
