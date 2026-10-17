/*
 * Движок «красивых чисел».
 * Чистая логика без DOM: по сумме и конфигу решает, какое оформление показать.
 * Работает и в браузере (window.KB.engine), и в node (module.exports) — для тестов.
 * В нативном приложении этот файл переписывается 1:1 на Kotlin и Swift (~150 строк).
 */
(function (root) {
  'use strict';

  var KNOWN_TYPES = ['exact', 'repdigit', 'sequence', 'palindrome', 'round', 'regex'];
  var KNOWN_EFFECTS = ['coins', 'confetti', 'sparkles', 'leaves', 'snow', 'coinDrop'];

  /* ---------- проверки чисел ---------- */

  function digits(n) { return String(n); }

  function isRepdigit(n, minLength) {
    var s = digits(n);
    if (s.length < (minLength || 3)) return false;
    for (var i = 1; i < s.length; i++) if (s[i] !== s[0]) return false;
    return true;
  }

  // 123, 1234, 12345, 6789 и обратные 4321, 987
  function isSequence(n, minLength) {
    var s = digits(n);
    if (s.length < (minLength || 3)) return false;
    var step = s.charCodeAt(1) - s.charCodeAt(0);
    if (step !== 1 && step !== -1) return false;
    for (var i = 2; i < s.length; i++) {
      if (s.charCodeAt(i) - s.charCodeAt(i - 1) !== step) return false;
    }
    return true;
  }

  function isPalindrome(n, minLength) {
    var s = digits(n);
    if (s.length < (minLength || 3)) return false;
    return s === s.split('').reverse().join('');
  }

  // «круглое»: заканчивается минимум на minZeros нулей (по умолчанию 2: 300, 2500, 10000)
  function isRound(n, minLength, minZeros) {
    var s = digits(n);
    if (s.length < (minLength || 3)) return false;
    var z = minZeros || 2;
    return n % Math.pow(10, z) === 0;
  }

  /* ---------- правила ---------- */

  function ruleMatches(rule, n) {
    switch (rule.type) {
      case 'exact': return rule.values.indexOf(n) !== -1;
      case 'repdigit': return isRepdigit(n, rule.minLength);
      case 'sequence': return isSequence(n, rule.minLength);
      case 'palindrome': return isPalindrome(n, rule.minLength);
      case 'round': return isRound(n, rule.minLength, rule.minZeros);
      case 'regex': return rule._re ? rule._re.test(digits(n)) : false;
      default: return false;
    }
  }

  /**
   * Первое подходящее правило (порядок в конфиге = приоритет).
   * Возвращает { rule, style } или null. Суммы с копейками и отрицательные не украшаем.
   */
  function classify(amount, config) {
    if (!config || !config.enabled) return null;
    if (typeof amount !== 'number' || !isFinite(amount)) return null;
    if (amount <= 0 || Math.floor(amount) !== amount) return null;
    var rules = config.rules || [];
    for (var i = 0; i < rules.length; i++) {
      var r = rules[i];
      if (ruleMatches(r, amount)) return { rule: r, style: config.styles[r.style] };
    }
    return null;
  }

  /** Ближайшее красивое число сверху среди правил с hintable:true (для мягкой подсказки). */
  function findNext(amount, config) {
    if (!config || !config.enabled || !config.hint || !config.hint.enabled) return null;
    if (Math.floor(amount) !== amount || amount < 0) return null;
    var maxGap = config.hint.maxGap || 100;
    for (var gap = 1; gap <= maxGap; gap++) {
      var hit = classify(amount + gap, config);
      if (hit && hit.rule.hintable) return { value: amount + gap, gap: gap, rule: hit.rule };
    }
    return null;
  }

  /** Какие этапы цели (в процентах) пересечены при переходе prev → next. */
  function crossedMilestones(prev, next, goal, percents) {
    if (!goal || goal <= 0 || next <= prev) return [];
    var out = [];
    (percents || []).forEach(function (p) {
      var mark = goal * p / 100;
      if (prev < mark && next >= mark) out.push(p);
    });
    return out;
  }

  /* ---------- сезоны ---------- */

  function mmdd(date) {
    var m = date.getMonth() + 1, d = date.getDate();
    return (m < 10 ? '0' : '') + m + '-' + (d < 10 ? '0' : '') + d;
  }

  /** Активный сезон на дату. Поддерживает интервалы через Новый год (12-01 … 02-28). */
  function activeSeason(config, date) {
    if (!config || !config.seasons) return null;
    var today = mmdd(date || new Date());
    for (var i = 0; i < config.seasons.length; i++) {
      var s = config.seasons[i];
      var inRange = s.from <= s.to
        ? (today >= s.from && today <= s.to)
        : (today >= s.from || today <= s.to);
      if (inRange) return s;
    }
    return null;
  }

  /* ---------- валидация конфига ---------- */
  /*
   * Требование брифа: «пустой или битый конфиг не должен ломать приложение».
   * Невалидные правила отбрасываются по одному, остальные продолжают работать.
   * Если сломано всё — возвращаем { enabled:false }, и приложение просто живёт без эффектов.
   */
  function sanitize(raw) {
    var warnings = [];
    var OFF = { enabled: false, rules: [], styles: {}, seasons: [], warnings: warnings };
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      warnings.push('Конфиг пустой или не объект — эффекты выключены');
      return OFF;
    }
    var cfg = {
      version: raw.version || 1,
      enabled: raw.enabled !== false,
      maxEffectMs: clampNum(raw.maxEffectMs, 300, 3000, 1800),
      autoMode: raw.autoMode === 'off' || raw.autoMode === 'full' ? raw.autoMode : 'hint',
      autoOnTopup: raw.autoOnTopup === 'off' || raw.autoOnTopup === 'hint' ? raw.autoOnTopup : 'full',
      tapHint: typeof raw.tapHint === 'string' ? raw.tapHint : '',
      hint: null,
      styles: {},
      rules: [],
      milestones: null,
      topup: { enabled: !!(raw.topup && raw.topup.enabled !== false), effect: 'coinDrop' },
      seasons: [],
      warnings: warnings
    };

    if (raw.hint && typeof raw.hint === 'object') {
      cfg.hint = {
        enabled: raw.hint.enabled !== false,
        maxGap: clampNum(raw.hint.maxGap, 1, 1000, 100),
        text: typeof raw.hint.text === 'string' ? raw.hint.text : 'До красивого числа осталось {gap} ₽'
      };
    }

    var styles = raw.styles && typeof raw.styles === 'object' ? raw.styles : {};
    Object.keys(styles).forEach(function (k) {
      var s = styles[k];
      if (s && typeof s === 'object' && typeof s.pattern === 'string') cfg.styles[k] = s;
      else warnings.push('Стиль «' + k + '» пропущен: нет pattern');
    });

    (Array.isArray(raw.rules) ? raw.rules : []).forEach(function (r, i) {
      var name = (r && r.id) || ('#' + i);
      if (!r || typeof r !== 'object') { warnings.push('Правило ' + name + ' пропущено: не объект'); return; }
      if (r.enabled === false) return; // правило выключено контент-менеджером — молча пропускаем
      if (KNOWN_TYPES.indexOf(r.type) === -1) { warnings.push('Правило ' + name + ': неизвестный тип «' + r.type + '»'); return; }
      if (!cfg.styles[r.style]) { warnings.push('Правило ' + name + ': нет стиля «' + r.style + '»'); return; }
      var rule = {
        id: String(name),
        type: r.type,
        style: r.style,
        hintable: !!r.hintable,
        badge: typeof r.badge === 'string' ? r.badge : '',
        minLength: clampNum(r.minLength, 1, 12, 3),
        minZeros: clampNum(r.minZeros, 1, 9, 2),
        effects: (Array.isArray(r.effects) ? r.effects : []).filter(function (e) { return KNOWN_EFFECTS.indexOf(e) !== -1; })
      };
      if (!rule.effects.length) rule.effects = ['sparkles'];
      if (r.type === 'exact') {
        rule.values = (Array.isArray(r.values) ? r.values : []).filter(function (v) { return typeof v === 'number'; });
        if (!rule.values.length) { warnings.push('Правило ' + name + ': пустой список values'); return; }
      }
      if (r.type === 'regex') {
        try { rule._re = new RegExp(r.pattern); rule.pattern = r.pattern; }
        catch (e) { warnings.push('Правило ' + name + ': некорректный pattern'); return; }
      }
      cfg.rules.push(rule);
    });

    if (raw.milestones && raw.milestones.enabled !== false) {
      cfg.milestones = {
        enabled: true,
        percents: (Array.isArray(raw.milestones.percents) ? raw.milestones.percents : [50, 100])
          .filter(function (p) { return typeof p === 'number' && p > 0 && p <= 100; }),
        effects: (raw.milestones.effects || ['confetti']).filter(function (e) { return KNOWN_EFFECTS.indexOf(e) !== -1; }),
        texts: raw.milestones.texts && typeof raw.milestones.texts === 'object' ? raw.milestones.texts : {}
      };
    }

    (Array.isArray(raw.seasons) ? raw.seasons : []).forEach(function (s) {
      if (s && /^\d\d-\d\d$/.test(s.from) && /^\d\d-\d\d$/.test(s.to)) cfg.seasons.push(s);
      else warnings.push('Сезон пропущен: даты должны быть в формате MM-DD');
    });

    if (!cfg.rules.length) warnings.push('Нет ни одного рабочего правила');
    return cfg;
  }

  function clampNum(v, min, max, def) {
    if (typeof v !== 'number' || !isFinite(v)) return def;
    return Math.min(max, Math.max(min, v));
  }

  function fillTemplate(tpl, vars) {
    return String(tpl || '').replace(/\{(\w+)\}/g, function (_, k) {
      return vars[k] !== undefined ? vars[k] : '';
    });
  }

  function formatRub(n) {
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' ₽';
  }

  var api = {
    isRepdigit: isRepdigit,
    isSequence: isSequence,
    isPalindrome: isPalindrome,
    isRound: isRound,
    classify: classify,
    findNext: findNext,
    crossedMilestones: crossedMilestones,
    activeSeason: activeSeason,
    sanitize: sanitize,
    fillTemplate: fillTemplate,
    formatRub: formatRub
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.KB = root.KB || {}; root.KB.engine = api; }
})(this);
