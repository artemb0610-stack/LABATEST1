/*
 * Офлайн-режим прототипа.
 * При первом открытии кладёт все файлы в кэш телефона — дальше интерфейс работает без интернета,
 * в том числе после перезагрузки страницы.
 *  - оболочка (html, css, js, иконки): cache-first — мгновенно и офлайн;
 *  - config/effects.json: network-first — свежий конфиг «без релиза», а без сети — последний сохранённый.
 * В нативном приложении это делает кэш CMS-ключа и ресурсы внутри сборки.
 * При изменении файлов оболочки поднимаем VERSION, чтобы телефон забрал новую версию.
 */
var VERSION = 'kopilka-v6';
var SHELL = [
  './',
  'index.html',
  'css/app.css',
  'js/engine.js',
  'js/default-config.js',
  'js/overlay.js',
  'js/app.js',
  'config/effects.json',
  'manifest.webmanifest',
  'icons/icon.svg',
  'icons/icon-180.png',
  'icons/icon-512.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(SHELL.map(function (u) { return new Request(u, { cache: 'reload' }); })); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

function isConfig(url) { return /\/config\/effects\.json$/.test(url.pathname); }

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // чужие адреса не трогаем (их и нет)

  if (isConfig(url)) {
    // network-first с таймаутом: онлайн — свежий конфиг, офлайн — из кэша
    e.respondWith(new Promise(function (resolve) {
      var done = false;
      var fallback = function () {
        if (done) return; done = true;
        caches.match('config/effects.json', { ignoreSearch: true }).then(function (r) {
          resolve(r || new Response('null', { headers: { 'Content-Type': 'application/json' } }));
        });
      };
      var timer = setTimeout(fallback, 2500);
      fetch(req, { cache: 'no-store' }).then(function (res) {
        clearTimeout(timer);
        if (done) return;
        if (!res.ok) { fallback(); return; }
        done = true;
        var copy = res.clone();
        caches.open(VERSION).then(function (c) { c.put('config/effects.json', copy); });
        resolve(res);
      }).catch(function () { clearTimeout(timer); fallback(); });
    }));
    return;
  }

  if (req.mode === 'navigate') {
    // открытие страницы: из кэша, а если его нет — из сети
    e.respondWith(caches.match('index.html').then(function (r) { return r || fetch(req); }));
    return;
  }

  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(function (r) {
      return r || fetch(req).then(function (res) {
        if (res.ok) { var copy = res.clone(); caches.open(VERSION).then(function (c) { c.put(req, copy); }); }
        return res;
      });
    })
  );
});
