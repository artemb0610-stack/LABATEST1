import SwiftUI

struct HomeView: View {
    @EnvironmentObject var store: AppStore
    @State private var shownBalance = 0

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                Avatar().padding(.top, 4)

                // Карта ребёнка (декоративная, как в макете) + баланс поверх
                KidCardArt()
                    .padding(.horizontal, 26)
                    .padding(.top, 10)
                    .padding(.bottom, -28)
                    .zIndex(0)

                HStack(spacing: 10) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Мой счёт").font(DS.text(13, .semibold)).foregroundStyle(DS.muted)
                        MoneyText(rub: shownBalance, kop: store.balanceKop, size: 32)
                    }
                    Spacer(minLength: 0)
                    Button { store.tab = .piggies } label: {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("в копилках").font(DS.text(11, .semibold)).foregroundStyle(Color(hex: "#6f8a2a"))
                            HStack(spacing: 4) {
                                Text(Rub.format(store.totalSaved)).font(DS.display(18)).foregroundStyle(DS.ink)
                                Image(systemName: "dollarsign.circle.fill").foregroundStyle(DS.greenInk)
                            }
                            .lineLimit(1).minimumScaleFactor(0.7)
                        }
                        .padding(.horizontal, 14).padding(.vertical, 12)
                        .background(Color(hex: "#eefbc9"), in: RoundedRectangle(cornerRadius: 20, style: .continuous))
                    }
                    .buttonStyle(PressStyle())
                }
                .padding(.leading, 24).padding(.trailing, 14).padding(.vertical, 18)
                .background(DS.card, in: RoundedRectangle(cornerRadius: DS.rCard, style: .continuous))
                .shadow(color: .black.opacity(0.05), radius: 15, y: 8)
                .zIndex(1)

                HStack(spacing: 4) {
                    Capsule().fill(Color(hex: "#c9ced6")).frame(width: 26, height: 6)
                    Circle().fill(Color(hex: "#dde1e6")).frame(width: 6, height: 6)
                    Circle().fill(Color(hex: "#dde1e6")).frame(width: 6, height: 6)
                }
                .frame(maxWidth: .infinity).padding(.top, 12)

                HStack(spacing: 8) {
                    QuickTile(title: "QR", icon: "qrcode", tint: DS.violet, bg: DS.violetBg, iconLeading: true) { store.homePath.append(.pay) }
                        .frame(width: 84)
                    QuickTile(title: "Скинуть\nденег", icon: "arrow.right", tint: DS.blue, bg: DS.blueBg) { store.homePath.append(.pay) }
                        .frame(maxWidth: .infinity)
                    QuickTile(title: "Пополнить\nмобилку", icon: "iphone", tint: DS.mint, bg: DS.mintBg) { store.homePath.append(.pay) }
                        .frame(maxWidth: .infinity)
                }
                .padding(.top, 16)

                Button { store.tab = .piggies } label: {
                    HStack {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Копи на мечту").font(DS.display(20))
                            Text("Красивые числа в копилке оживают").font(DS.text(14)).opacity(0.9)
                        }
                        Spacer()
                        Text("₽").font(DS.display(28)).foregroundStyle(Color(hex: "#b07a0c"))
                            .frame(width: 58, height: 58)
                            .background(RadialGradient(colors: [Color(hex: "#fff3b0"), Color(hex: "#ffd04a"), Color(hex: "#f0a91e")], center: .topLeading, startRadius: 2, endRadius: 60), in: Circle())
                            .shadow(color: .black.opacity(0.18), radius: 9, y: 6)
                    }
                    .foregroundStyle(.white)
                    .padding(.horizontal, 24).padding(.vertical, 22)
                    .background(LinearGradient(colors: [Color(hex: "#9b8cf5"), Color(hex: "#7aa6f7"), Color(hex: "#72c7f0")], startPoint: .leading, endPoint: .trailing),
                                in: RoundedRectangle(cornerRadius: DS.rCard, style: .continuous))
                }
                .buttonStyle(PressStyle())
                .padding(.top, 14)

                Text("История").font(DS.display(24)).padding(.top, 26).padding(.bottom, 14).padding(.horizontal, 4)
                OpsList(ops: store.homeHistory)
                Button { store.homePath.append(.history) } label: {
                    Text("Посмотреть историю").font(DS.text(17, .bold)).foregroundStyle(DS.ink)
                        .frame(maxWidth: .infinity, minHeight: 58)
                        .background(DS.card, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
                }
                .buttonStyle(PressStyle())
                .padding(.top, 14)
            }
            .padding(.horizontal, 16)
            .padding(.bottom, 110)
        }
        .background(alignment: .top) {
            RadialGradient(colors: [Color(hex: "#d9f78a"), Color(hex: "#d9f78a").opacity(0)], center: .init(x: 0.6, y: 0.3), startRadius: 10, endRadius: 280)
                .frame(height: 420).offset(y: -100).ignoresSafeArea()
        }
        .screenBackground()
        .toolbar(.hidden, for: .navigationBar)
        .toolbarRole(.editor)
        .onAppear {
            // Короткий «досчёт» баланса при открытии
            if shownBalance == 0 { withAnimation(.easeOut(duration: 0.7)) { shownBalance = store.balance } }
            else { shownBalance = store.balance }
        }
        .onChange(of: store.balance) { _, v in withAnimation { shownBalance = v } }
    }
}

