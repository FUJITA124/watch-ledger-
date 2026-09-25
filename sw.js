/* 時計メンテナンス台帳 — service worker
   アプリ本体と Google Fonts をキャッシュし、オフラインでも起動できるようにする。
   アプリのデータ（時計・着用記録）は localStorage 側にあり、ここでは扱わない。 */

var VERSION = 'v4';
var SHELL   = 'ledger-shell-' + VERSION;
var FONTS   = 'ledger-fonts-' + VERSION;
var ASSETS  = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', function(e){
  e.waitUntil(
    caches.open(SHELL)
      .then(function(c){ return c.addAll(ASSETS); })
      .catch(function(){})
      .then(function(){ return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.map(function(k){
        if(k !== SHELL && k !== FONTS) return caches.delete(k);
      }));
    }).then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(e){
  var req = e.request;
  if(req.method !== 'GET') return;

  var url;
  try{ url = new URL(req.url); }catch(err){ return; }

  /* アプリ本体：オンラインなら最新を取りに行き、失敗したらキャッシュで起動 */
  if(url.origin === self.location.origin){
    e.respondWith(
      fetch(req).then(function(res){
        if(res && res.ok){
          var copy = res.clone();
          caches.open(SHELL).then(function(c){ c.put(req, copy); });
        }
        return res;
      }).catch(function(){
        return caches.match(req).then(function(hit){
          return hit || caches.match('./index.html') || caches.match('./');
        });
      })
    );
    return;
  }

  /* Google Fonts：一度取れたらキャッシュを使い続ける（オフラインでも同じ書体） */
  if(url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com'){
    e.respondWith(
      caches.match(req).then(function(hit){
        if(hit) return hit;
        return fetch(req).then(function(res){
          if(res && (res.ok || res.type === 'opaque')){
            var copy = res.clone();
            caches.open(FONTS).then(function(c){ c.put(req, copy); });
          }
          return res;
        }).catch(function(){
          return new Response('', {status: 504, statusText: 'offline'});
        });
      })
    );
  }
});
