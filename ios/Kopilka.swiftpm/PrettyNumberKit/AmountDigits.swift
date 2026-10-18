import SwiftUI

/// Сумма, собранная из отдельных цифр, чтобы каждой можно было дать свой модификатор
/// (кубики, зеркало) и свою анимацию (перекатывание, подпрыгивание).
struct AmountDigits: View {
    let value: Int
    var spec: PrettyStyleSpec?
    var size: CGFloat = 52
    /// Меняется → праздник: цифры перекатываются, как на счётчике, и по очереди подпрыгивают.
    var partyTick: Int = 0

    @Environment(\.prettyNumberTokens) private var t
    @State private var rolling: [Int: Character] = [:]
    @State private var hop: Set<Int> = []

    private var chars: [Character] { Array(String(value)) }

    /// Длинные суммы уменьшаем, чтобы не вылезали за карточку.
    private var k: CGFloat {
        switch chars.count { case ...5: 1; case 6: 0.88; case 7: 0.78; case 8: 0.7; default: 0.62 }
    }

    var body: some View {
        let fs = size * k
        let digits = chars
        HStack(alignment: .firstTextBaseline, spacing: 0) {
            HStack(alignment: .firstTextBaseline, spacing: spec?.pattern == .blocks ? 4 * k : 0) {
                ForEach(Array(digits.enumerated()), id: \.offset) { i, ch in
                    if i > 0 && (digits.count - i) % 3 == 0 && spec?.pattern != .blocks && spec?.pattern != .mirror {
                        Spacer().frame(width: fs * 0.2)
                    }
                    Text(String(rolling[i] ?? ch))
                        .prettyDigit(spec, DigitContext(index: i, count: digits.count, char: ch, size: fs))
                        .monospacedDigit()
                        .offset(y: hop.contains(i) ? -fs * 0.27 : 0)
                        .scaleEffect(hop.contains(i) ? 1.18 : 1)
                        .rotationEffect(.degrees(hop.contains(i) ? -5 : 0))
                }
            }
            .modifier(MirrorAxisIf(spec: spec))

            Text("\u{00A0}₽")
                .font(t.display(fs * 0.62))
                .foregroundStyle(spec == nil ? t.muted : (spec!.pattern == .blocks ? t.ink.opacity(0.7) : spec!.color.opacity(0.75)))
        }
        .lineLimit(1)
        .prettyNumber(spec)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("В копилке \(Rub.format(value))")
        .onChange(of: partyTick) { _, _ in party() }
    }

    /// Перекатывание + подпрыгивание. Только визуал: касания не блокируются.
    private func party() {
        let n = chars.count
        for i in 0..<n {
            let stopAt = 0.26 + Double(i) * 0.09
            var tt = 0.0
            while tt < stopAt {
                let at = tt
                DispatchQueue.main.asyncAfter(deadline: .now() + at) {
                    rolling[i] = Character(String(Int.random(in: 0...9)))
                }
                tt += 0.05
            }
            DispatchQueue.main.asyncAfter(deadline: .now() + stopAt) {
                rolling[i] = nil
                withAnimation(.spring(response: 0.28, dampingFraction: 0.45)) { _ = hop.insert(i) }
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.32) {
                    withAnimation(.spring(response: 0.35, dampingFraction: 0.6)) { _ = hop.remove(i) }
                }
            }
        }
    }
}

private struct MirrorAxisIf: ViewModifier {
    var spec: PrettyStyleSpec?
    @ViewBuilder func body(content: Content) -> some View {
        if let s = spec, s.pattern == .mirror { content.modifier(MirrorAxis(color: s.color)) } else { content }
    }
}

/// Радужная вспышка за суммой при празднике.
struct PartyHalo: View {
    var tick: Int
    @State private var on = false
    @State private var angle = 0.0
    var body: some View {
        Circle()
            .fill(AngularGradient(colors: DS.festive + [DS.festive[0]], center: .center))
            .frame(width: 240, height: 240)
            .blur(radius: 26)
            .rotationEffect(.degrees(angle))
            .scaleEffect(on ? 1.15 : 0.4)
            .opacity(on ? 0.55 : 0)
            .allowsHitTesting(false)
            .onChange(of: tick) { _, _ in
                angle = 0
                withAnimation(.easeOut(duration: 0.35)) { on = true }
                withAnimation(.easeOut(duration: 1.5)) { angle = 260 }
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) {
                    withAnimation(.easeOut(duration: 1.0)) { on = false }
                }
            }
    }
}
