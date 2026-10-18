import SwiftUI

// MARK: - Сырой конфиг (как лежит в CMS / config/effects.json)
// Все поля необязательные: битое или пропущенное поле не роняет приложение,
// а превращается в безопасное значение по умолчанию при санитайзинге (см. PrettyConfig.sanitize).

struct RawConfig: Codable, Equatable {
    var version: Int?
    var enabled: Bool?
    var maxEffectMs: Double?
    var autoMode: String?
    var autoOnTopup: String?
    var tapHint: String?
    var themes: LossyArray<RawTheme>?
    var styles: [String: RawStyle]?
    var rules: LossyArray<RawRule>?
    var milestones: RawMilestones?
    var topup: RawTopup?
    var scrollFx: RawScrollFx?
    var seasons: LossyArray<RawSeason>?
}

struct RawTheme: Codable, Equatable { var id: String; var title: String; var style: String?; var desc: String? }
struct RawStyle: Codable, Equatable { var pattern: String; var color: String?; var accent: String?; var palette: [String]? }
struct RawRule: Codable, Equatable {
    var id: String?
    var type: String
    var values: [Int]?
    var minLength: Int?
    var minZeros: Int?
    var pattern: String?
    var style: String
    var badge: String?
    var effects: [String]?
    var enabled: Bool?
}
struct RawMilestones: Codable, Equatable { var enabled: Bool?; var percents: [Int]?; var effects: [String]?; var texts: [String: String]? }
struct RawTopup: Codable, Equatable { var enabled: Bool?; var effect: String? }
struct RawScrollFx: Codable, Equatable {
    var enabled: Bool?; var screens: [String]?; var minSpeed: Double?; var lightning: Bool?; var lightningSpeed: Double?
    var down: [String]?; var up: [String]?; var boltCore: String?; var boltGlow: String?
}
struct RawSeason: Codable, Equatable { var id: String; var title: String?; var from: String; var to: String; var particles: String?; var badgePrefix: String? }

/// Массив, который пропускает битые элементы вместо того, чтобы ронять весь конфиг.
struct LossyArray<T: Codable & Equatable>: Codable, Equatable {
    var items: [T]
    var skipped: Int = 0

    init(_ items: [T]) { self.items = items }

    init(from decoder: Decoder) throws {
        var c = try decoder.unkeyedContainer()
        var out: [T] = []
        var bad = 0
        while !c.isAtEnd {
            if let v = try? c.decode(T.self) { out.append(v) } else { _ = try? c.decode(AnyDecodable.self); bad += 1 }
        }
        items = out; skipped = bad
    }
    func encode(to encoder: Encoder) throws {
        var c = encoder.unkeyedContainer()
        for i in items { try c.encode(i) }
    }
    static func == (a: Self, b: Self) -> Bool { a.items == b.items }
}
private struct AnyDecodable: Decodable { init(from decoder: Decoder) throws {} }

// MARK: - Рабочий конфиг (после проверки)

enum EffectKind: String, CaseIterable {
    case coins, confetti, sparkles, streamers, fireworks, burst, leaves, snow, coinDrop
}

enum DigitPattern: String {
    case guilloche, glow, blocks, mirror, bold, strict
}

struct PrettyStyleSpec: Equatable {
    var pattern: DigitPattern
    var color: Color
    var accent: Color
    var palette: [Color]
}

enum RuleType: String { case exact, repdigit, sequence, palindrome, round, regex }

struct PrettyRule: Identifiable {
    var id: String
    var type: RuleType
    var values: [Int]
    var minLength: Int
    var minZeros: Int
    var regex: NSRegularExpression?
    var styleKey: String
    var badge: String
    var effects: [EffectKind]
}

struct Theme: Identifiable, Equatable { var id: String; var title: String; var styleKey: String?; var desc: String }
struct Season: Equatable { var id: String; var from: String; var to: String; var particles: EffectKind?; var badgePrefix: String }

