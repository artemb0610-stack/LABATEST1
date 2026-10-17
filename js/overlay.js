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

  var MAX_PARTICLES = 140;
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

  var COIN = ['#ffd45c', '#f2b630', '#ffe08a'];
  var LEAF = ['#e8772e', '#d9542c', '#f2b630', '#b8642a'];

  function rand(a, b) { return a + Math.random() * (b - a); }
  function pickOne(arr) { return arr[(Math.random() * arr.length) | 0]; }

  function spawn(kind, origin, palette, durMs) {
    var n, i, life = durMs / 1000;
    switch (kind) {
      case 'coins':
        n = 18;
        for (i = 0; i < n; i++) push({ kind: 'coin', x: rand(20, w - 20), y: rand(-120, -20), vx: rand(-20, 20), vy: rand(120, 260),
          g: 520, r: rand(9, 14), spin: rand(4, 9), phase: rand(0, 6), color: pickOne(COIN), life: life });
        break;
      case 'confetti':
        n = 70;
        for (i = 0; i < n; i++) {
          var a = rand(-Math.PI * 0.95, -Math.PI * 0.05), sp = rand(260, 560);
          push({ kind: 'conf', x: origin.x, y: origin.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 700, drag: 0.985,
            sw: rand(6, 10), sh: rand(3, 6), rot: rand(0, 6), vr: rand(-12, 12), color: pickOne(palette), life: life });
        }
        break;
      case 'sparkles':
        n = 22;
        for (i = 0; i < n; i++) push({ kind: 'star', x: origin.x + rand(-origin.rw, origin.rw), y: origin.y + rand(-origin.rh, origin.rh),
          vx: rand(-15, 15), vy: rand(-40, -5), g: 0, r: rand(4, 9), phase: rand(0, 6), color: pickOne(palette.concat(['#fff3a6'])), life: life * rand(0.6, 1) });
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
        ctx.fillRect(-p.sw / 2, -p.sh / 2, p.sw, p.sh * Math.abs(Math.cos(p.rot * 2)) + 1);
        ctx.restore(); break;
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
