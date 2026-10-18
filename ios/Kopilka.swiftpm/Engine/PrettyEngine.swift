import Foundation

/// Движок «красивых чисел»: чистые функции без UI. Это та часть, которая одинакова
/// на iOS (Swift) и Android (Kotlin) и покрывается юнит-тестами.
enum PrettyEngine {

    struct Hit { let rule: PrettyRule; let style: PrettyStyleSpec }

    /// Первое подходящее правило (порядок в конфиге = приоритет). Копейки, ноль и минус не украшаем.
    static func classify(_ amount: Int, _ cfg: PrettyConfig) -> Hit? {
        guard cfg.enabled, amount > 0 else { return nil }
        for r in cfg.rules where matches(r, amount) {
            if let s = cfg.styles[r.styleKey] { return Hit(rule: r, style: s) }
        }
        return nil
    }

    static func matches(_ r: PrettyRule, _ n: Int) -> Bool {
        switch r.type {
        case .exact: return r.values.contains(n)
        case .repdigit: return isRepdigit(n, r.minLength)
        case .sequence: return isSequence(n, r.minLength)
        case .palindrome: return isPalindrome(n, r.minLength)
        case .round: return isRound(n, r.minLength, r.minZeros)
        case .regex:
            guard let re = r.regex else { return false }
            let s = String(n)
            return re.firstMatch(in: s, range: NSRange(s.startIndex..., in: s)) != nil
        }
    }

    static func isRepdigit(_ n: Int, _ minLen: Int) -> Bool {
        let d = Array(String(n)); return d.count >= minLen && d.allSatisfy { $0 == d[0] }
    }

    /// 123, 1234, 6789 и обратные 4321, 987
    static func isSequence(_ n: Int, _ minLen: Int) -> Bool {
        let d = String(n).compactMap { $0.wholeNumberValue }
        guard d.count >= max(minLen, 2) else { return false }
        let step = d[1] - d[0]
        guard step == 1 || step == -1 else { return false }
        for i in 2..<d.count where d[i] - d[i - 1] != step { return false }
        return true
    }

    static func isPalindrome(_ n: Int, _ minLen: Int) -> Bool {
        let s = String(n); return s.count >= minLen && s == String(s.reversed())
    }

    static func isRound(_ n: Int, _ minLen: Int, _ zeros: Int) -> Bool {
        var p = 1; for _ in 0..<zeros { p *= 10 }
        return String(n).count >= minLen && n % p == 0
    }

    /// Какие этапы цели (в процентах) пересечены при переходе from → to.
    static func crossedMilestones(from: Int, to: Int, goal: Int, percents: [Int]) -> [Int] {
        guard goal > 0, to > from else { return [] }
        return percents.filter { p in
            let mark = Double(goal) * Double(p) / 100
            return Double(from) < mark && Double(to) >= mark
        }
    }

    /// Активный сезон на дату. Поддерживает интервалы через Новый год (12-01 … 02-28).
    static func activeSeason(_ cfg: PrettyConfig, _ date: Date = Date()) -> Season? {
        let c = Calendar.current.dateComponents([.month, .day], from: date)
        let today = String(format: "%02d-%02d", c.month ?? 1, c.day ?? 1)
        return cfg.seasons.first { s in
            s.from <= s.to ? (today >= s.from && today <= s.to) : (today >= s.from || today <= s.to)
        }
    }

    static func fill(_ template: String, _ vars: [String: String]) -> String {
        var out = template
        for (k, v) in vars { out = out.replacingOccurrences(of: "{\(k)}", with: v) }
        return out
    }
}

enum Rub {
    /// 12345 → «12 345 ₽» (узкий пробел между разрядами, неразрывный перед ₽)
    static func format(_ n: Int) -> String { group(n) + "\u{00A0}₽" }
    static func group(_ n: Int) -> String {
        let s = String(abs(n))
        var out = ""
        for (i, ch) in s.enumerated() {
            if i > 0 && (s.count - i) % 3 == 0 { out.append("\u{2009}") }
            out.append(ch)
        }
        return (n < 0 ? "−" : "") + out
    }
}