struct ScrollFxConfig {
    var enabled = false
    var minSpeed: Double = 2.4      // pt/мс, сглаженная скорость
    var lightning = true
    var lightningSpeed: Double = 4.2
    var down: [Color] = [Color(hex: "#3ddc84"), Color(hex: "#2ec4f1")]
    var up: [Color] = [Color(hex: "#a66cff"), Color(hex: "#ff5fa2")]
    var boltCore = Color(hex: "#d9ffb0")
    var boltGlow = Color(hex: "#3ddc84")
}

struct PrettyConfig {
    var enabled = false
    var maxEffect: Double = 1.8           // секунды
    var autoMode = "hint"                 // off | hint | full
    var autoOnTopup = "full"
    var tapHint = ""
    var styles: [String: PrettyStyleSpec] = [:]
    var rules: [PrettyRule] = []
    var themes: [Theme] = []
    var milestonesEnabled = false
    var milestonePercents: [Int] = []
    var milestoneEffects: [EffectKind] = [.confetti]
    var milestoneTexts: [String: String] = [:]
    var topupEnabled = true
    var scrollFx = ScrollFxConfig()
    var seasons: [Season] = []
    var warnings: [String] = []

    static let off = PrettyConfig(warnings: ["Конфиг пустой или битый — эффекты выключены"])

    /// Требование брифа: «пустой или битый конфиг не должен ломать приложение».
    /// Невалидные части отбрасываются по одной, остальное продолжает работать.
    static func sanitize(_ raw: RawConfig?) -> PrettyConfig {
        guard let raw else { return .off }
        var c = PrettyConfig()
        var w: [String] = []
        c.enabled = raw.enabled ?? true
        c.maxEffect = clamp(raw.maxEffectMs ?? 1800, 300, 3000) / 1000
        c.autoMode = ["off", "hint", "full"].contains(raw.autoMode ?? "") ? raw.autoMode! : "hint"
        c.autoOnTopup = ["off", "hint", "full"].contains(raw.autoOnTopup ?? "") ? raw.autoOnTopup! : "full"
        c.tapHint = raw.tapHint ?? ""

        for (key, s) in raw.styles ?? [:] {
            guard let p = DigitPattern(rawValue: s.pattern) else { w.append("Стиль «\(key)»: неизвестный pattern"); continue }
            c.styles[key] = PrettyStyleSpec(pattern: p,
                                            color: Color(hex: s.color ?? "#1f2329"),
                                            accent: Color(hex: s.accent ?? "#f2f4f7"),
                                            palette: (s.palette ?? []).map { Color(hex: $0) })
        }

        if let lossy = raw.rules, lossy.skipped > 0 { w.append("Пропущено битых правил: \(lossy.skipped)") }
        for (i, r) in (raw.rules?.items ?? []).enumerated() {
            let name = r.id ?? "#\(i)"
            if r.enabled == false { continue }  // выключено контент-менеджером
            guard let t = RuleType(rawValue: r.type) else { w.append("Правило \(name): неизвестный тип «\(r.type)»"); continue }
            guard c.styles[r.style] != nil else { w.append("Правило \(name): нет стиля «\(r.style)»"); continue }
            var rule = PrettyRule(id: name, type: t, values: r.values ?? [],
                                  minLength: Int(clamp(Double(r.minLength ?? 3), 1, 12)),
                                  minZeros: Int(clamp(Double(r.minZeros ?? 2), 1, 9)),
                                  regex: nil, styleKey: r.style, badge: r.badge ?? "",
                                  effects: (r.effects ?? []).compactMap(EffectKind.init(rawValue:)))
            if rule.effects.isEmpty { rule.effects = [.sparkles] }
            if t == .exact && rule.values.isEmpty { w.append("Правило \(name): пустой список values"); continue }
            if t == .regex {
                guard let p = r.pattern, let re = try? NSRegularExpression(pattern: p) else { w.append("Правило \(name): некорректный pattern"); continue }
                rule.regex = re
            }
            c.rules.append(rule)
        }

        for t in raw.themes?.items ?? [] {
            if t.id != "auto", c.styles[t.style ?? ""] == nil { w.append("Оформление «\(t.title)»: нет стиля"); continue }
            c.themes.append(Theme(id: t.id, title: t.title, styleKey: t.id == "auto" ? nil : t.style, desc: t.desc ?? ""))
        }
        if !c.themes.contains(where: { $0.id == "auto" }) { c.themes.insert(Theme(id: "auto", title: "Авто", styleKey: nil, desc: ""), at: 0) }

        if let m = raw.milestones, m.enabled != false {
            c.milestonesEnabled = true
            c.milestonePercents = (m.percents ?? [50, 100]).filter { $0 > 0 && $0 <= 100 }
            let fx = (m.effects ?? []).compactMap(EffectKind.init(rawValue:))
            c.milestoneEffects = fx.isEmpty ? [.confetti] : fx
            c.milestoneTexts = m.texts ?? [:]
        }
        c.topupEnabled = raw.topup?.enabled ?? true

        if let s = raw.scrollFx {
            var f = ScrollFxConfig()
            f.enabled = s.enabled ?? true
            f.minSpeed = clamp(s.minSpeed ?? 2.4, 0.3, 10)
            f.lightning = s.lightning ?? true
            f.lightningSpeed = clamp(s.lightningSpeed ?? 4.2, 0.5, 20)
            let d = (s.down ?? []).filter(isHex).map { Color(hex: $0) }; if !d.isEmpty { f.down = d }
            let u = (s.up ?? []).filter(isHex).map { Color(hex: $0) }; if !u.isEmpty { f.up = u }
            if let b = s.boltCore, isHex(b) { f.boltCore = Color(hex: b) }
            if let b = s.boltGlow, isHex(b) { f.boltGlow = Color(hex: b) }
            c.scrollFx = f
        }

        for s in raw.seasons?.items ?? [] {
            guard isMMDD(s.from), isMMDD(s.to) else { w.append("Сезон «\(s.id)»: даты должны быть в формате MM-DD"); continue }
            c.seasons.append(Season(id: s.id, from: s.from, to: s.to,
                                    particles: EffectKind(rawValue: s.particles ?? ""), badgePrefix: s.badgePrefix ?? ""))
        }

        if c.rules.isEmpty { w.append("Нет ни одного рабочего правила") }
        c.warnings = w
        return c
    }
}

