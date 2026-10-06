const CACHE='zerostress-trips-v8';
const APP_SHELL=['./','./index.html','./styles.css','./app.js','./firebase-config.js','./manifest.json'];

self.addEventListener('install', event=>{
  event.waitUntil(
    caches.open(CACHE)
      .then(cache=>cache.addAll(APP_SHELL))
      .then(()=>self.skipWaiting())
  );
});

self.addEventListener('activate', event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(
        keys
          .filter(key=>key.startsWith('zerostress-trips-') && key!==CACHE)
          .map(key=>caches.delete(key))
      ))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch', event=>{
  if(event.request.method!=='GET') return;

  const url=new URL(event.request.url);
  const sameOrigin=url.origin===self.location.origin;
  const isAppCode=sameOrigin && (
    url.pathname.endsWith('/') ||
    url.pathname.endsWith('.html') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.json')
  );

  // Always ask the network for application code. If the network is unavailable,
  // fall back to the last cached version so the PWA still works offline.
  if(isAppCode){
    event.respondWith(
      fetch(event.request, {cache:'no-store'})
        .then(response=>{
          const copy=response.clone();
          caches.open(CACHE).then(cache=>cache.put(event.request,copy));
          return response;
        })
        .catch(()=>caches.match(event.request).then(cached=>cached || caches.match('./index.html')))
    );
    return;
  }

  // Other same-origin assets can use cache first, with a network fallback.
  if(sameOrigin){
    event.respondWith(
      caches.match(event.request).then(cached=>{
        const network=fetch(event.request).then(response=>{
          const copy=response.clone();
          caches.open(CACHE).then(cache=>cache.put(event.request,copy));
          return response;
        }).catch(()=>cached);
        return cached || network;
      })
    );
  }
});