struct Avatar: View {
    var body: some View {
        Text("М").font(DS.display(22)).foregroundStyle(.white)
            .frame(width: 56, height: 56)
            .background(RadialGradient(colors: [Color(hex: "#ffc27a"), Color(hex: "#ff7a59")], center: .topLeading, startRadius: 4, endRadius: 60), in: Circle())
            .shadow(color: Color(hex: "#ff7a59").opacity(0.3), radius: 6, y: 4)
    }
}

struct KidCardArt: View {
    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 22, style: .continuous).fill(Color(hex: "#c9ec3a"))
            GeometryReader { g in
                let w = g.size.width, h = g.size.height
                Ellipse().fill(Color(hex: "#1d1d1d")).frame(width: 70, height: 90).position(x: w * 0.42, y: h * 0.5)
                Circle().fill(Color(hex: "#ff8fc8")).frame(width: 54).position(x: w * 0.16, y: h * 0.52)
                Circle().fill(Color(hex: "#ffd23f")).frame(width: 46).position(x: w * 0.82, y: h * 0.3)
                Capsule().fill(Color(hex: "#7b6cff")).frame(width: 64, height: 30).rotationEffect(.degrees(-14)).position(x: w * 0.66, y: h * 0.8)
                Circle().fill(Color(hex: "#4fd1ff")).frame(width: 28).position(x: w * 0.62, y: h * 0.2)
            }
        }
        .frame(height: 150)
        .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
        .rotationEffect(.degrees(-3))
        .shadow(color: Color(hex: "#78a014").opacity(0.25), radius: 15, y: 10)
        .accessibilityHidden(true)
    }
}

struct QuickTile: View {
    let title: String
    let icon: String
    let tint: Color
    let bg: Color
    var iconLeading = false
    let action: () -> Void
    var body: some View {
        Button(action: action) {
            VStack(alignment: .leading) {
                Text(title).font(DS.text(15, .bold)).foregroundStyle(DS.ink).multilineTextAlignment(.leading)
                    .lineLimit(2).minimumScaleFactor(0.75)
                Spacer(minLength: 8)
                HStack {
                    if !iconLeading { Spacer() }
                    Image(systemName: icon).font(.system(size: 20, weight: .semibold)).foregroundStyle(tint)
                        .frame(width: 46, height: 46).background(bg, in: RoundedRectangle(cornerRadius: 15, style: .continuous))
                    if iconLeading { Spacer() }
                }
            }
            .padding(14)
            .frame(maxWidth: .infinity, minHeight: 116, alignment: .topLeading)
            .background(DS.card, in: RoundedRectangle(cornerRadius: DS.rTile, style: .continuous))
        }
        .buttonStyle(PressStyle())
    }
}

struct OpsList: View {
    let ops: [Op]
    var body: some View {
        VStack(spacing: 0) {
            ForEach(ops) { op in OpRow(op: op) }
            if ops.isEmpty {
                Text("Пока пусто — отложи первые монетки").font(DS.text(14)).foregroundStyle(DS.muted).padding(.vertical, 12)
            }
        }
        .padding(.horizontal, 20).padding(.vertical, 8)
        .background(DS.card, in: RoundedRectangle(cornerRadius: DS.rCard, style: .continuous))
    }
}

struct OpRow: View {
    let op: Op
    var letter: String? = nil
    var body: some View {
        HStack(spacing: 14) {
            Group {
                if let letter { Text(letter).font(DS.display(18)) } else { Image(systemName: op.icon).font(.system(size: 18, weight: .semibold)) }
            }
            .foregroundStyle(op.tint)
            .frame(width: 50, height: 50)
            .background(op.bg, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
            VStack(alignment: .leading, spacing: 2) {
                Text(op.title).font(DS.text(15, .semibold)).foregroundStyle(DS.ink)
                Text(op.sub).font(DS.text(13)).foregroundStyle(DS.muted)
            }
            Spacer(minLength: 4)
            Text((op.sum > 0 ? "+" : "") + Rub.format(op.sum))
                .font(DS.display(16)).foregroundStyle(op.sum > 0 ? DS.greenInk : DS.ink)
                .lineLimit(1)
        }
        .padding(.vertical, 12)
    }
}

struct PayStubView: View {
    @EnvironmentObject var store: AppStore
    var body: some View {
        ScrollView {
            Card {
                VStack(spacing: 12) {
                    Text("🔒").font(.system(size: 40))
                    Text("Заглушка экрана оплаты").font(DS.text(16, .bold))
                    Text("На экранах оплаты, перевода, реквизитов и лимитов слой эффектов отключён полностью.")
                        .font(DS.text(15)).foregroundStyle(DS.muted).multilineTextAlignment(.center)
                }
                .frame(maxWidth: .infinity)
            }
            .padding(16)
        }
        .screenBackground()
        .navigationTitle("Платежи и переводы")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear { store.fx.forbidden = true }
        .onDisappear { store.fx.forbidden = false }
    }
}
