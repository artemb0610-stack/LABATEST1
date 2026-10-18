// Сгенерировано из config/effects.json командой: node tools/build-default.js — не править руками.
this.KB = this.KB || {};
this.KB.DEFAULT_CONFIG = {
  "version": 1,
  "enabled": true,
  "maxEffectMs": 1800,
  "autoMode": "hint",
  "autoOnTopup": "full",
  "tapHint": "Нажми на цифры ✨",
  "themes": [
    {
      "id": "auto",
      "title": "Авто",
      "desc": "Своё оформление для каждого красивого числа"
    },
    {
      "id": "strict",
      "title": "Строгий",
      "style": "strict",
      "desc": "Чёрные цифры, без украшений"
    },
    {
      "id": "banknote",
      "title": "Купюра",
      "style": "banknote-1000",
      "desc": "Как на денежной купюре"
    },
    {
      "id": "cubes",
      "title": "Кубики",
      "style": "counting",
      "desc": "Цифры как кубики для счёта"
    },
    {
      "id": "shimmer",
      "title": "Переливы",
      "style": "same-digits",
      "desc": "Мягкий перелив цвета"
    },
    {
      "id": "mirror",
      "title": "Зеркало",
      "style": "mirror",
      "desc": "Цветные пары цифр"
    },
    {
      "id": "green",
      "title": "Зелёный",
      "style": "round",
      "desc": "В цветах приложения"
    }
  ],
  "styles": {
    "strict": {
      "pattern": "strict",
      "color": "#0d0d0d",
      "accent": "#e8ebef"
    },
    "banknote-100": {
      "pattern": "guilloche",
      "color": "#7a4a22",
      "accent": "#e2c49a"
    },
    "banknote-500": {
      "pattern": "guilloche",
      "color": "#5b3a8c",
      "accent": "#cdb8ea"
    },
    "banknote-1000": {
      "pattern": "guilloche",
      "color": "#0f6b6b",
      "accent": "#9fdcd2"
    },
    "banknote-2000": {
      "pattern": "guilloche",
      "color": "#1d4f96",
      "accent": "#a9c6ef"
    },
    "banknote-5000": {
      "pattern": "guilloche",
      "color": "#a3361f",
      "accent": "#f3b79a"
    },
    "same-digits": {
      "pattern": "glow",
      "color": "#4b4fb8",
      "accent": "#8fb4f2"
    },
    "counting": {
      "pattern": "blocks",
      "color": "#1f2329",
      "accent": "#f4f6f9",
      "palette": [
        "#e8655f",
        "#e8933a",
        "#3faa62",
        "#3f8fd8",
        "#8a6fd6",
        "#d0588f"
      ]
    },
    "mirror": {
      "pattern": "mirror",
      "color": "#2f6f86",
      "accent": "#f1f7f9",
      "palette": [
        "#2f6f86",
        "#c46a3c",
        "#6f5bc4",
        "#3f8f5f",
        "#b0507a"
      ]
    },
    "round": {
      "pattern": "bold",
      "color": "#2bb24c",
      "accent": "#eef9ec"
    }
  },
  "rules": [
    {
      "id": "bn-5000",
      "type": "exact",
      "values": [
        5000
      ],
      "style": "banknote-5000",
      "badge": "Как купюра в 5 000 ₽!",
      "effects": [
        "fireworks",
        "coins",
        "confetti"
      ]
    },
    {
      "id": "bn-2000",
      "type": "exact",
      "values": [
        2000
      ],
      "style": "banknote-2000",
      "badge": "Как купюра в 2 000 ₽!",
      "effects": [
        "fireworks",
        "coins",
        "confetti"
      ]
    },
    {
      "id": "bn-1000",
      "type": "exact",
      "values": [
        1000
      ],
      "style": "banknote-1000",
      "badge": "Как купюра в 1 000 ₽!",
      "effects": [
        "coins",
        "confetti",
        "fireworks"
      ]
    },
    {
      "id": "bn-500",
      "type": "exact",
      "values": [
        500
      ],
      "style": "banknote-500",
      "badge": "Как купюра в 500 ₽!",
      "effects": [
        "coins",
        "streamers",
        "confetti"
      ]
    },
    {
      "id": "bn-100",
      "type": "exact",
      "values": [
        100
      ],
      "style": "banknote-100",
      "badge": "Как купюра в 100 ₽!",
      "effects": [
        "coins",
        "streamers",
        "sparkles"
      ]
    },
    {
      "id": "same",
      "type": "repdigit",
      "minLength": 3,
      "style": "same-digits",
      "badge": "Все цифры одинаковые!",
      "effects": [
        "fireworks",
        "streamers",
        "confetti"
      ]
    },
    {
      "id": "stairs",
      "type": "sequence",
      "minLength": 3,
      "style": "counting",
      "badge": "Цифры по порядку — как при счёте!",
      "effects": [
        "confetti",
        "streamers",
        "fireworks"
      ]
    },
    {
      "id": "mirror",
      "type": "palindrome",
      "minLength": 3,
      "style": "mirror",
      "badge": "Число-зеркало: читается с двух сторон!",
      "effects": [
        "sparkles",
        "streamers",
        "confetti"
      ]
    },
    {
      "id": "pairs",
      "type": "regex",
      "pattern": "^(\\d\\d)\\1+$",
      "style": "same-digits",
      "badge": "Повторяющиеся пары цифр!",
      "effects": [
        "sparkles",
        "confetti",
        "streamers"
      ]
    },
    {
      "id": "round",
      "type": "round",
      "minLength": 3,
      "minZeros": 2,
      "style": "round",
      "badge": "Круглое число!",
      "effects": [
        "coins",
        "confetti",
        "streamers"
      ]
    }
  ],
  "milestones": {
    "enabled": true,
    "percents": [
      25,
      50,
      75,
      100
    ],
    "effects": [
      "fireworks",
      "confetti",
      "streamers"
    ],
    "texts": {
      "25": "Четверть пути к цели пройдена!",
      "50": "Половина пути! Так держать",
      "75": "Осталось совсем чуть-чуть",
      "100": "Цель накоплена: {goal}! 🎉"
    }
  },
  "topup": {
    "enabled": true,
    "effect": "coinDrop"
  },
  "seasons": [
    {
      "id": "autumn",
      "title": "Осень",
      "from": "09-01",
      "to": "11-30",
      "particles": "leaves",
      "badgePrefix": "🍂"
    },
    {
      "id": "winter",
      "title": "Зима",
      "from": "12-01",
      "to": "02-28",
      "particles": "snow",
      "badgePrefix": "❄️"
    }
  ]
};
