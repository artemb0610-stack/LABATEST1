# Копилка: красивые числа — iOS (SwiftUI)

Нативный прототип для трека «Приколы». iOS 17+, только SwiftUI, без сторонних библиотек.

## Как запустить на iPhone

1. На Mac установить Xcode (App Store).
2. Открыть файл `ios/Kopilka.swiftpm` двойным кликом. Он откроется в Xcode.
3. Подключить iPhone кабелем. В строке сверху выбрать свой iPhone.
4. Слева выбрать проект → вкладка **Signing & Capabilities** → **Team** = свой Apple ID (Add Account…).
5. Нажать ▶︎ Run.
6. На iPhone при первом запуске: **Настройки → Основные → VPN и управление устройством** → доверять разработчику. В iOS 16+ ещё нужно включить **Настройки → Конфиденциальность → Режим разработчика**.

## Что где

| Папка | Что внутри |
| --- | --- |
| `Engine/` | Движок красивых чисел (чистые функции), модели конфига с проверкой, загрузка конфига из CMS с кэшем |
| `PrettyNumberKit/` | **Оформление цифр как набор `ViewModifier`**: `BanknoteDigit`, `CubeDigit`, `MirrorDigit`, `PulseZeroDigit`, `GuillocheContainer`, `ShimmerContainer`, `MirrorContainer`, `StrictContainer`, `TintContainer`. Токены дизайн-системы (шрифты, цвета, радиус) — через `.prettyNumberTokens(...)` |
| `Effects/` | Слой эффектов (Canvas, 60 кадров/с): конфетти, серпантин, салют, монеты, радужная волна, плашки, вибрация, звук, встряхивание |
| `Screens/` | Главный, Копилки, Копилка, Пополнение, История (эффект скорости + планета), Оформление цифр, Демо-панель |
| `DesignSystem/` | Токены, снятые с макетов СберKids |
| `Resources/effects.json` | Встроенная копия конфига (работает без сети) |

## Всё — модификаторами

| Что | Модификатор |
| --- | --- |
| Оформление суммы целиком по стилю из CMS | `.prettyNumber(spec)` |
| Оформление одной цифры | `.prettyDigit(spec, ctx)` или напрямую `BanknoteDigit`, `CubeDigit`, `MirrorDigit`, `PulseZeroDigit` |
| Контейнер суммы | `GuillocheContainer`, `ShimmerContainer`, `MirrorContainer`, `StrictContainer`, `TintContainer` |
| Токены дизайн-системы (шрифты, цвета, радиус) | `.prettyNumberTokens(tokens)` |
| Эффект скорости при сильной прокрутке | `.scrollSpeedEffect(config.scrollFx)` на любой `ScrollView` |
| Слой праздничных эффектов и плашек | `.effectsOverlay(fx)` на корень приложения |

## Встраивание в дизайн-систему

```swift
// Любой свой Text — отдельным модификатором с токенами дизайн-системы
Text("5 000").modifier(GuillocheContainer(color: ds.banknote5000, accent: ds.banknote5000Light))

// Сумма целиком по стилю из CMS
AmountDigits(value: 1234, spec: style)
    .prettyNumberTokens(sberTokens)   // SB Sans, палитра, радиусы — из дизайн-системы
```

Android: те же модификаторы ложатся на Jetpack Compose `Modifier` (`Modifier.guilloche(...)`, `Modifier.cube(...)`), движок переносится на Kotlin строка в строку.

## Без релиза

Приложение берёт `config/effects.json` из репозитория (в продукте — JSON по ключу CMS), кэширует его и работает со встроенной копией без сети. Правка файла на GitHub → при следующем запуске или по кнопке «Загрузить свежий конфиг» в демо-панели (⚙︎) приложение подхватит новые правила.
