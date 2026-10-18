import SwiftUI

/// Токены демо-приложения, снятые с макетов СберKids (Figma).
/// В продукте их заменяют токены дизайн-системы приложения.
enum DS {
    static let bg = Color(hex: "#f2f4f7")
    static let card = Color.white
    static let ink = Color(hex: "#0d0d0d")
    static let muted = Color(hex: "#9aa3b0")
    static let line = Color(hex: "#e8ebef")
    static let green = Color(hex: "#5ccf52")
    static let greenInk = Color(hex: "#2bb24c")
    static let violetBg = Color(hex: "#ece5ff"), violet = Color(hex: "#9b7cf2")
    static let blueBg = Color(hex: "#dcefff"), blue = Color(hex: "#4fa3f5")
    static let mintBg = Color(hex: "#d9f7ee"), mint = Color(hex: "#3fcf9a")
    static let peachBg = Color(hex: "#ffeee2"), peach = Color(hex: "#f39a4b")

    /// Фирменная кнопка: голубой → лайм
    static let grad = LinearGradient(colors: [Color(hex: "#7fd6f7"), Color(hex: "#a6ec7a"), Color(hex: "#c4f23a")],
                                     startPoint: .leading, endPoint: .trailing)
    static let festive: [Color] = ["#ff5a5f", "#ff9f1c", "#ffd23f", "#3ddc84", "#2ec4f1", "#4f7cff", "#a66cff", "#ff5fa2"].map { Color(hex: $0) }

    static let rCard: CGFloat = 28
    static let rTile: CGFloat = 22

    /// В продукте — SB Sans Display / Text. Здесь — системные, внешние шрифты в прототипе не тянем.
    static func display(_ size: CGFloat, _ w: Font.Weight = .heavy) -> Font { .system(size: size, weight: w) }
    static func text(_ size: CGFloat, _ w: Font.Weight = .regular) -> Font { .system(size: size, weight: w) }
}

struct Card<Content: View>: View {
    var padding: CGFloat = 20
    @ViewBuilder var content: Content
    var body: some View {
        content
            .padding(padding)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(DS.card, in: RoundedRectangle(cornerRadius: DS.rCard, style: .continuous))
    }
}

struct GradButton: View {
    let title: String
    var icon: String? = "plus"
    let action: () -> Void
    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                if let icon { Image(systemName: icon).font(.system(size: 18, weight: .bold)) }
                Text(title).font(DS.text(17, .bold))
            }
            .foregroundStyle(DS.ink)
            .frame(maxWidth: .infinity, minHeight: 58)
            .background(DS.grad, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
        }
        .buttonStyle(PressStyle())
    }
}

struct PressStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.98 : 1)
            .animation(.easeOut(duration: 0.12), value: configuration.isPressed)
    }
}

/// Сумма: рубли чёрные, копейки и ₽ серые — как в макетах.
struct MoneyText: View {
    let rub: Int
    var kop: Int? = nil
    var size: CGFloat = 32
    var color: Color = DS.ink
    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 0) {
            Text(Rub.group(rub)).foregroundStyle(color).contentTransition(.numericText(value: Double(rub)))
            if let kop { Text(String(format: ",%02d", kop)).font(DS.display(size * 0.72)).foregroundStyle(DS.muted) }
            Text("\u{00A0}₽").foregroundStyle(DS.muted)
        }
        .font(DS.display(size))
        .monospacedDigit()
        .lineLimit(1)
        .minimumScaleFactor(0.6)
    }
}

extension View {
    func screenBackground() -> some View {
        self.background(DS.bg.ignoresSafeArea())
    }
}
