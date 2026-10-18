# Копирует config/effects.json в iOS-приложение: в ресурсы и во вшитую копию.
# Запуск из корня репозитория: python3 tools/build-ios-config.py
import shutil, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
src = root / 'config' / 'effects.json'
app = root / 'ios' / 'Kopilka.swiftpm'
shutil.copy(src, app / 'Resources' / 'effects.json')
raw = src.read_text(encoding='utf-8').rstrip('\n')
(app / 'Engine' / 'EmbeddedConfig.swift').write_text(
    '// Сгенерировано из config/effects.json — запасная копия, если ресурсы не подключились.\n'
    '// Обновление: python3 tools/build-ios-config.py\n\nenum EmbeddedConfig {\n    static let json = #"""\n'
    + raw + '\n"""#\n}\n', encoding='utf-8')
print('✓ iOS: Resources/effects.json и EmbeddedConfig.swift обновлены')
