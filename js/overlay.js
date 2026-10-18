/*
 * Слой эффектов поверх приложения.
 * Правила брифа, которые здесь соблюдаются:
 *  - слой не перехватывает касания (pointer-events: none) — ввод не блокируется ни на миг;
 *  - на экранах с data-overlay="forbidden" (оплата, переводы) эффект не запускается,
 *    а запущенный — гасится сразу при уходе с экрана;
 *  - длительность эффекта ограничена maxEffectMs из конфига;
 *  - число частиц ограничено, рисуем в одном canvas одним rAF — держим 60 fps.
 * В приложении это Lottie-анимация поверх Compose / SwiftUI (см. README).
 */
(function (root) {
  'use strict';

  var MAX_PARTICLES = 240;
  var canvas, ctx, toastsEl, dpr = 1, w = 0, h = 0;
  var particles = [], rafId = 0, endAt = 0, isForbidden = function () { return false; };
  var soundOn = false, audioCtx = null;

  function init(opts) {
    canvas = document.getElementById('fxCanvas');
    toastsEl = document.getElementById('toasts');
    ctx = canvas.getContext('2d');
    isForbidden = opts.isForbidden || isForbidden;
    resize();
    window.addEventListener('resize', resize);
  }

  function resize() {
    var r = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = r.width; h = r.height;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /* ---------- частицы ---------- */

  // Праздничная радуга: сами цифры спокойные, а момент праздника — яркий.
  var FESTIVE = ['#ff5a5f', '#ff9f1c', '#ffd23f', '#3ddc84', '#2ec4f1', '#4f7cff', '#a66cff', '#ff5fa2'];
  var COIN = ['#ffd45c', '#f2b630', '#ffe08a'];
  var LEAF = ['#e8772e', '#d9542c', '#f2b630', '#b8642a'];

  function rand(a, b) { return a + Math.random() * (b - a); }
  function pickOne(arr) { return arr[(Math.random() * arr.length) | 0]; }
  function mix(palette) { return FESTIVE.concat(palette || []); }

  function spawn(kind, origin, palette, durMs) {
    var n, i, a, sp, life = durMs / 1000, cols = mix(palette);
    switch (kind) {
      case 'coins':
        n = 18;
        for (i = 0; i < n; i++) push({ kind: 'coin', x: rand(20, w - 20), y: rand(-120, -20), vx: rand(-20, 20), vy: rand(120, 260),
          g: 520, r: rand(9, 14), spin: rand(4, 9), phase: rand(0, 6), color: pickOne(COIN), life: life });
        // искорки вокруг монет
        for (i = 0; i < 14; i++) push({ kind: 'star', x: rand(20, w - 20), y: rand(-60, h * 0.4), vx: 0, vy: rand(60, 140), g: 0,
          r: rand(3, 6), phase: rand(0, 6), color: pickOne(['#fff3a6', '#ffd23f', '#ffffff']), life: life });
        break;
      case 'confetti':
        n = 90;
        for (i = 0; i < n; i++) {
          a = rand(-Math.PI * 0.95, -Math.PI * 0.05); sp = rand(280, 620);
          push({ kind: 'conf', shape: (Math.random() * 3) | 0, x: origin.x, y: origin.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
            g: 700, drag: 0.985, sw: rand(7, 11), sh: rand(4, 7), rot: rand(0, 6), vr: rand(-12, 12), color: pickOne(cols), life: life });
        }
        break;
      case 'streamers':
        // серпантин: волнистые цветные ленты сверху
        n = 16;
        for (i = 0; i < n; i++) push({ kind: 'ribbon', x: rand(10, w - 10), y: rand(-160, -20), vx: rand(-25, 25), vy: rand(170, 280), g: 60,
          len: rand(26, 40), amp: rand(4, 7), phase: rand(0, 6), rot: rand(-0.6, 0.6), vr: rand(-2.5, 2.5), color: pickOne(FESTIVE), life: life });
        break;
      case 'fireworks':
        // салют: 3 разноцветных взрыва в верхней части экрана, по очереди
        for (var f = 0; f < 3; f++) {
          var cx = rand(w * 0.18, w * 0.82), cy = rand(h * 0.1, h * 0.36), col = FESTIVE[(Math.random() * FESTIVE.length) | 0];
          var col2 = pickOne(FESTIVE), delay = f * 0.28;
          push({ kind: 'flash', x: cx, y: cy, delay: delay, r: 0, color: col, life: delay + 0.35, vx: 0, vy: 0, g: 0 });
          for (i = 0; i < 30; i++) {
            a = (i / 30) * Math.PI * 2 + rand(-0.08, 0.08); sp = rand(150, 260);
            push({ kind: 'spark', x: cx, y: cy, delay: delay, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 160, drag: 0.94,
              r: rand(2, 3.4), color: i % 3 ? col : col2, life: Math.min(life, delay + rand(0.9, 1.3)) });
          }
        }
        break;
      case 'burst':
        // радужное кольцо-волна и звёздочки от суммы
        push({ kind: 'ring', x: origin.x, y: origin.y, vx: 0, vy: 0, g: 0, r0: Math.max(30, origin.rw * 0.6), r1: Math.max(120, origin.rw * 1.6), life: Math.min(life, 0.7) });
        for (i = 0; i < 26; i++) {
          a = (i / 26) * Math.PI * 2; sp = rand(180, 320);
          push({ kind: 'star', x: origin.x, y: origin.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 0, drag: 0.9,
            r: rand(4, 8), phase: rand(0, 6), color: FESTIVE[i % FESTIVE.length], life: Math.min(life, rand(0.6, 0.9)) });
        }
        break;
      case 'sparkles':
        n = 30;
        for (i = 0; i < n; i++) push({ kind: 'star', x: origin.x + rand(-origin.rw - 20, origin.rw + 20), y: origin.y + rand(-origin.rh - 20, origin.rh + 20),
          vx: rand(-20, 20), vy: rand(-50, -5), g: 0, r: rand(4, 10), phase: rand(0, 6), color: pickOne(cols.concat(['#fff3a6'])), life: life * rand(0.6, 1) });
        break;
      case 'leaves':
        n = 14;
        for (i = 0; i < n; i++) push({ kind: 'leaf', x: rand(0, w), y: rand(-80, -10), vx: rand(-30, 30), vy: rand(60, 120), g: 30,
          sway: rand(30, 60), phase: rand(0, 6), rot: rand(0, 6), vr: rand(-2, 2), r: rand(7, 11), color: pickOne(LEAF), life: life });
        break;
      case 'snow':
        n = 40;
        for (i = 0; i < n; i++) push({ kind: 'snow', x: rand(0, w), y: rand(-80, -5), vx: rand(-10, 10), vy: rand(40, 90), g: 0,
          sway: rand(10, 25), phase: rand(0, 6), r: rand(1.5, 3.5), color: '#ffffff', life: life });
        break;
      case 'coinDrop':
        push({ kind: 'coin', x: origin.x, y: -30, vx: 0, vy: 380, g: 1500, r: 22, spin: 7, phase: 0, color: COIN[0],
          stopY: origin.y, life: Math.min(life, 0.9) });
        break;
    }
  }

  function push(p) { if (particles.length < MAX_PARTICLES) { p.t = 0; particles.push(p); } }

  function frame(now) {
    if (isForbidden()) { cancel(); return; }
    var dt = Math.min(0.033, (now - (frame.last || now)) / 1000);
    frame.last = now;
    ctx.clearRect(0, 0, w, h);
    var remaining = endAt - now;
    var fade = remaining < 300 ? Math.max(0, remaining / 300) : 1;

    for (var i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      p.t += dt;
      if (p.t > p.life || remaining <= 0) { particles.splice(i, 1); continue; }
      if (p.delay && p.t < p.delay) continue;           // ждёт своей очереди (салют)
      p.vy += p.g * dt;
      if (p.drag) { p.vx *= p.drag; p.vy *= p.drag; }
      p.x += p.vx * dt + (p.sway ? Math.cos(p.t * 3 + p.phase) * p.sway * dt : 0);
      p.y += p.vy * dt;
      if (p.stopY !== undefined && p.y > p.stopY) { p.y = p.stopY; p.vy *= -0.35; if (Math.abs(p.vy) < 60) p.vy = 0; }
      if (p.vr) p.rot += p.vr * dt;
      var alpha = fade * Math.min(1, (p.life - p.t) / 0.25);
      draw(p, alpha);
    }

    if (particles.length && remaining > 0) rafId = requestAnimationFrame(frame);
    else stopParticles();
  }

  function stopParticles() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0; particles.length = 0; endAt = 0;
    if (ctx) ctx.clearRect(0, 0, w, h);
  }

  function draw(p, alpha) {
    ctx.globalAlpha = Math.max(0, alpha);
    ctx.fillStyle = p.color;
    switch (p.kind) {
      case 'coin': {
        var sx = Math.abs(Math.cos(p.t * p.spin + p.phase)) * 0.85 + 0.15;
        ctx.save(); ctx.translate(p.x, p.y); ctx.scale(sx, 1);
        ctx.beginPath(); ctx.arc(0, 0, p.r, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#c98f12'; ctx.lineWidth = p.r * 0.14; ctx.stroke();
        if (sx > 0.5) {
          ctx.fillStyle = '#b07a0c'; ctx.font = '800 ' + Math.round(p.r * 1.15) + 'px system-ui, sans-serif';
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('₽', 0, p.r * 0.06);
        }
        ctx.restore(); break;
      }
      case 'conf':
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        var k = Math.abs(Math.cos(p.rot * 2)) * 0.8 + 0.2;     // «переворот» в воздухе
        if (p.shape === 1) { ctx.beginPath(); ctx.ellipse(0, 0, p.sw / 2.4, p.sw / 2.4 * k, 0, 0, Math.PI * 2); ctx.fill(); }
        else if (p.shape === 2) { ctx.beginPath(); ctx.moveTo(0, -p.sw / 2); ctx.lineTo(p.sw / 2, p.sw / 2 * k); ctx.lineTo(-p.sw / 2, p.sw / 2 * k); ctx.closePath(); ctx.fill(); }
        else ctx.fillRect(-p.sw / 2, -p.sh / 2 * k, p.sw, p.sh * k + 1);
        ctx.restore(); break;
      case 'ribbon': {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.strokeStyle = p.color; ctx.lineWidth = 4; ctx.lineCap = 'round';
        ctx.beginPath();
        for (var j = 0; j <= 10; j++) {
          var yy = (j / 10 - 0.5) * p.len, xx = Math.sin(j * 0.9 + p.t * 9 + p.phase) * p.amp;
          if (j) ctx.lineTo(xx, yy); else ctx.moveTo(xx, yy);
        }
        ctx.stroke(); ctx.restore(); break;
      }
      case 'spark': {
        // искра салюта с коротким хвостом
        ctx.strokeStyle = p.color; ctx.lineWidth = p.r; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.035, p.y - p.vy * 0.035); ctx.stroke();
        break;
      }
      case 'flash': {
        var ft = (p.t - (p.delay || 0)) / 0.35, fr = 8 + ft * 34;
        ctx.globalAlpha = Math.max(0, alpha * (1 - ft));
        var g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, fr);
        g.addColorStop(0, '#ffffff'); g.addColorStop(0.4, p.color); g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, fr, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case 'ring': {
        // радужная волна: кольцо из цветных дуг расходится от суммы
        var rt = p.t / p.life, rr = p.r0 + (p.r1 - p.r0) * (1 - Math.pow(1 - rt, 3));
        ctx.globalAlpha = Math.max(0, alpha * (1 - rt));
        ctx.lineWidth = 10 * (1 - rt) + 2; ctx.lineCap = 'round';
        var seg = (Math.PI * 2) / FESTIVE.length;
        for (var q = 0; q < FESTIVE.length; q++) {
          ctx.strokeStyle = FESTIVE[q]; ctx.beginPath();
          ctx.arc(p.x, p.y, rr, q * seg + rt * 2, (q + 1) * seg + rt * 2 - 0.05); ctx.stroke();
        }
        break;
      }
      case 'star': {
        var s = p.r * (0.6 + 0.4 * Math.sin(p.t * 10 + p.phase));
        ctx.save(); ctx.translate(p.x, p.y);
        ctx.beginPath();
        ctx.moveTo(0, -s); ctx.quadraticCurveTo(0, 0, s, 0); ctx.quadraticCurveTo(0, 0, 0, s);
        ctx.quadraticCurveTo(0, 0, -s, 0); ctx.quadraticCurveTo(0, 0, 0, -s);
        ctx.fill(); ctx.restore(); break;
      }
      case 'leaf':
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot + Math.sin(p.t * 2 + p.phase) * 0.6);
        ctx.beginPath(); ctx.ellipse(0, 0, p.r, p.r * 0.5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,.18)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(-p.r, 0); ctx.lineTo(p.r, 0); ctx.stroke();
        ctx.restore(); break;
      case 'snow':
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill(); break;
    }
    ctx.globalAlpha = 1;
  }

  /**
   * Запуск эффекта. kinds — массив из конфига, origin — центр суммы на экране.
   * Если эффект уже идёт, новый просто добавляет частицы и продлевает до maxMs, не дольше.
   */
  function play(kinds, origin, palette, maxMs) {
    if (isForbidden()) return false;
    if (w === 0) resize();
    var now = performance.now();
    endAt = Math.max(endAt, now + maxMs);
    if (endAt - now > maxMs) endAt = now + maxMs;
    kinds.forEach(function (k) { spawn(k, origin, palette, maxMs); });
    if (!rafId) { frame.last = now; rafId = requestAnimationFrame(frame); }
    return true;
  }

  // Полная остановка: при уходе на запрещённый экран гасим и частицы, и плашки.
  function cancel() {
    stopParticles();
    toastQueue.length = 0;
    if (toastsEl) toastsEl.innerHTML = '';
  }

  /* ---------- плашки ---------- */

  var toastQueue = [], toastBusy = false, lastToastText = '';
  function toast(text, ms) {
    if (!text || isForbidden()) return;
    // частые тапы не копят очередь плашек: одинаковые не дублируем, в очереди не больше двух
    if (lastToastText === text && toastBusy) return;
    if (toastQueue.some(function (q) { return q.text === text; }) || toastQueue.length >= 2) return;
    toastQueue.push({ text: text, ms: ms || 1700 });
    if (!toastBusy) nextToast();
  }
  function nextToast() {
    var item = toastQueue.shift();
    if (!item || isForbidden()) { toastBusy = false; lastToastText = ''; toastQueue.length = 0; return; }
    toastBusy = true;
    lastToastText = item.text;
    var el = document.createElement('div');
    el.className = 'toast'; el.textContent = item.text;
    toastsEl.appendChild(el);
    setTimeout(function () { el.classList.add('out'); }, item.ms - 300);
    setTimeout(function () { el.remove(); nextToast(); }, item.ms);
  }

  /* ---------- тактильность и звук ---------- */

  // В приложении — VIBRATION_EVENT / нативный haptic. В вебе работает на Android, на iOS молча игнорируется.
  function haptic(pattern) {
    try { if (navigator.vibrate) navigator.vibrate(pattern || 20); } catch (e) { /* нет — и ладно */ }
  }

  // Звук выключен по умолчанию и включается только кнопкой. Синтез вместо файлов — ноль килобайт.
  function setSound(on) { soundOn = !!on; if (on) ensureAudio(); return soundOn; }
  function ensureAudio() {
    if (!audioCtx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (AC) audioCtx = new AC();
    }
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  }
  function chime(kind) {
    if (!soundOn || !audioCtx || isForbidden()) return;
    var notes = kind === 'coin' ? [1318, 1760] : kind === 'milestone' ? [784, 988, 1175, 1568] : [988, 1319, 1568];
    var t0 = audioCtx.currentTime;
    notes.forEach(function (f, i) {
      var o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = 'triangle'; o.frequency.value = f;
      var t = t0 + i * 0.09;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.18, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      o.connect(g).connect(audioCtx.destination);
      o.start(t); o.stop(t + 0.4);
    });
  }

  root.KB = root.KB || {};
  root.KB.overlay = { init: init, play: play, cancel: cancel, toast: toast, haptic: haptic, setSound: setSound, chime: chime, resize: resize };
})(this);
