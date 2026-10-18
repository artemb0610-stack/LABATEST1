/*
 * Эффект скорости при быстрой прокрутке: следы «гиперпрыжка» и зелёные молнии по краям.
 *  - холст лежит ПОД карточками (sticky-слой внутри экрана): переводы и кнопки всегда поверх,
 *    эффект виден только в промежутках и по краям;
 *  - направление: прокрутка вниз — следы летят вверх (одни цвета), вверх — вниз (другие цвета);
 *  - кадры рисуются только пока есть частицы — в покое ноль нагрузки;
 *  - касания не перехватывает (pointer-events: none), всё задаётся конфигом (scrollFx).
 * В приложении — тот же приём на Canvas/Compose и Core Animation: слой за списком, скорость из ScrollState.
 */
(function (root) {
  'use strict';

  var MAX = 140;
  var canvas = document.createElement('canvas');
  canvas.className = 'sfx';
  canvas.setAttribute('aria-hidden', 'true');
  var ctx = canvas.getContext('2d');
  var cfg = null, host = null, w = 0, h = 0, dpr = 1;
  var parts = [], bolts = [], raf = 0, last = 0;
  var lastY = 0, lastT = 0, vSmooth = 0, lastBolt = { l: 0, r: 0 };
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function rand(a, b) { return a + Math.random() * (b - a); }
  function pick(a) { return a[(Math.random() * a.length) | 0]; }

  function size() {
    if (!host) return;
    w = host.clientWidth; h = host.clientHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    canvas.style.height = h + 'px';
    canvas.style.marginBottom = (-h) + 'px';   // слой не занимает места в ленте
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // Подключить к экрану (вызывается при входе на экран)
  function attach(screen) {
    stop();
    host = null;
    if (!cfg || !cfg.enabled || reduce || !screen) { if (canvas.parentNode) canvas.parentNode.removeChild(canvas); return; }
    if (cfg.screens.indexOf(screen.getAttribute('data-screen')) === -1) { if (canvas.parentNode) canvas.parentNode.removeChild(canvas); return; }
    host = screen;
    screen.insertBefore(canvas, screen.firstChild);
    size();
    lastY = screen.scrollTop; lastT = performance.now(); vSmooth = 0;
  }

  function onScroll(e) {
    if (!host || e.currentTarget !== host) return;
    var now = performance.now(), y = host.scrollTop;
    var gap = now - lastT, dt = Math.max(12, gap), dy = y - lastY;
    lastY = y; lastT = now;
    // скорость сглаживаем: браузер то склеивает, то дробит события прокрутки, и мгновенная скорость «скачет»
    if (gap > 150) vSmooth = 0;
    vSmooth = vSmooth * 0.55 + (dy / dt) * 0.45;
    var v = vSmooth;                         // px/мс; > 0 — прокрутка вниз
    var sp = Math.abs(v);
    if (sp < cfg.minSpeed) return;
    var dir = v > 0 ? -1 : 1;                // вниз → следы летят вверх
    var cols = v > 0 ? cfg.down : cfg.up;
    // срабатывает только на сильной прокрутке, но сразу ощутимо: чем сильнее рывок, тем гуще и длиннее следы
    var over = sp - cfg.minSpeed;
    var n = Math.min(11, 4 + Math.floor(over * 3));
    for (var i = 0; i < n && parts.length < MAX; i++) {
      var x = rand(0, w), yy = rand(0, h);
      var speed = 700 + sp * 480;
      parts.push({ x: x, y: yy, vx: (x - w / 2) * (0.8 + over * 0.35), vy: dir * speed,
        len: Math.min(220, 70 + over * 50), wd: rand(1.6, 3.2), c: pick(cols), t: 0, life: rand(0.3, 0.48) });
    }
    if (cfg.lightning && sp >= cfg.lightningSpeed) {
      ['l', 'r'].forEach(function (side) {
        if (now - lastBolt[side] < 260 || Math.random() < 0.45) return;
        lastBolt[side] = now;
        bolts.push(makeBolt(side));
      });
    }
    if (!raf) { last = now; raf = requestAnimationFrame(frame); }
  }

  // Ломаная молния вдоль края экрана, в полосе шириной ~22px — под карточками
  function makeBolt(side) {
    var y0 = rand(h * 0.08, h * 0.55), len = rand(140, 280), pts = [];
    var edge = side === 'l' ? 7 : w - 7;
    for (var y = y0; y <= y0 + len; y += rand(14, 26)) {
      var x = edge + (side === 'l' ? 1 : -1) * rand(0, 14) + rand(-4, 4);
      pts.push([x, y]);
    }
    var branch = null;
    if (pts.length > 4) {
      var k = 2 + ((Math.random() * (pts.length - 3)) | 0), bx = pts[k][0], by = pts[k][1];
      branch = [[bx, by], [bx + (side === 'l' ? 10 : -10), by + 14], [bx + (side === 'l' ? 6 : -6), by + 30]];
    }
    return { pts: pts, branch: branch, t: 0, life: 0.24 };
  }

  function stroke(pts) {
    ctx.beginPath();
    for (var i = 0; i < pts.length; i++) { if (i) ctx.lineTo(pts[i][0], pts[i][1]); else ctx.moveTo(pts[i][0], pts[i][1]); }
    ctx.stroke();
  }

  function frame(now) {
    var dt = Math.min(0.033, (now - last) / 1000); last = now;
    ctx.clearRect(0, 0, w, h);
    ctx.lineCap = 'round';

    for (var i = parts.length - 1; i >= 0; i--) {
      var p = parts[i];
      p.t += dt;
      if (p.t >= p.life) { parts.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      var a = 1 - p.t / p.life;
      var m = Math.sqrt(p.vx * p.vx + p.vy * p.vy) || 1;
      var tx = p.x - p.vx / m * p.len, ty = p.y - p.vy / m * p.len;
      // хвост — широкий и прозрачный, голова — тонкая и яркая
      ctx.globalAlpha = a * 0.28; ctx.strokeStyle = p.c; ctx.lineWidth = p.wd * 2.6;
      ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(p.x, p.y); ctx.stroke();
      ctx.globalAlpha = a * 0.85; ctx.lineWidth = p.wd;
      ctx.beginPath(); ctx.moveTo((p.x + tx) / 2, (p.y + ty) / 2); ctx.lineTo(p.x, p.y); ctx.stroke();
    }

    for (var j = bolts.length - 1; j >= 0; j--) {
      var b = bolts[j];
      b.t += dt;
      if (b.t >= b.life) { bolts.splice(j, 1); continue; }
      var f = (1 - b.t / b.life) * (0.55 + Math.random() * 0.45);   // мерцание
      ctx.globalAlpha = f * 0.35; ctx.strokeStyle = cfg.boltGlow; ctx.lineWidth = 7; stroke(b.pts);
      ctx.globalAlpha = f; ctx.strokeStyle = cfg.boltCore; ctx.lineWidth = 2; stroke(b.pts);
      if (b.branch) { ctx.lineWidth = 1.4; stroke(b.branch); }
    }
    ctx.globalAlpha = 1;

    if (parts.length || bolts.length) raf = requestAnimationFrame(frame);
    else { raf = 0; ctx.clearRect(0, 0, w, h); }
  }

  function stop() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0; parts.length = 0; bolts.length = 0;
    if (w) ctx.clearRect(0, 0, w, h);
  }

  function init(screens) {
    Array.prototype.forEach.call(screens, function (s) { s.addEventListener('scroll', onScroll, { passive: true }); });
    window.addEventListener('resize', size);
  }

  root.KB = root.KB || {};
  root.KB.scrollFx = {
    init: init,
    attach: attach,
    setConfig: function (c) { cfg = c; },
    stop: stop
  };
})(this);
