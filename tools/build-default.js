// Пересобирает js/default-config.js из config/effects.json.
// Встроенная копия нужна, чтобы прототип работал даже открытым как файл (без сервера) и без сети.
// Запуск: node tools/build-default.js
'use strict';
var fs = require('fs');
var path = require('path');
var src = path.join(__dirname, '../config/effects.json');
var out = path.join(__dirname, '../js/default-config.js');
var json = JSON.parse(fs.readFileSync(src, 'utf8'));
fs.writeFileSync(out,
  '// Сгенерировано из config/effects.json командой: node tools/build-default.js — не править руками.\n' +
  'this.KB = this.KB || {};\nthis.KB.DEFAULT_CONFIG = ' + JSON.stringify(json, null, 2) + ';\n');
console.log('✓ js/default-config.js обновлён');
