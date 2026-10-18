import SwiftUI

// ============================================================================
//  PrettyNumberKit — оформление «красивых чисел» как набор ViewModifier.
//
//  Почему модификаторы: так оформление встраивается в дизайн-систему приложения,
//  не трогая логику. Шрифты, радиусы и базовые цвета приходят токенами через Environment,
//  а каждый стиль можно применить к любому своему Text/View отдельно:
//
//      Text("5 000").modifier(GuillocheContainer(color: .red, accent: .orange))
//      AmountDigits(value: 1234).prettyNumber(spec)          // целиком по спецификации из CMS
//      .prettyNumberTokens(.init(display: { .custom("SBSansDisplay-Bold", size: $0) }))
//
//  На Android то же самое ложится на Compose Modifier (Modifier.guilloche(...), Modifier.cube(...)).
// ============================================================================

// MARK: - Токены дизайн-системы

struct PrettyNumberTokens {
    /// Основной шрифт цифр (в продукте — SB Sans Display)
    var display: (CGFloat) -> Font = { .system(size: $0, weight: .heavy) }
    /// «Гравюрный» шрифт для купюр
    var engraved: (CGFloat) -> Font = { .system(size: $0, weight: .bold, design: .serif) }
    /// Скруглённый шрифт для кубиков
    var rounded: (CGFloat) -> Font = { .system(size: $0, weight: .heavy, design: .rounded) }
    var ink: Color = Color(hex: "#0d0d0d")
    var muted: Color = Color(hex: "#9aa3b0")
    var cornerRadius: CGFloat = 22
    init() {}
}

private struct PrettyNumberTokensKey: EnvironmentKey { static let defaultValue = PrettyNumberTokens() }

extension EnvironmentValues {
    var prettyNumberTokens: PrettyNumberTokens {
        get { self[PrettyNumberTokensKey.self] }
        set { self[PrettyNumberTokensKey.self] = newValue }
    }
}

extension View {
    /// Подставить токены своей дизайн-системы для всех красивых чисел ниже по дереву.
    func prettyNumberTokens(_ t: PrettyNumberTokens) -> some View { environment(\.prettyNumberTokens, t) }
}

/// Где стоит цифра — нужно стилям, которые красят цифры по-разному (кубики, зеркало).
struct DigitContext {
    var index: Int
    var count: Int
    var char: Character
    var size: CGFloat
}

// MARK: - Модификаторы цифр (применяются к каждой цифре)

/// Обычная цифра — без украшений.
struct PlainDigit: ViewModifier {
    @Environment(\.prettyNumberTokens) private var t
    var size: CGFloat
    var color: Color? = nil
    func body(content: Content) -> some View {
        content.font(t.display(size)).foregroundStyle(color ?? t.ink)
    }
}

/// Купюра: гравюрный шрифт, цвет номинала, лёгкое тиснение.
struct BanknoteDigit: ViewModifier {
    @Environment(\.prettyNumberTokens) private var t
    var size: CGFloat
    var color: Color
    func body(content: Content) -> some View {
        content
            .font(t.engraved(size))
            .foregroundStyle(color)
            .shadow(color: .white.opacity(0.9), radius: 0, x: 0, y: 1)
    }
}

/// Кубик для счёта: пастельная плашка, цветная цифра, лёгкий наклон.
struct CubeDigit: ViewModifier {
    @Environment(\.prettyNumberTokens) private var t
    var size: CGFloat
    var color: Color
    var index: Int
    func body(content: Content) -> some View {
        content
            .font(t.rounded(size))
            .foregroundStyle(color)
            .padding(.horizontal, size * 0.14)
            .padding(.bottom, 2)
            .background(
                RoundedRectangle(cornerRadius: size * 0.3, style: .continuous)
                    .fill(color.opacity(0.12))
                    .overlay(alignment: .bottom) {
                        RoundedRectangle(cornerRadius: size * 0.3, style: .continuous)
                            .fill(color.opacity(0.18)).frame(height: 3)
                    }
            )
            .rotationEffect(.degrees(Double((index % 2 == 0 ? -1 : 1) * (2 + index % 3))))
    }
}

