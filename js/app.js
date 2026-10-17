/*
 * Прототип: заглушки экранов + подключение слоя «красивых чисел» к копилке.
 * Экраны здесь — макет для демо. Внедряемая часть — engine.js (правила), overlay.js (слой) и config/effects.json.
 */
(function () {
  'use strict';

  var E = KB.engine, FX = KB.overlay;
  var CONFIG_URL = 'config/effects.json';   // в проде — ключ CMS или файл на CDN
  var CACHE_KEY = 'kb.effects.cache';

  var state = {
    balance: 1250,
    piggy: 980,
    goal: 5000,
    history: [
      { title: 'Отложено со счёта', sum: 200, when: 'вчера' },
      { title: 'Отложено со счёта', sum: 500, when: '12 окт' },
      { title: 'Подарок от бабушки', sum: 280, when: '5 окт' }
    ],
    raw: null,          // исходный JSON конфига (как пришёл из CMS)
    cfg: E.sanitize(null), // до загрузки конфига эффекты выключены — главный экран не ждёт
    seasonOverride: 'auto',
    stack: ['home']
  };

  var $ = function (id) { return document.getElementById(id); };
  var app = $('app');
  var amountEl = $('amount');

  /* ================= навигация ================= */

  function screenEl(name) { return app.querySelector('[data-screen="' + name + '"]'); }
  function current() { return state.stack[state.stack.length - 1]; }
  function isForbidden() { return screenEl(current()).getAttribute('data-overlay') === 'forbidden'; }

  function go(name) {
    if (current() === name) return;
    var prev = screenEl(current());
    prev.classList.remove('is-active'); prev.classList.add('is-behind');
    state.stack.push(name);
    var next = screenEl(name);
    next.classList.remove('is-behind'); next.classList.add('is-active');
    next.scrollTop = 0;
    onEnter(name);
  }

  function back() {
    if (state.stack.length < 2) return;
    var leaving = screenEl(state.stack.pop());
    leaving.classList.remove('is-active', 'is-behind');
    var to = screenEl(current());
    to.classList.remove('is-behind'); to.classList.add('is-active');
    onEnter(current(), { from: leaving.getAttribute('data-screen') });
  }

  function onEnter(name, info) {
    if (isForbidden()) FX.cancel();            // на оплату/перевод — слой гаснет мгновенно
    if (name === 'piggy') enterPiggy(info);
    if (name === 'topup') enterTopup();
    if (name === 'home') renderHome();
  }

  app.addEventListener('click', function (e) {
    var t = e.target.closest('[data-go]');
    if (t) { go(t.getAttribute('data-go')); return; }
    if (e.target.closest('[data-back]')) back();
  });

  /* ================= конфиг ================= */

  function applyConfig(raw) {
    state.raw = raw;
    state.cfg = E.sanitize(raw);
    renderHome();
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
        return KB.DEFAULT_CONFIG || null;  // открыто как файл без сервера — берём встроенный
      });
  }

  /* ================= главная ================= */

  function renderHome() {
    $('homeBalance').textContent = E.formatRub(state.balance);
    $('homePiggy').textContent = E.formatRub(state.piggy);
    $('homeGoal').textContent = 'из ' + E.formatRub(state.goal);
    $('homeBar').style.width = pct() + '%';
    $('homeSpark').hidden = !E.classify(state.piggy, state.cfg);
  }

  function pct() { return Math.min(100, Math.round(state.piggy / state.goal * 100)); }

  /* ================= копилка ================= */

  function enterPiggy(info) {
    if (info && info.from === 'topup' && state.pendingTopup) {
      var t = state.pendingTopup; state.pendingTopup = null;
      renderPiggy({ auto: false, value: t.from });
      setTimeout(function () { animateTopup(t.from, t.to); }, 320); // ждём окончания перехода
      return;
    }
    renderPiggy({ auto: true });
  }

  function renderPiggy(opts) {
    var value = opts.value !== undefined ? opts.value : state.piggy;
    var hit = E.classify(value, state.cfg);
    renderAmount(value, hit);
    renderProgress(value);
    renderSoftHint(value);
    renderHistory();
    if (opts.auto && hit) autoShow(hit, state.cfg.autoMode);
  }

  function renderAmount(value, hit) {
    var text = E.formatRub(value);
    var html = '';
    var digitIndex = 0;
    var s = String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    for (var i = 0; i < s.length; i++) {
      if (s[i] === ' ') { html += '<span class="sp"></span>'; continue; }
      html += '<span class="d' + (s[i] === '0' ? ' zero' : '') + '" data-i="' + digitIndex + '">' + s[i] + '</span>';
      digitIndex++;
    }
    html += '<span class="cur">₽</span>';
    amountEl.innerHTML = html;
    amountEl.setAttribute('data-text', text);
    amountEl.setAttribute('aria-label', 'В копилке ' + text);
    amountEl.classList.remove('is-shine', 'is-pop');
    $('tapHint').hidden = true;

    if (!hit) {
      amountEl.removeAttribute('data-pattern');
      amountEl.removeAttribute('style');
      return;
    }
    var st = hit.style;
    amountEl.setAttribute('data-pattern', st.pattern);
    amountEl.style.setProperty('--c', st.color || '#1f2329');
    amountEl.style.setProperty('--a', st.accent || '#fff3d6');

    var ds = amountEl.querySelectorAll('.d');
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
      amountEl.appendChild(line);
      var first = ds[0], last = ds[ds.length - 1];
      line.style.left = ((first.offsetLeft + last.offsetLeft + last.offsetWidth) / 2 - 1) + 'px';
    }
  }

  function renderProgress(value) {
    var p = Math.min(100, Math.round(value / state.goal * 100));
    $('piggyBar').style.width = p + '%';
    $('piggyPct').textContent = p + '%';
    $('piggyGoal').textContent = 'цель ' + E.formatRub(state.goal);
  }

  // Мягкая подсказка «до красивого числа». Только на экране копилки, без сроков и давления; выключается из CMS.
  function renderSoftHint(value) {
    var el = $('softHint');
    var next = E.findNext(value, state.cfg);
    if (!next || value >= state.goal) { el.hidden = true; return; }
    el.textContent = E.fillTemplate(state.cfg.hint.text, { next: E.formatRub(next.value), gap: next.gap });
    el.hidden = false;
  }

  function renderHistory() {
    $('history').innerHTML = state.history.map(function (h) {
      return '<li><span>' + h.title + '<br><small class="muted">' + h.when + '</small></span><span class="plus">+' + E.formatRub(h.sum) + '</span></li>';
    }).join('');
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
      th.style.setProperty('--hint-ink', hit.style.color || '');
      th.style.setProperty('--hint-bg', hit.style.accent || '');
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
    return [st.color, st.accent].concat(st.palette || []).filter(Boolean).concat(['#ffd45c', '#4dabf7']);
  }

  // Полный эффект: вариант анимации выбирается из списка в конфиге, поэтому повторный показ не одинаковый.
  function fullEffect(hit) {
    if (isForbidden()) return;
    var cfg = state.cfg, rule = hit.rule;
    var kinds = [rule.effects[(Math.random() * rule.effects.length) | 0]];
    var s = season();
    if (s && s.particles) kinds.push(s.particles);
    FX.play(kinds, originOfAmount(), paletteOf(hit.style), cfg.maxEffectMs);
    FX.toast((s && s.badgePrefix ? s.badgePrefix + ' ' : '') + rule.badge);
    FX.haptic([15, 40, 25]);
    FX.chime('pretty');
    rollDigits();
    amountEl.classList.remove('is-pop'); void amountEl.offsetWidth; amountEl.classList.add('is-pop');
    $('tapHint').hidden = true;
  }

  // «Перекатывание» цифр как у счётчика. Только визуал, ввод не блокирует.
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
      }, 260 + i * 90);
    });
  }

  amountEl.addEventListener('click', function () {
    askMotionPermission();
    var hit = E.classify(state.piggy, state.cfg);
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
    var sum = parseInt($('topupInput').value.replace(/\D/g, ''), 10) || 0;
    var err = $('topupError');
    if (sum <= 0) { err.textContent = 'Введи сумму'; err.hidden = false; return; }
    if (sum > state.balance) { err.textContent = 'На счёте столько нет'; err.hidden = false; return; }
    var from = state.piggy;
    state.balance -= sum;
    state.piggy += sum;
    state.history.unshift({ title: 'Отложено со счёта', sum: sum, when: 'только что' });
    state.pendingTopup = { from: from, to: state.piggy };
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
    if (cfg.milestones) {
      var crossed = E.crossedMilestones(from, to, state.goal, cfg.milestones.percents);
      if (crossed.length) {
        var top = crossed[crossed.length - 1];
        var text = E.fillTemplate(cfg.milestones.texts[String(top)] || ('Пройдено ' + top + '% пути к цели!'), { goal: E.formatRub(state.goal) });
        FX.play(cfg.milestones.effects.length ? cfg.milestones.effects : ['confetti'], originOfAmount(),
          ['#34c46e', '#ffd45c', '#4dabf7', '#ff6b6b', '#9775fa'], cfg.maxEffectMs);
        FX.toast(text, 2000);
        if (!hit) { FX.haptic([20, 50, 20]); FX.chime('milestone'); }
      }
    }
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
    var hit = E.classify(state.piggy, state.cfg);
    if (hit) fullEffect(hit);
    else if (state.cfg.enabled) {
      FX.play(['coins'], originOfAmount(), ['#ffd45c'], 1000);
      FX.haptic([10, 30, 10, 30, 10]);
      FX.chime('coin');
    }
  });

  /* ================= звук ================= */

  $('soundBtn').addEventListener('click', function () {
    var on = FX.setSound(this.textContent === '🔇');
    this.textContent = on ? '🔊' : '🔇';
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
    state.piggy = Math.max(0, v | 0);
    renderHome();
    demo.hidden = true;
    if (current() !== 'piggy') {
      while (state.stack.length > 1) back();
      go('piggy');
    } else renderPiggy({ auto: true });
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
    $('demoHint').checked = !!(state.cfg.hint && state.cfg.hint.enabled);
    showWarnings();
  }
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
  $('demoHint').addEventListener('change', function () {
    if (!state.raw) return;
    state.raw.hint = Object.assign({}, state.raw.hint, { enabled: this.checked });
    applyConfig(state.raw);
    syncDemoJson();
  });
  $('demoSeason').addEventListener('change', function () { state.seasonOverride = this.value; });

  /* ================= старт ================= */

  FX.init({ isForbidden: isForbidden });
  renderHome();
  renderHistory();
  // Конфиг грузим после первой отрисовки, чтобы не замедлять запуск и главный экран.
  var idle = window.requestIdleCallback || function (fn) { return setTimeout(fn, 50); };
  idle(function () { loadConfig().then(applyConfig); });
})();
