// Запуск: node tests/engine.test.js
'use strict';
var assert = require('assert');
var path = require('path');
var fs = require('fs');
var E = require('../js/engine.js');

var raw = JSON.parse(fs.readFileSync(path.join(__dirname, '../config/effects.json'), 'utf8'));
var cfg = E.sanitize(raw);
var passed = 0;
function t(name, fn) { fn(); passed++; }
function idOf(n) { var h = E.classify(n, cfg); return h ? h.rule.id : null; }

t('конфиг из репозитория валиден', function () {
  assert.deepStrictEqual(cfg.warnings, []);
  assert.ok(cfg.rules.length >= 8);
});

t('купюры', function () {
  assert.strictEqual(idOf(100), 'bn-100');
  assert.strictEqual(idOf(500), 'bn-500');
  assert.strictEqual(idOf(1000), 'bn-1000');
  assert.strictEqual(idOf(2000), 'bn-2000');
  assert.strictEqual(idOf(5000), 'bn-5000');
});

t('одинаковые цифры', function () {
  ['111', '2222', '7777', '99999'].forEach(function (s) { assert.strictEqual(idOf(+s), 'same', s); });
  assert.strictEqual(idOf(77), null); // короче minLength
});

t('лесенки вверх и вниз', function () {
  [123, 1234, 12345, 6789, 4321, 987, 3210].forEach(function (n) { assert.strictEqual(idOf(n), 'stairs', n); });
  assert.strictEqual(idOf(1235), null);
});

t('зеркальные и пары', function () {
  assert.strictEqual(idOf(1221), 'mirror');
  assert.strictEqual(idOf(12321), 'mirror');
  assert.strictEqual(idOf(1212), 'pairs');
  assert.strictEqual(idOf(2020), 'pairs');
});

t('круглые', function () {
  assert.strictEqual(idOf(300), 'round');
  assert.strictEqual(idOf(2500), 'round');
  assert.strictEqual(idOf(10000), 'round');
  assert.strictEqual(idOf(250), null);
});

t('обычные суммы и мусор не украшаются', function () {
  [0, -1000, 1000.5, 987.01, NaN, Infinity, 1357, 42].forEach(function (n) { assert.strictEqual(idOf(n), null, n); });
  assert.strictEqual(E.classify('1000', cfg), null);
});

t('подсказка: ближайшее красивое число сверху', function () {
  assert.deepStrictEqual(pick(E.findNext(995, cfg)), [999, 4]);   // 999 тоже красивое
  assert.deepStrictEqual(pick(E.findNext(999, cfg)), [1000, 1]);
  assert.deepStrictEqual(pick(E.findNext(4990, cfg)), [5000, 10]); // 4994 — зеркальное, но не hintable
  assert.deepStrictEqual(pick(E.findNext(7770, cfg)), [7777, 7]);
  assert.deepStrictEqual(pick(E.findNext(1230, cfg)), [1234, 4]);
  // палиндромы помечены hintable:false — к ним не подталкиваем
  assert.notStrictEqual(E.findNext(1219, cfg).value, 1221);
  function pick(r) { return [r.value, r.gap]; }
});

t('подсказку можно выключить из конфига', function () {
  var off = E.sanitize(Object.assign({}, raw, { hint: { enabled: false } }));
  assert.strictEqual(E.findNext(995, off), null);
});

t('этапы цели', function () {
  assert.deepStrictEqual(E.crossedMilestones(1000, 1300, 5000, [25, 50, 75, 100]), [25]);
  assert.deepStrictEqual(E.crossedMilestones(1000, 4000, 5000, [25, 50, 75, 100]), [25, 50, 75]);
  assert.deepStrictEqual(E.crossedMilestones(4900, 5000, 5000, [25, 50, 75, 100]), [100]);
  assert.deepStrictEqual(E.crossedMilestones(1300, 1300, 5000, [25]), []);
  assert.deepStrictEqual(E.crossedMilestones(1300, 1000, 5000, [25]), []);
});

t('сезоны, в том числе через Новый год', function () {
  assert.strictEqual(E.activeSeason(cfg, new Date(2026, 9, 17)).id, 'autumn');
  assert.strictEqual(E.activeSeason(cfg, new Date(2026, 11, 31)).id, 'winter');
  assert.strictEqual(E.activeSeason(cfg, new Date(2027, 0, 15)).id, 'winter');
  assert.strictEqual(E.activeSeason(cfg, new Date(2027, 5, 1)), null);
});

t('битый конфиг не ломает приложение', function () {
  [null, undefined, 42, 'текст', [], {}].forEach(function (bad) {
    var c = E.sanitize(bad);
    assert.strictEqual(E.classify(1000, c), null);
    assert.ok(c.warnings.length > 0);
  });
});

t('частично битый конфиг: плохие правила отбрасываются, хорошие работают', function () {
  var broken = JSON.parse(JSON.stringify(raw));
  broken.rules.unshift({ id: 'x', type: 'lottery', style: 'round' });
  broken.rules.unshift({ id: 'y', type: 'regex', pattern: '(((', style: 'round' });
  broken.rules.unshift({ id: 'z', type: 'exact', values: [1000], style: 'нет-такого' });
  var c = E.sanitize(broken);
  assert.strictEqual(c.warnings.length, 3);
  assert.strictEqual(E.classify(1000, c).rule.id, 'bn-1000');
});

t('отдельное правило можно выключить, своё число — добавить', function () {
  var c2 = JSON.parse(JSON.stringify(raw));
  c2.rules.forEach(function (r) { if (r.id === 'stairs') r.enabled = false; });
  c2.rules.unshift({ id: 'custom-2026', type: 'exact', values: [2026], style: 'round', badge: 'Число года!', effects: ['confetti'] });
  var c = E.sanitize(c2);
  assert.deepStrictEqual(c.warnings, []);
  assert.strictEqual(E.classify(1234, c), null);
  assert.strictEqual(E.classify(2026, c).rule.id, 'custom-2026');
});

t('выключатель enabled', function () {
  var c = E.sanitize(Object.assign({}, raw, { enabled: false }));
  assert.strictEqual(E.classify(1000, c), null);
});

t('форматирование и шаблоны', function () {
  assert.strictEqual(E.formatRub(12345), '12 345 ₽');
  assert.strictEqual(E.fillTemplate('До {next}: {gap} ₽', { next: 1000, gap: 5 }), 'До 1000: 5 ₽');
});

t('встроенная копия конфига совпадает с config/effects.json', function () {
  var sandbox = {};
  new Function(fs.readFileSync(path.join(__dirname, '../js/default-config.js'), 'utf8')).call(sandbox);
  assert.deepStrictEqual(sandbox.KB.DEFAULT_CONFIG, raw, 'запусти node tools/build-default.js');
});

console.log('✓ все тесты пройдены: ' + passed);