/// Зеркало: симметричные цифры одного цвета.
struct MirrorDigit: ViewModifier {
    @Environment(\.prettyNumberTokens) private var t
    var size: CGFloat
    var color: Color
    func body(content: Content) -> some View {
        content.font(t.display(size)).foregroundStyle(color)
    }
}

/// Круглое число: нули мягко пульсируют, как бусины.
struct PulseZeroDigit: ViewModifier {
    @Environment(\.prettyNumberTokens) private var t
    var size: CGFloat
    var color: Color
    var isZero: Bool
    var delay: Double
    @State private var on = false
    func body(content: Content) -> some View {
        content
            .font(t.display(size))
            .foregroundStyle(color)
            .scaleEffect(isZero && on ? 1.12 : 1)
            .onAppear {
                guard isZero else { return }
                withAnimation(.easeInOut(duration: 0.8).repeatForever(autoreverses: true).delay(delay)) { on = true }
            }
    }
}

// MARK: - Модификаторы контейнера (применяются ко всей сумме)

/// Купюра: гильош-узор, двойная рамка цвета номинала. Сами банкноты не изображаем.
struct GuillocheContainer: ViewModifier {
    @Environment(\.prettyNumberTokens) private var t
    var color: Color
    var accent: Color
    func body(content: Content) -> some View {
        content
            .padding(.horizontal, 18).padding(.vertical, 8)
            .background {
                RoundedRectangle(cornerRadius: t.cornerRadius, style: .continuous)
                    .fill(LinearGradient(colors: [accent.opacity(0.22), .white, accent.opacity(0.22)],
                                         startPoint: .topLeading, endPoint: .bottomTrailing))
                    .overlay {
                        Canvas { ctx, size in
                            for cx in [size.width * 0.18, size.width * 0.82] {
                                var r: CGFloat = 6
                                while r < size.width * 0.5 {
                                    ctx.stroke(Path(ellipseIn: CGRect(x: cx - r, y: size.height / 2 - r, width: r * 2, height: r * 2)),
                                               with: .color(accent.opacity(0.28)), lineWidth: 1)
                                    r += 7
                                }
                            }
                        }
                        .clipShape(RoundedRectangle(cornerRadius: t.cornerRadius, style: .continuous))
                    }
                    .overlay {
                        RoundedRectangle(cornerRadius: t.cornerRadius, style: .continuous).strokeBorder(color.opacity(0.35), lineWidth: 2)
                    }
                    .overlay {
                        RoundedRectangle(cornerRadius: t.cornerRadius - 5, style: .continuous).strokeBorder(color.opacity(0.22), lineWidth: 1).padding(5)
                    }
            }
    }
}

/// Переливы: мягкий цветной перелив бежит по цифрам.
struct ShimmerContainer: ViewModifier {
    var color: Color
    var accent: Color
    @State private var phase = false
    func body(content: Content) -> some View {
        content
            .overlay {
                GeometryReader { g in
                    LinearGradient(colors: [color, accent, color, accent, color], startPoint: .leading, endPoint: .trailing)
                        .frame(width: g.size.width * 3)
                        .offset(x: phase ? 0 : -g.size.width * 2)
                }
                .mask(content)
                .allowsHitTesting(false)
            }
            .shadow(color: accent.opacity(0.25), radius: 10, y: 3)
            .onAppear { withAnimation(.linear(duration: 2.4).repeatForever(autoreverses: false)) { phase = true } }
    }
}

/// Зеркало: светлая подложка и пунктирная ось симметрии посередине цифр.
struct MirrorContainer: ViewModifier {
    @Environment(\.prettyNumberTokens) private var t
    var color: Color
    var accent: Color
    func body(content: Content) -> some View {
        content
            .padding(.horizontal, 18).padding(.vertical, 8)
            .background(accent, in: RoundedRectangle(cornerRadius: t.cornerRadius, style: .continuous))
    }
}

