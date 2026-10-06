'use strict';
const VERSION='saldo-livre-v2-20261006-2';
const SHELL=['./','./index.html','./app-config.js','./finance-core.js','./graph-client.js','./app-v2.js','./manifest.webmanifest','./vendor/leaflet.js','./vendor/leaflet.css','./icons/icon-192.png','./icons/icon-512.png','./icons/apple-touch-icon.png','./icons/maskable-512.png','./docs/INSTALACAO.html'];
self.addEventListener('install',event=>event.waitUntil(caches.open(VERSION).then(cache=>cache.addAll(SHELL))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('saldo-livre-')&&k!==VERSION).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  // No caching of Graph requests, credentials, authentication callbacks, or financial API data.
  if(event.request.method!=='GET'||url.origin!==self.location.origin)return;
  if(event.request.mode==='navigate'){
    if(url.search||url.hash)return;
    event.respondWith(fetch(event.request).then(res=>{if(res.ok){const copy=res.clone();caches.open(VERSION).then(c=>c.put(event.request,copy));}return res;}).catch(()=>caches.match(event.request).then(r=>r||caches.match(new URL('./index.html',self.registration.scope)))));
  }else if(SHELL.some(p=>new URL(p,self.registration.scope).href===url.href)){
    event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request)));
  }
});
