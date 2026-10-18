/*
 * Офлайн-режим прототипа.
 * При первом открытии кладёт все файлы в кэш телефона — дальше интерфейс работает без интернета,
 * в том числе после перезагрузки страницы.
 *  - все файлы: «сеть сначала, иначе кэш» — онлайн всегда свежая версия, офлайн — сохранённая;
 *  - поэтому правки в репозитории доходят до телефонов сами, VERSION трогать не обязательно.
 * В нативном приложении это делает кэш CMS-ключа и ресурсы внутри сборки.
 */
var VERSION = 'kopilka-v7';
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

// Сеть сначала (с таймаутом), иначе кэш. Онлайн телефон всегда получает свежие файлы —
// правки из репозитория доходят без ручного повышения VERSION. Офлайн всё берётся из кэша.
function networkFirst(req, cacheKey, timeoutMs) {
  return new Promise(function (resolve) {
    var done = false;
    var fallback = function () {
      if (done) return; done = true;
      caches.match(cacheKey, { ignoreSearch: true }).then(function (r) {
        if (r) return resolve(r);
        // в кэше нет — последняя попытка сетью (первое открытие на медленной сети)
        fetch(req.url).then(resolve).catch(function () { resolve(Response.error()); });
      });
    };
    var timer = setTimeout(fallback, timeoutMs);
    // по адресу, а не по исходному запросу: запрос открытия страницы нельзя переиспользовать с параметрами
    fetch(req.url, { cache: 'no-store', credentials: 'same-origin' }).then(function (res) {
      clearTimeout(timer);
      if (!res.ok) { fallback(); return; }
      var copy = res.clone();
      caches.open(VERSION).then(function (c) { c.put(cacheKey, copy); });
      if (done) return; done = true;
      resolve(res);
    }).catch(function () { clearTimeout(timer); fallback(); });
  });
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // чужие адреса не трогаем (их и нет)

  if (isConfig(url)) { e.respondWith(networkFirst(req, 'config/effects.json', 2500)); return; }
  if (req.mode === 'navigate') { e.respondWith(networkFirst(req, 'index.html', 3000)); return; }
  e.respondWith(networkFirst(req, req, 3000));
});
