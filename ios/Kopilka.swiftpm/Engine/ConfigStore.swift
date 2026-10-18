import Foundation

/// Загрузка конфига «без релиза».
/// Порядок: кэш на устройстве → встроенная копия (сразу, без ожидания сети) → свежий из CMS в фоне.
/// В СберKids вместо URL — существующий механизм «JSON по именованному ключу CMS».
enum ConfigStore {
    /// Тот же файл, что использует веб-версия. Правка на GitHub = правка «в CMS».
    static let remoteURL = URL(string: "https://raw.githubusercontent.com/artemb0610-stack/LABATEST1/main/config/effects.json")!

    private static var cacheURL: URL {
        FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0].appendingPathComponent("effects.json")
    }

    static func decode(_ data: Data) -> RawConfig? {
        try? JSONDecoder().decode(RawConfig.self, from: data)
    }

    static func encode(_ raw: RawConfig) -> String {
        let e = JSONEncoder()
        e.outputFormatting = [.prettyPrinted, .sortedKeys, .withoutEscapingSlashes]
        guard let d = try? e.encode(raw), let s = String(data: d, encoding: .utf8) else { return "" }
        return s
    }

    /// Мгновенно: кэш или встроенная копия. Никогда не бросает.
    static func loadLocal() -> RawConfig? {
        if let d = try? Data(contentsOf: cacheURL), let r = decode(d) { return r }
        return bundled()
    }

    /// Встроенный конфиг: файл в ресурсах приложения, а если его не нашли — копия, вшитая в код.
    static func bundled() -> RawConfig? {
        var bundles = [Bundle.main] + Bundle.allBundles
        for u in Bundle.main.urls(forResourcesWithExtension: "bundle", subdirectory: nil) ?? [] {
            if let b = Bundle(url: u) { bundles.append(b) }
        }
        for b in bundles {
            if let url = b.url(forResource: "effects", withExtension: "json"),
               let d = try? Data(contentsOf: url), let r = decode(d) { return r }
        }
        return decode(Data(EmbeddedConfig.json.utf8))
    }

    /// Свежий конфиг из сети с таймаутом 4 с. Ошибка сети или битый файл → nil (остаёмся на текущем).
    static func fetchRemote() async -> RawConfig? {
        var req = URLRequest(url: remoteURL, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 4)
        req.setValue("no-cache", forHTTPHeaderField: "Cache-Control")
        guard let result = try? await URLSession.shared.data(for: req),
              (result.1 as? HTTPURLResponse)?.statusCode == 200,
              let raw = decode(result.0) else { return nil }
        let data = result.0
        try? data.write(to: cacheURL, options: .atomic)
        return raw
    }
}
