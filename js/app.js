/*
 * Прототип: экраны по макетам СберKids + подключение слоя «красивых чисел» к копилке.
 * Экраны — макет для демо. Внедряемая часть — engine.js (правила), overlay.js (слой) и config/effects.json.
 */
(function () {
  'use strict';

  var E = KB.engine, FX = KB.overlay;
  var CONFIG_URL = 'config/effects.json';   // в проде — ключ CMS или файл на CDN
  var CACHE_KEY = 'kb.effects.cache';
  var ROOTS = ['home', 'piggies'];

  var state = {
    balance: 3250,
    balanceKop: 40,
    piggies: [
      { id: 'scooter', name: 'Самокат', pic: '🛴', bg: '#fff3e0', amount: 980, goal: 5000, demo: true,
        history: [
          { title: 'Отложено со счёта', sum: 200, when: 'вчера' },
          { title: 'Отложено со счёта', sum: 500, when: '12 октября' },
          { title: 'Подарок от бабушки', sum: 280, when: '5 октября' }
        ] },
      { id: 'boots', name: 'Резиновые сапоги', pic: '🥾', bg: '#ffe9e4', amount: 450, goal: 500, history: [] },
      { id: 'slime', name: 'Слайм розовый', pic: '🫧', bg: '#eceaff', amount: 580, goal: 700, history: [] },
      { id: 'pens', name: 'Фломастеры', pic: '🖍️', bg: '#e6f4ff', amount: 100, goal: 200, history: [] },
      { id: 'robot', name: 'Робот', pic: '🤖', bg: '#e4f7f4', amount: 3950, goal: 12000, history: [] }
    ],
    sel: 0,
    homeHistory: [
      { title: 'Канцтовары', sub: 'Покупка', sum: -240, ic: 'cart', tone: 'violet' },
      { title: 'В копилку «Самокат»', sub: 'Перевод', sum: -200, ic: 'piggy', tone: 'green' },
      { title: 'От мамы', sub: 'Пополнение', sum: 500, ic: 'gift', tone: 'peach' }
    ],
    raw: null,             // исходный JSON конфига (как пришёл из CMS)
    cfg: E.sanitize(null), // до загрузки конфига эффекты выключены — главный экран не ждёт
    seasonOverride: 'auto',
    stack: ['home']
  };

  var $ = function (id) { return document.getElementById(id); };
  var app = $('app');
  var amountEl = $('amount');
  function P() { return state.piggies[state.sel]; }

  function sumHTML(n) {
    var sign = n < 0 ? '−' : '';
    var s = String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return sign + s + ' <span class="rub">₽</span>';
  }

  /* ================= навигация ================= */

  function screenEl(name) { return app.querySelector('[data-screen="' + name + '"]'); }
  function current() { return state.stack[state.stack.length - 1]; }
  function isForbidden() { return screenEl(current()).getAttribute('data-overlay') === 'forbidden'; }
  function syncChrome() {
    var root = ROOTS.indexOf(current()) !== -1;
    app.classList.toggle('is-root', root);
    var tabs = app.querySelectorAll('.tab[data-tab]');
    for (var i = 0; i < tabs.length; i++) tabs[i].classList.toggle('is-active', tabs[i].getAttribute('data-tab') === state.stack[0]);
  }

  // Одна «страховочная» запись в истории браузера, пока открыт вложенный экран
  var historyGuard = false;
  function ensureGuard() {
    if (!historyGuard && state.stack.length > 1 && window.history && history.pushState) {
      try { history.pushState({ kb: 1 }, ''); historyGuard = true; } catch (e) { /* без истории — ок */ }
    }
  }
  window.addEventListener('popstate', function () {
    historyGuard = false;
    if (!$('styleSheet').hidden) closeStyleSheet();
    else if (!$('demo').hidden) $('demo').hidden = true;
    else if (state.stack.length > 1) back();
    ensureGuard();
  });

  // Пока экраны едут (0,35 с), тапы игнорируются: второй тап двойного нажатия
  // не должен попасть в кнопку экрана, который выезжает под пальцем.
  var navLockUntil = 0;
  function lockNav() { navLockUntil = Date.now() + 350; }
  app.addEventListener('click', function (e) {
    if (Date.now() < navLockUntil && !e.target.closest('#demo, #demoFab')) { e.stopPropagation(); e.preventDefault(); }
  }, true);

  function go(name) {
    if (current() === name) return;
    lockNav();
    var prev = screenEl(current());
    prev.classList.remove('is-active'); prev.classList.add('is-behind');
    state.stack.push(name);
    var next = screenEl(name);
    next.classList.remove('is-behind', 'is-tab'); next.classList.add('is-active');
    next.scrollTop = 0;
    syncChrome();
    ensureGuard();
    onEnter(name);
  }

  function back() {
    if (state.stack.length < 2) return;
    lockNav();
    var leaving = screenEl(state.stack.pop());
    leaving.classList.remove('is-active', 'is-behind');
    var to = screenEl(current());
    to.classList.remove('is-behind'); to.classList.add('is-active');
    syncChrome();
    onEnter(current(), { from: leaving.getAttribute('data-screen') });
  }

  // Переключение вкладок: без анимации сдвига, как в приложении
  function tab(name) {
    while (state.stack.length > 1) {
      var s = screenEl(state.stack.pop());
      s.classList.remove('is-active', 'is-behind');
    }
    if (state.stack[0] === name) { screenEl(name).scrollTo({ top: 0, behavior: 'smooth' }); return; }
    var old = screenEl(state.stack[0]);
    old.classList.add('is-tab'); old.classList.remove('is-active', 'is-behind');
    state.stack = [name];
    var el = screenEl(name);
    el.classList.add('is-tab', 'is-active');
    el.scrollTop = 0;
    syncChrome();
    onEnter(name);
  }

  function onEnter(name, info) {
    KB.scrollFx.attach(screenEl(name));
    if (!$('styleSheet').hidden) closeStyleSheet();
    if (isForbidden()) FX.cancel();            // на оплату/перевод — слой гаснет мгновенно
    if (name === 'piggy') enterPiggy(info);
    if (name === 'topup') enterTopup();
    if (name === 'home') renderHome();
    if (name === 'piggies') renderPiggies();
    if (name === 'history') renderHistoryScreen();
  }

  app.addEventListener('click', function (e) {
    var t = e.target.closest('[data-tab]');
    if (t) { tab(t.getAttribute('data-tab')); return; }
    var p = e.target.closest('[data-piggy]');
    if (p) { state.sel = +p.getAttribute('data-piggy'); go('piggy'); return; }
    t = e.target.closest('[data-go]');
    if (t) { go(t.getAttribute('data-go')); return; }
    if (e.target.closest('[data-back]')) back();
  });

  /* ================= конфиг ================= */

  function applyConfig(raw) {
    state.raw = raw;
    state.cfg = E.sanitize(raw);
    KB.scrollFx.setConfig(state.cfg.scrollFx);
    KB.scrollFx.attach(screenEl(current()));
    renderHome();
    renderPiggies();
    if (current() === 'piggy') renderPiggy({ auto: false });
    return state.cfg;
  }

  function loadConfig() {
    var ctrl = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 2000);
    return fetch(CONFIG_URL, { cache: 'no-cache', signal: ctrl && ctrl.signal })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (json) {
        clearTimeout(timer);
        try { localStorage.setItem(CACHE_KEY, JSON.stringify(json)); } catch (e) { /* хранилище недоступно */ }
        return json;
      })
      .catch(function () {
        clearTimeout(timer);
        try { var c = localStorage.getItem(CACHE_KEY); if (c) return JSON.parse(c); } catch (e) { /* битый кэш */ }
        // открыто как файл без сервера — берём встроенный (копию, чтобы правки в демо-панели его не портили)
        return KB.DEFAULT_CONFIG ? JSON.parse(JSON.stringify(KB.DEFAULT_CONFIG)) : null;
      });
  }

  /* ================= главный ================= */

  // Баланс с копейками (серым, как в макетах). При первом показе — короткий «досчёт» от нуля.
  var balanceShown = false;
  function balanceHTML(rub) {
    var s = String(rub).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    var kop = (state.balanceKop < 10 ? '0' : '') + state.balanceKop;
    return s + '<span class="kop">,' + kop + '</span> <span class="rub">₽</span>';
  }
  function renderBalance() {
    var el = $('homeBalance');
    if (balanceShown || !window.requestAnimationFrame) { el.innerHTML = balanceHTML(state.balance); return; }
    balanceShown = true;
    var to = state.balance, t0 = performance.now(), dur = 700;
    (function step(now) {
      var k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      el.innerHTML = balanceHTML(Math.round(to * e));
      if (k < 1) requestAnimationFrame(step);
    })(t0);
  }

  function renderHome() {
    renderBalance();
    $('homeSaved').textContent = E.formatRub(state.piggies.reduce(function (a, p) { return a + p.amount; }, 0));
    $('homeHistory').innerHTML = state.homeHistory.map(function (h) {
      return '<li><span class="list__ic list__ic--' + h.tone + '"><svg><use href="#i-' + h.ic + '"/></svg></span>' +
        '<span class="list__txt"><div class="list__title">' + h.title + '</div><div class="list__sub">' + h.sub + '</div></span>' +
        '<span class="list__sum' + (h.sum > 0 ? ' plus' : '') + '">' + (h.sum > 0 ? '+' : '') + sumHTML(h.sum) + '</span></li>';
    }).join('');
  }

  /* ================= экран «История»: ~100 входящих переводов ================= */
  // Демо-данные генерируются на устройстве с фиксированным зерном — список одинаковый при каждом открытии.
  var historyData = null;
  function makeHistory() {
    var seed = 20261018;
    function rnd() { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; }
    function pick(a) { return a[Math.floor(rnd() * a.length)]; }
    var who = [
      { name: 'Мама', sub: 'Перевод', tone: 'peach', sums: [100, 150, 200, 250, 300, 500] },
      { name: 'Папа', sub: 'Перевод', tone: 'blue', sums: [100, 200, 300, 500, 1000] },
      { name: 'Бабушка Валя', sub: 'Перевод', tone: 'violet2', sums: [200, 300, 500, 1000] },
      { name: 'Дедушка Коля', sub: 'Перевод', tone: 'mint', sums: [100, 300, 500, 700] },
      { name: 'Тётя Оля', sub: 'Перевод', tone: 'peach', sums: [150, 250, 400] },
      { name: 'Брат Саша', sub: 'Перевод', tone: 'blue', sums: [50, 70, 100, 120] },
      { name: 'Мама', sub: 'Карманные на неделю', tone: 'peach', sums: [300, 350, 400] },
      { name: 'Папа', sub: 'За пятёрку', tone: 'blue', sums: [50, 100] },
      { name: 'Бабушка Валя', sub: 'На мороженое', tone: 'violet2', sums: [80, 100, 150] },
      { name: 'Крёстная', sub: 'Перевод', tone: 'mint', sums: [500, 1000] }
    ];
    var items = [], day = new Date(); day.setHours(12, 0, 0, 0);
    while (items.length < 100) {
      var n = rnd() < 0.35 ? 0 : 1 + Math.floor(rnd() * 3);       // в какие-то дни переводов нет
      for (var i = 0; i < n && items.length < 100; i++) {
        var w = pick(who), hh = 8 + Math.floor(rnd() * 13), mm = Math.floor(rnd() * 60);
        items.push({ date: new Date(day), time: (hh < 10 ? '0' : '') + hh + ':' + (mm < 10 ? '0' : '') + mm,
          name: w.name, sub: w.sub, tone: w.tone, sum: pick(w.sums) });
      }
      day.setDate(day.getDate() - 1);
    }
    // внутри дня — от позднего к раннему
    items.sort(function (a, b) { return b.date - a.date || (a.time < b.time ? 1 : -1); });
    return items;
  }

  var MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  function dayTitle(d) {
    var today = new Date(); today.setHours(12, 0, 0, 0);
    var diff = Math.round((today - d) / 86400000);
    if (diff === 0) return 'Сегодня';
    if (diff === 1) return 'Вчера';
    return d.getDate() + ' ' + MONTHS[d.getMonth()] + (d.getFullYear() !== today.getFullYear() ? ' ' + d.getFullYear() : '');
  }

  function renderHistoryScreen() {
    if (!historyData) historyData = makeHistory();
    $('planet').classList.remove('is-in');   // при каждом входе планета снова «восходит» в конце списка
    var monthAgo = new Date(); monthAgo.setDate(monthAgo.getDate() - 30);
    var inMonth = historyData.reduce(function (a, x) { return x.date >= monthAgo ? a + x.sum : a; }, 0);
    $('histIn').innerHTML = '+' + sumHTML(inMonth);
    $('histCount').textContent = historyData.length;
    var html = '', curDay = '';
    historyData.forEach(function (x) {
      var t = dayTitle(x.date);
      if (t !== curDay) {
        if (curDay) html += '</ul>';
        html += '<div class="hday">' + t + '</div><ul class="card list">';
        curDay = t;
      }
      html += '<li><span class="list__ic list__ic--letter list__ic--' + x.tone + '">' + x.name.charAt(0) + '</span>' +
        '<span class="list__txt"><div class="list__title">' + x.name + '</div><div class="list__sub">' + x.sub + ' · ' + x.time + '</div></span>' +
        '<span class="list__sum plus">+' + sumHTML(x.sum) + '</span></li>';
    });
    $('histList').innerHTML = html + (curDay ? '</ul>' : '');
  }

  // Планета поднимается, когда долистали до конца истории
  var planet = $('planet');
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es) {
      // только когда история уже нарисована и открыта: иначе пустой список «показывает» планету сразу
      es.forEach(function (e) { if (e.isIntersecting && historyData && current() === 'history') planet.classList.add('is-in'); });
    }, { root: screenEl('history'), threshold: 0.15 }).observe(planet);
  } else planet.classList.add('is-in');
  // Пасхалка: монета подпрыгивает и переворачивается
  $('planetCoin').addEventListener('click', function () {
    var c = this;
    c.classList.remove('is-flip'); void c.getBoundingClientRect(); c.classList.add('is-flip');
    FX.haptic([10, 40, 10]); FX.chime('coin');
    if (!c._found) { c._found = true; FX.toast('Пасхалка найдена! Ты долистал до самого начала', 2200); }
  });

  /* ================= вкладка «Копилки» ================= */

  function renderPiggies() {
    var total = state.piggies.reduce(function (a, p) { return a + p.amount; }, 0);
    $('totalSum').innerHTML = sumHTML(total);
    $('piggyList').innerHTML = state.piggies.map(function (p, i) {
      var pct = Math.min(100, Math.round(p.amount / p.goal * 100));
      if (p.amount >= p.goal) {
        return '<button class="pcard pcard--done" data-piggy="' + i + '">' +
          '<span class="pcard__pic" style="background:#fff">' + p.pic + '</span>' +
          '<span class="pcard__body"><span class="pcard__name">Ура! Ты накопил на «' + p.name + '»</span>' +
          '<span class="pill">Отметить покупку</span></span></button>';
      }
      var pretty = E.classify(p.amount, state.cfg);
      return '<button class="pcard" data-piggy="' + i + '">' +
        '<span class="pcard__pic" style="background:' + p.bg + '">' + p.pic + '</span>' +
        '<span class="pcard__body">' +
          '<span class="pcard__top"><span class="sum sum--md">' + sumHTML(p.amount) +
            (pretty ? '<svg class="pcard__spark" aria-label="красивое число"><use href="#i-spark"/></svg>' : '') + '</span>' +
            '<span class="pcard__of">из ' + E.formatRub(p.goal) + '</span></span>' +
          '<div class="bar"><div class="bar__fill" style="width:' + pct + '%"></div></div>' +
          '<div class="pcard__name">' + p.name + '</div>' +
        '</span></button>';
    }).join('');
  }

  /* ================= экран копилки ================= */

  function enterPiggy(info) {
    var p = P();
    $('piggyTitle').textContent = p.name;
    $('piggyPic').textContent = p.pic;
    $('piggyPic').style.background = p.bg;
    if (info && info.from === 'topup' && state.pendingTopup) {
      var t = state.pendingTopup; state.pendingTopup = null;
      renderPiggy({ auto: false, value: t.from });
      setTimeout(function () { animateTopup(t.from, t.to); }, 320); // ждём окончания перехода
      return;
    }
    renderPiggy({ auto: true });
  }

  function renderPiggy(opts) {
    var p = P();
    var value = opts.value !== undefined ? opts.value : p.amount;
    var hit = E.classify(value, state.cfg);
    renderAmount(value, hit);
    renderProgress(value);
    renderHistory();
    if (opts.auto && hit) autoShow(hit, state.cfg.autoMode);
  }

  /* ----- оформление цифр, выбранное ребёнком (хранится только на устройстве) ----- */

  var THEME_KEY = 'kb.digits.theme';
  state.theme = 'auto';
  try { state.theme = localStorage.getItem(THEME_KEY) || 'auto'; } catch (e) { /* хранилище недоступно */ }

  function themeById(id) {
    var list = state.cfg.themes || [];
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }
  // Стиль суммы: выбранное оформление, а в «Авто» — стиль красивого числа (или обычные цифры)
  function styleFor(hit) {
    var t = state.cfg.enabled ? themeById(state.theme) : null;
    if (t && t.style && state.cfg.styles[t.style]) return state.cfg.styles[t.style];
    return hit ? hit.style : null;
  }

  // Рисует сумму в элемент: каждая цифра — отдельный span, стиль — через data-pattern и CSS-переменные.
  function paintAmount(el, value, st) {
    var html = '';
    var s = String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    for (var i = 0; i < s.length; i++) {
      if (s[i] === ' ') { html += '<span class="sp"></span>'; continue; }
      html += '<span class="d' + (s[i] === '0' ? ' zero' : '') + '">' + s[i] + '</span>';
    }
    html += '<span class="cur">₽</span>';
    el.innerHTML = html;
    el.setAttribute('data-text', E.formatRub(value));
    var len = String(value).length;
    var k = len <= 5 ? 1 : len === 6 ? 0.88 : len === 7 ? 0.78 : len === 8 ? 0.7 : 0.62;

    if (!st) { el.removeAttribute('data-pattern'); el.removeAttribute('style'); el.style.setProperty('--fs-k', k); return; }
    el.style.setProperty('--fs-k', k);
    el.setAttribute('data-pattern', st.pattern);
    el.style.setProperty('--c', st.color || '#1f2329');
    el.style.setProperty('--a', st.accent || '#fff3d6');

    var ds = el.querySelectorAll('.d');
    var pal = st.palette && st.palette.length ? st.palette : [st.color || '#4dabf7'];
    for (var j = 0; j < ds.length; j++) {
      ds[j].style.setProperty('--delay', (j * 0.12) + 's');
      if (st.pattern === 'blocks') {
        ds[j].style.setProperty('--dc', pal[j % pal.length]);
        ds[j].style.setProperty('--rot', ((j % 2 ? 1 : -1) * (2 + (j % 3))) + 'deg');
      }
      if (st.pattern === 'mirror') {
        // симметричные цифры — одного цвета: 1-2-3-2-1
        ds[j].style.setProperty('--dc', pal[Math.min(j, ds.length - 1 - j) % pal.length]);
      }
    }
    if (st.pattern === 'mirror' && ds.length) {
      var line = document.createElement('span');
      line.className = 'mirror-line';
      el.appendChild(line);
      var first = ds[0], last = ds[ds.length - 1];
      line.style.left = ((first.offsetLeft + last.offsetLeft + last.offsetWidth) / 2 - 1) + 'px';
    }
  }

  function renderAmount(value, hit) {
    paintAmount(amountEl, value, styleFor(hit));
    amountEl.setAttribute('aria-label', 'В копилке ' + E.formatRub(value));
    amountEl.classList.remove('is-shine', 'is-pop');
    $('tapHint').hidden = true;
  }

  /* ----- шторка выбора оформления ----- */

  function openStyleSheet() {
    var sheet = $('styleSheet');
    sheet.hidden = false;
    var value = P().amount;
    var list = $('themeList');
    list.innerHTML = (state.cfg.themes || []).map(function (t) {
      return '<button class="theme' + (t.id === 'auto' ? ' theme--auto' : '') + (t.id === state.theme ? ' is-on' : '') + '" data-theme="' + t.id + '">' +
        '<span class="theme__prev">' + (t.id === 'auto' ? '✨ Сюрприз' : '<span class="amount amount--sm"></span>') + '</span>' +
        '<span class="theme__name">' + t.title + '<span class="theme__check">✓</span></span>' +
        '<span class="theme__desc">' + (t.desc || '') + '</span></button>';
    }).join('');
    // превью рисуем на сумме самого ребёнка — уже после того, как шторка видна
    Array.prototype.forEach.call(list.querySelectorAll('[data-theme]'), function (b) {
      var t = themeById(b.getAttribute('data-theme'));
      var prev = b.querySelector('.amount--sm');
      if (prev && t) paintAmount(prev, value, state.cfg.styles[t.style]);
    });
  }
  function closeStyleSheet() { $('styleSheet').hidden = true; }

  $('styleBtn').addEventListener('click', function () {
    if (!state.cfg.enabled || !(state.cfg.themes || []).length) { FX.haptic(10); return; }
    openStyleSheet();
  });
  $('styleSheet').addEventListener('click', function (e) {
    var b = e.target.closest('[data-theme]');
    if (b) {
      state.theme = b.getAttribute('data-theme');
      try { localStorage.setItem(THEME_KEY, state.theme); } catch (err) { /* не сохранилось — ок, работает до закрытия */ }
      Array.prototype.forEach.call($('themeList').children, function (c) { c.classList.toggle('is-on', c === b); });
      FX.haptic(12);
      renderPiggy({ auto: false });
      return;
    }
    if (e.target.closest('[data-close-sheet]')) closeStyleSheet();
  });

  function renderProgress(value) {
    var goal = P().goal;
    var p = Math.min(100, Math.round(value / goal * 100));
    $('piggyBar').style.width = p + '%';
    $('piggyPct').textContent = p + '% накоплено';
    $('piggyGoal').textContent = 'из ' + E.formatRub(goal);
  }

  function renderHistory() {
    var h = P().history;
    $('history').innerHTML = h.length ? h.map(function (x) {
      return '<li><span class="list__ic list__ic--green"><svg><use href="#i-piggy"/></svg></span>' +
        '<span class="list__txt"><div class="list__title">' + x.title + '</div><div class="list__sub">' + x.when + '</div></span>' +
        '<span class="list__sum plus">+' + sumHTML(x.sum) + '</span></li>';
    }).join('') : '<li><span class="list__sub">Пока пусто — отложи первые монетки</span></li>';
  }

  /* ================= эффекты ================= */

  function autoShow(hit, mode) {
    if (mode === 'off') return;
    if (mode === 'full') { fullEffect(hit); return; }
    // 'hint': тихий блик + подпись «нажми на цифры», без частиц и звука
    amountEl.classList.add('is-shine');
    var th = $('tapHint');
    if (state.cfg.tapHint) {
      th.textContent = state.cfg.tapHint;
      var hs = styleFor(hit);
      th.style.setProperty('--hint-ink', hs.color || '');
      th.style.setProperty('--hint-bg', hs.accent || '');
      th.hidden = false;
    }
  }

  function originOfAmount() {
    var a = amountEl.getBoundingClientRect(), r = app.getBoundingClientRect();
    return { x: a.left - r.left + a.width / 2, y: a.top - r.top + a.height / 2, rw: a.width / 2, rh: a.height / 2 };
  }

  function season() {
    if (state.seasonOverride === 'none') return null;
    if (state.seasonOverride !== 'auto') {
      for (var i = 0; i < state.cfg.seasons.length; i++) if (state.cfg.seasons[i].id === state.seasonOverride) return state.cfg.seasons[i];
      return null;
    }
    return E.activeSeason(state.cfg, new Date());
  }

  function paletteOf(st) {
    return [st.color, st.accent].concat(st.palette || []).filter(Boolean).concat(['#ffd45c', '#5ccf52', '#7fd6f7']);
  }

  // Полный эффект: вариант анимации выбирается из списка в конфиге, поэтому повторный показ не одинаковый.
  function fullEffect(hit) {
    if (isForbidden()) return;
    var cfg = state.cfg, rule = hit.rule;
    // вариант из конфига + радужная волна от суммы + сезонные частицы
    var kinds = [rule.effects[(Math.random() * rule.effects.length) | 0], 'burst'];
    var s = season();
    if (s && s.particles) kinds.push(s.particles);
    FX.play(kinds, originOfAmount(), paletteOf(styleFor(hit)), cfg.maxEffectMs);
    party();
    FX.toast((s && s.badgePrefix ? s.badgePrefix + ' ' : '') + rule.badge);
    FX.haptic([15, 40, 25]);
    FX.chime('pretty');
    rollDigits();
    amountEl.classList.remove('is-pop'); void amountEl.offsetWidth; amountEl.classList.add('is-pop');
    $('tapHint').hidden = true;
  }

  // Радужная вспышка за суммой. Только визуал, касания не перехватывает.
  function party() {
    var halo = $('partyHalo');
    halo.classList.remove('on'); void halo.offsetWidth; halo.classList.add('on');
  }

  // «Перекатывание» цифр как у счётчика, затем каждая цифра подпрыгивает. Только визуал, ввод не блокирует.
  function rollDigits() {
    var ds = amountEl.querySelectorAll('.d');
    Array.prototype.forEach.call(ds, function (d, i) {
      if (d._roll) return;
      var final = d.textContent;
      d.classList.add('roll');
      d._roll = setInterval(function () { d.textContent = (Math.random() * 10) | 0; }, 45);
      setTimeout(function () {
        clearInterval(d._roll); d._roll = null;
        d.textContent = final; d.classList.remove('roll');
        d.classList.remove('hop'); void d.offsetWidth; d.classList.add('hop');
        setTimeout(function () { d.classList.remove('hop'); }, 750);
      }, 260 + i * 90);
    });
  }

  amountEl.addEventListener('click', function () {
    askMotionPermission();
    var hit = E.classify(P().amount, state.cfg);
    if (hit) fullEffect(hit);
    else { FX.haptic(10); amountEl.classList.remove('is-pop'); void amountEl.offsetWidth; amountEl.classList.add('is-pop'); }
  });

  /* ================= пополнение ================= */

  function enterTopup() {
    $('topupBalance').textContent = E.formatRub(state.balance);
    $('topupInput').value = '';
    $('topupError').hidden = true;
  }

  $('chips').addEventListener('click', function (e) {
    var b = e.target.closest('[data-add]');
    if (!b) return;
    var cur = parseInt($('topupInput').value.replace(/\D/g, ''), 10) || 0;
    $('topupInput').value = cur + parseInt(b.getAttribute('data-add'), 10);
  });

  $('topupGo').addEventListener('click', function () {
    if (current() !== 'topup') return; // второй тап во время анимации перехода
    var sum = parseInt($('topupInput').value.replace(/\D/g, ''), 10) || 0;
    var err = $('topupError');
    if (sum <= 0) { err.textContent = 'Введи сумму'; err.hidden = false; return; }
    if (sum > state.balance) { err.textContent = 'На счёте столько нет'; err.hidden = false; return; }
    var p = P(), from = p.amount;
    state.balance -= sum;
    p.amount += sum;
    p.history.unshift({ title: 'Отложено со счёта', sum: sum, when: 'только что' });
    state.homeHistory.unshift({ title: 'В копилку «' + p.name + '»', sub: 'Перевод', sum: -sum, ic: 'piggy', tone: 'green' });
    state.homeHistory.length = Math.min(state.homeHistory.length, 3);
    state.pendingTopup = { from: from, to: p.amount };
    back(); // возвращаемся в копилку — эффект запускается уже там, не на экране перевода
  });

  // Сумма «досчитывается» до новой, затем — красивое число и/или этап цели.
  function animateTopup(from, to) {
    if (current() !== 'piggy') { renderPiggy({ auto: false }); return; }
    var cfg = state.cfg;
    if (cfg.enabled && cfg.topup.enabled) {
      var o = originOfAmount();
      FX.play(['coinDrop'], { x: o.x, y: o.y - o.rh, rw: o.rw, rh: o.rh }, ['#ffd45c'], 900);
      FX.chime('coin');
    }
    var dur = 650, t0 = performance.now();
    (function step(now) {
      if (current() !== 'piggy') { renderPiggy({ auto: false }); return; }
      var k = Math.min(1, (now - t0) / dur);
      var eased = 1 - Math.pow(1 - k, 3);
      var v = Math.round(from + (to - from) * eased);
      if (k < 1) {
        renderAmount(v, null); renderProgress(v);
        requestAnimationFrame(step);
      } else {
        renderPiggy({ auto: false });
        afterTopup(from, to);
      }
    })(t0);
  }

  function afterTopup(from, to) {
    var cfg = state.cfg;
    if (!cfg.enabled) return;
    var hit = E.classify(to, cfg);
    if (hit) {
      if (cfg.autoOnTopup === 'full') fullEffect(hit);
      else if (cfg.autoOnTopup === 'hint') autoShow(hit, 'hint');
    }
    var hadParty = !!hit;
    if (cfg.milestones) {
      var goal = P().goal;
      var crossed = E.crossedMilestones(from, to, goal, cfg.milestones.percents);
      if (crossed.length) {
        var top = crossed[crossed.length - 1];
        var text = E.fillTemplate(cfg.milestones.texts[String(top)] || ('Пройдено ' + top + '% пути к цели!'), { goal: E.formatRub(goal) });
        FX.play((cfg.milestones.effects.length ? cfg.milestones.effects : ['confetti']).concat(['burst']), originOfAmount(),
          ['#5ccf52', '#c4f23a', '#7fd6f7', '#ffd45c', '#9b8cf5'], cfg.maxEffectMs);
        party();
        FX.toast(text, 2000);
        if (!hit) { FX.haptic([20, 50, 20]); FX.chime('milestone'); }
        hadParty = true;
      }
    }
    if (!hadParty) FX.play(['sparkles'], originOfAmount(), [], 900);
  }

  /* ================= встряхивание копилки ================= */
  // Акселерометр есть на обеих платформах и не требует разрешений в нативном приложении.
  // Потряс — монетки звенят; если сумма красивая — повтор эффекта.

  var lastShake = 0, motionAsked = false;
  function askMotionPermission() {
    if (motionAsked) return; motionAsked = true;
    var D = window.DeviceMotionEvent;
    if (D && typeof D.requestPermission === 'function') D.requestPermission().catch(function () {}); // только Safari
  }
  window.addEventListener('devicemotion', function (e) {
    var a = e.accelerationIncludingGravity;
    if (!a || current() !== 'piggy') return;
    var mag = Math.sqrt((a.x || 0) * (a.x || 0) + (a.y || 0) * (a.y || 0) + (a.z || 0) * (a.z || 0));
    var now = Date.now();
    if (mag < 25 || now - lastShake < 1500) return;
    lastShake = now;
    var hit = E.classify(P().amount, state.cfg);
    if (hit) fullEffect(hit);
    else if (state.cfg.enabled) {
      FX.play(['coins'], originOfAmount(), ['#ffd45c'], 1000);
      FX.haptic([10, 30, 10, 30, 10]);
      FX.chime('coin');
    }
  });

  /* ================= звук ================= */

  $('soundBtn').addEventListener('click', function () {
    var on = FX.setSound(this.getAttribute('aria-label') === 'Звук выключен');
    this.innerHTML = '<svg><use href="#i-sound-' + (on ? 'on' : 'off') + '"/></svg>';
    this.setAttribute('aria-label', on ? 'Звук включён' : 'Звук выключен');
  });

  /* ================= демо-панель ================= */

  var demo = $('demo');
  $('demoFab').addEventListener('click', function () {
    demo.hidden = !demo.hidden;
    if (!demo.hidden) syncDemoJson();
  });
  $('demoClose').addEventListener('click', function () { demo.hidden = true; });

  function setPiggy(v) {
    state.sel = 0;                       // демо-копилка «Самокат»
    P().amount = Math.min(99999999, Math.max(0, v | 0));
    demo.hidden = true;
    if (current() !== 'piggy') { tab('piggies'); go('piggy'); }
    else renderPiggy({ auto: true });
  }

  $('presets').addEventListener('click', function (e) {
    var b = e.target.closest('[data-set]');
    if (b) setPiggy(parseInt(b.getAttribute('data-set'), 10));
  });
  $('demoSet').addEventListener('click', function () {
    var v = parseInt($('demoAmount').value.replace(/\D/g, ''), 10);
    if (v >= 0) setPiggy(v);
  });

  function syncDemoJson() {
    $('demoJson').value = state.raw ? JSON.stringify(state.raw, null, 2) : '';
    showWarnings();
    renderCms();
  }

  /* ----- редактор красивых чисел: то, что контент-менеджер меняет в CMS без релиза ----- */

  var TYPE_INFO = {
    repdigit: ['Одинаковые цифры', '777, 2 222, 7 777'],
    sequence: ['Цифры по порядку', '123, 1 234, 4 321'],
    palindrome: ['Зеркальные', '1 221, 12 321'],
    regex: ['Повторяющиеся пары', '1 212, 2 020'],
    round: ['Круглые', '300, 2 500, 10 000']
  };
  var STYLE_NAMES = {
    'banknote-100': 'Купюра 100', 'banknote-500': 'Купюра 500', 'banknote-1000': 'Купюра 1 000',
    'banknote-2000': 'Купюра 2 000', 'banknote-5000': 'Купюра 5 000', 'same-digits': 'Переливы',
    'counting': 'Кубики', 'mirror': 'Зеркало', 'round': 'Зелёное'
  };
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function renderCms() {
    var list = $('cmsRules');
    if (!state.raw || !Array.isArray(state.raw.rules)) { list.innerHTML = '<li class="off">Конфиг не загружен — эффекты выключены</li>'; return; }
    list.innerHTML = state.raw.rules.map(function (r, i) {
      var name, ex;
      if (r.type === 'exact') {
        var nums = (r.values || []).map(function (v) { return E.formatRub(v).replace(' ₽', ''); }).join(', ');
        name = /^bn-/.test(r.id) ? 'Как купюра ' + nums : 'Число ' + nums;
        ex = r.badge || '';
      } else {
        var t = TYPE_INFO[r.type] || [r.type, ''];
        name = t[0]; ex = t[1];
      }
      var custom = /^custom-/.test(r.id || '');
      return '<li class="' + (r.enabled === false ? 'off' : '') + '">' +
        '<button class="cms__sw" data-toggle="' + i + '" aria-label="Вкл/выкл"></button>' +
        '<span class="cms__txt"><div class="cms__name">' + esc(name) + '</div><div class="cms__ex">' + esc(ex) + ' · ' + esc(STYLE_NAMES[r.style] || r.style) + '</div></span>' +
        (custom ? '<button class="cms__del" data-del="' + i + '" aria-label="Удалить">✕</button>' : '') +
        '</li>';
    }).join('');
    var sel = $('cmsStyle');
    if (!sel.options.length && state.raw.styles) {
      sel.innerHTML = Object.keys(state.raw.styles).map(function (k) {
        return '<option value="' + esc(k) + '"' + (k === 'same-digits' ? ' selected' : '') + '>' + esc(STYLE_NAMES[k] || k) + '</option>';
      }).join('');
    }
  }

  function cmsApplied(text) {
    applyConfig(state.raw);
    $('demoJson').value = JSON.stringify(state.raw, null, 2);
    renderCms();
    var m = $('cmsMsg'); m.className = 'demo__warn ok'; m.textContent = text;
  }

  $('cmsRules').addEventListener('click', function (e) {
    var t = e.target.closest('[data-toggle]'), d = e.target.closest('[data-del]');
    if (t) {
      var r = state.raw.rules[+t.getAttribute('data-toggle')];
      r.enabled = r.enabled === false;
      cmsApplied((r.enabled ? '✓ Включено' : '✓ Выключено') + ' — сразу, без релиза приложения');
    } else if (d) {
      state.raw.rules.splice(+d.getAttribute('data-del'), 1);
      cmsApplied('✓ Число удалено');
    }
  });

  $('cmsAdd').addEventListener('click', function () {
    var n = parseInt($('cmsNum').value.replace(/\D/g, ''), 10);
    var m = $('cmsMsg');
    if (!(n > 0) || !state.raw) { m.className = 'demo__warn'; m.textContent = 'Введи число больше нуля'; return; }
    var badge = $('cmsBadge').value.trim() || 'Особое число!';
    state.raw.rules = (state.raw.rules || []).filter(function (r) { return r.id !== 'custom-' + n; });
    state.raw.rules.unshift({ id: 'custom-' + n, type: 'exact', values: [n], style: $('cmsStyle').value,
      badge: badge, effects: ['confetti', 'sparkles', 'coins'] });
    $('cmsNum').value = ''; $('cmsBadge').value = '';
    cmsApplied('✓ Число ' + E.formatRub(n) + ' добавлено без релиза');
    setTimeout(function () { setPiggy(n); }, 600); // сразу показываем, как это выглядит у ребёнка
  });
  function showWarnings(extra) {
    var w = (extra ? [extra] : []).concat(state.cfg.warnings || []);
    var el = $('demoWarn');
    el.className = 'demo__warn' + (w.length ? '' : ' ok');
    el.textContent = w.length ? w.join('\n') : '✓ Конфиг применён: правил ' + state.cfg.rules.length + ', сезонов ' + state.cfg.seasons.length;
  }

  $('demoApply').addEventListener('click', function () {
    var txt = $('demoJson').value, parsed = null, err = '';
    try { parsed = JSON.parse(txt); } catch (e) { err = 'JSON не разобрался — эффекты выключены, приложение работает как обычно'; }
    applyConfig(parsed);
    showWarnings(err);
  });
  $('demoBreak').addEventListener('click', function () {
    $('demoJson').value = '{ "rules": [ { "type": "lottery" ';
    $('demoApply').click();
  });
  $('demoReset').addEventListener('click', function () {
    applyConfig(JSON.parse(JSON.stringify(KB.DEFAULT_CONFIG)));
    syncDemoJson();
  });
  $('demoSeason').addEventListener('change', function () { state.seasonOverride = this.value; });

  /* ================= старт ================= */

  FX.init({ isForbidden: isForbidden });
  KB.scrollFx.init(app.querySelectorAll('.screen'));
  renderHome();
  renderPiggies();
  syncChrome();
  // Конфиг грузим после первой отрисовки, чтобы не замедлять запуск и главный экран.
  var idle = window.requestIdleCallback || function (fn) { return setTimeout(fn, 50); };
  idle(function () { loadConfig().then(function (raw) { applyConfig(raw); renderCms(); }); });

  // Офлайн-режим: service worker кладёт все файлы в кэш телефона при первом открытии.
  function setOffline(text, ok) {
    var el = $('offlineStatus');
    el.textContent = text; el.className = 'demo__sec demo__status' + (ok ? ' ok' : '');
  }
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    var hadController = !!navigator.serviceWorker.controller, reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (hadController && !reloaded) { reloaded = true; location.reload(); }
    });
    navigator.serviceWorker.register('sw.js').then(function () { return navigator.serviceWorker.ready; })
      .then(function () { setOffline('✓ Офлайн-режим готов: можно выключать интернет', true); })
      .catch(function () { setOffline('Офлайн-режим недоступен в этом браузере'); });
  } else {
    setOffline('Офлайн-режим работает только при открытии по https-ссылке');
  }
})();
