import SwiftUI

/// Шторка «Оформление цифр». Список оформлений приходит из конфига (CMS),
/// выбор ребёнка хранится только на устройстве. Превью — на сумме самого ребёнка.
struct ThemePicker: View {
    @EnvironmentObject var store: AppStore
    @Environment(\.dismiss) private var dismiss
    let value: Int

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 4) {
                Text("Оформление цифр").font(DS.display(22))
                Text("Выбери, как будет выглядеть сумма в копилке").font(DS.text(14)).foregroundStyle(DS.muted)
                LazyVGrid(columns: [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)], spacing: 10) {
                    ForEach(store.cfg.themes) { t in
                        Button {
                            store.theme = t.id
                            store.fx.haptic()
                        } label: { card(t) }
                        .buttonStyle(PressStyle())
                    }
                }
                .padding(.top, 14)
                GradButton(title: "Готово", icon: nil) { dismiss() }.padding(.top, 14)
            }
            .padding(16)
        }
        .background(DS.bg.ignoresSafeArea())
    }

    private func card(_ t: Theme) -> some View {
        let on = store.theme == t.id
        return VStack(alignment: .leading, spacing: 8) {
            ZStack {
                RoundedRectangle(cornerRadius: 14, style: .continuous).fill(DS.bg)
                if let key = t.styleKey, let spec = store.cfg.styles[key] {
                    AmountDigits(value: value, spec: spec, size: 26)
                        .prettyNumberTokens(smallTokens)
                        .allowsHitTesting(false)
                        .padding(4)
                        .minimumScaleFactor(0.5)
                } else {
                    Text("✨ Сюрприз").font(DS.text(15, .heavy)).foregroundStyle(Color(hex: "#6b7380"))
                }
            }
            .frame(height: 64)
            HStack {
                Text(t.title).font(DS.text(15, .bold)).foregroundStyle(DS.ink)
                Spacer()
                if on {
                    Image(systemName: "checkmark.circle.fill").foregroundStyle(DS.green)
                }
            }
            Text(t.desc).font(DS.text(12)).foregroundStyle(DS.muted).lineLimit(3)
                .frame(maxWidth: .infinity, minHeight: 32, alignment: .topLeading)
                .multilineTextAlignment(.leading)
        }
        .padding(12)
        .background(.white, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 22, style: .continuous).strokeBorder(on ? DS.green : .clear, lineWidth: 2.5))
    }

    private var smallTokens: PrettyNumberTokens {
        var t = PrettyNumberTokens(); t.cornerRadius = 12; return t
    }
}