// MARK: - Помощники

func clamp(_ v: Double, _ lo: Double, _ hi: Double) -> Double { min(hi, max(lo, v)) }
private func isHex(_ s: String) -> Bool { s.range(of: "^#[0-9a-fA-F]{3,8}$", options: .regularExpression) != nil }
private func isMMDD(_ s: String) -> Bool { s.range(of: "^\\d\\d-\\d\\d$", options: .regularExpression) != nil }

extension Color {
    /// #rgb, #rrggbb или #rrggbbaa. Мусор → серый, а не падение.
    init(hex: String) {
        var s = hex.trimmingCharacters(in: .whitespaces)
        if s.hasPrefix("#") { s.removeFirst() }
        if s.count == 3 { s = s.map { "\($0)\($0)" }.joined() }
        var v: UInt64 = 0
        guard (s.count == 6 || s.count == 8), Scanner(string: s).scanHexInt64(&v) else {
            self = Color(red: 0.6, green: 0.6, blue: 0.6); return
        }
        let r, g, b, a: Double
        if s.count == 8 {
            r = Double((v >> 24) & 0xff) / 255; g = Double((v >> 16) & 0xff) / 255
            b = Double((v >> 8) & 0xff) / 255; a = Double(v & 0xff) / 255
        } else {
            r = Double((v >> 16) & 0xff) / 255; g = Double((v >> 8) & 0xff) / 255
            b = Double(v & 0xff) / 255; a = 1
        }
        self = Color(.sRGB, red: r, green: g, blue: b, opacity: a)
    }
}