/// Ось симметрии — накладывается только на цифры (без ₽), чтобы стоять ровно по центру числа.
struct MirrorAxis: ViewModifier {
    var color: Color
    func body(content: Content) -> some View {
        content.overlay {
            Rectangle().fill(.clear).frame(width: 2)
                .overlay(Line().stroke(color.opacity(0.45), style: StrokeStyle(lineWidth: 2, dash: [4, 4])))
                .padding(.vertical, 2)
        }
    }
    private struct Line: Shape {
        func path(in r: CGRect) -> Path { var p = Path(); p.move(to: CGPoint(x: r.midX, y: r.minY)); p.addLine(to: CGPoint(x: r.midX, y: r.maxY)); return p }
    }
}

/// Строгий: только тонкая линия снизу.
struct StrictContainer: ViewModifier {
    var accent: Color
    func body(content: Content) -> some View {
        content
            .padding(.horizontal, 12).padding(.bottom, 6)
            .overlay(alignment: .bottom) { Capsule().fill(accent).frame(height: 2) }
    }
}

/// Плашка цвета (круглые числа и т. п.).
struct TintContainer: ViewModifier {
    @Environment(\.prettyNumberTokens) private var t
    var accent: Color
    func body(content: Content) -> some View {
        content
            .padding(.horizontal, 18).padding(.vertical, 8)
            .background(accent, in: RoundedRectangle(cornerRadius: t.cornerRadius, style: .continuous))
    }
}

// MARK: - Сборка по спецификации из CMS

/// Выбирает модификатор цифры по спецификации стиля из конфига.
struct PrettyDigitModifier: ViewModifier {
    var spec: PrettyStyleSpec?
    var ctx: DigitContext

    @ViewBuilder
    func body(content: Content) -> some View {
        if let s = spec {
            switch s.pattern {
            case .guilloche:
                content.modifier(BanknoteDigit(size: ctx.size, color: s.color))
            case .blocks:
                content.modifier(CubeDigit(size: ctx.size * 0.86, color: paletteColor(s, ctx.index), index: ctx.index))
            case .mirror:
                content.modifier(MirrorDigit(size: ctx.size, color: paletteColor(s, min(ctx.index, ctx.count - 1 - ctx.index))))
            case .bold:
                content.modifier(PulseZeroDigit(size: ctx.size, color: s.color, isZero: ctx.char == "0", delay: Double(ctx.index) * 0.12))
            case .glow, .strict:
                content.modifier(PlainDigit(size: ctx.size, color: s.color))
            }
        } else {
            content.modifier(PlainDigit(size: ctx.size))
        }
    }

    private func paletteColor(_ s: PrettyStyleSpec, _ i: Int) -> Color {
        s.palette.isEmpty ? s.color : s.palette[((i % s.palette.count) + s.palette.count) % s.palette.count]
    }
}

/// Выбирает модификатор контейнера по спецификации стиля из конфига.
struct PrettyContainerModifier: ViewModifier {
    var spec: PrettyStyleSpec?

    @ViewBuilder
    func body(content: Content) -> some View {
        if let s = spec {
            switch s.pattern {
            case .guilloche: content.modifier(GuillocheContainer(color: s.color, accent: s.accent))
            case .glow: content.modifier(ShimmerContainer(color: s.color, accent: s.accent))
            case .mirror: content.modifier(MirrorContainer(color: s.color, accent: s.accent))
            case .bold: content.modifier(TintContainer(accent: s.accent))
            case .strict: content.modifier(StrictContainer(accent: s.accent))
            case .blocks: content.padding(.horizontal, 8)
            }
        } else {
            content.padding(.horizontal, 8)
        }
    }
}

extension View {
    /// Оформить сумму целиком по спецификации стиля (nil — обычные цифры).
    func prettyNumber(_ spec: PrettyStyleSpec?) -> some View { modifier(PrettyContainerModifier(spec: spec)) }
    /// Оформить одну цифру.
    func prettyDigit(_ spec: PrettyStyleSpec?, _ ctx: DigitContext) -> some View { modifier(PrettyDigitModifier(spec: spec, ctx: ctx)) }
}
