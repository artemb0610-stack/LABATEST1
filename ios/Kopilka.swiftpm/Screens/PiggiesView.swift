import SwiftUI

struct PiggiesView: View {
    @EnvironmentObject var store: AppStore

    var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                HStack {
                    Avatar()
                    Spacer()
                    Image(systemName: "plus").font(.system(size: 24, weight: .bold)).foregroundStyle(DS.green)
                        .frame(width: 56, height: 56)
                        .background(DS.card, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
                }
                .padding(.top, 4)

                VStack(spacing: 0) {
                    ZStack(alignment: .topTrailing) {
                        VStack(alignment: .leading, spacing: 4) {
                            MoneyText(rub: store.totalSaved, size: 34)
                            Text("Всего на копилках").font(DS.text(14)).foregroundStyle(DS.muted)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.vertical, 6)
                        Text("🐷").font(.system(size: 80)).rotationEffect(.degrees(8)).offset(x: 4, y: -18)
                    }
                    .padding(.horizontal, 24).padding(.top, 24).padding(.bottom, 18)
                    Rectangle().fill(DS.bg).frame(height: 2)
                    HStack {
                        Text("Годовой процент").font(DS.text(16, .semibold))
                        Spacer()
                        Text("11%").font(DS.display(22))
                    }
                    .padding(.horizontal, 24).padding(.vertical, 18)
                }
                .background(DS.card, in: RoundedRectangle(cornerRadius: DS.rCard, style: .continuous))

                ForEach(store.piggies) { p in
                    Button { store.piggiesPath.append(.piggy(p.id)) } label: { PiggyCard(p: p) }
                        .buttonStyle(PressStyle())
                }

                GradButton(title: "Создать копилку") { store.fx.haptic() }
            }
            .padding(.horizontal, 16)
            .padding(.bottom, 110)
        }
        .background(alignment: .top) {
            LinearGradient(colors: [Color(hex: "#f6eda6"), Color(hex: "#f8e2c4"), Color(hex: "#f3c2dc")], startPoint: .leading, endPoint: .trailing)
                .frame(height: 300).mask(LinearGradient(colors: [.black, .clear], startPoint: .top, endPoint: .bottom))
                .ignoresSafeArea()
        }
        .screenBackground()
        .toolbar(.hidden, for: .navigationBar)
    }
}

struct PiggyCard: View {
    @EnvironmentObject var store: AppStore
    let p: Piggy

    var body: some View {
        let done = p.amount >= p.goal
        let pretty = PrettyEngine.classify(p.amount, store.cfg) != nil
        HStack(spacing: 18) {
            Text(p.pic).font(.system(size: 46))
                .frame(width: 92, height: 92)
                .background(done ? Color.white : p.bg, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
            if done {
                VStack(alignment: .leading, spacing: 10) {
                    Text("Ура! Ты накопил на «\(p.name)»").font(DS.display(20)).foregroundStyle(.white).multilineTextAlignment(.leading)
                    Text("Отметить покупку").font(DS.text(13, .bold)).foregroundStyle(DS.ink)
                        .padding(.horizontal, 14).padding(.vertical, 6)
                        .background(DS.grad, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                }
            } else {
                VStack(alignment: .leading, spacing: 10) {
                    HStack(alignment: .firstTextBaseline) {
                        MoneyText(rub: p.amount, size: 20)
                        if pretty {
                            Image(systemName: "sparkle").font(.system(size: 15, weight: .bold)).foregroundStyle(Color(hex: "#f5b400"))
                                .symbolEffect(.pulse)
                        }
                        Spacer(minLength: 4)
                        Text("из " + Rub.format(p.goal)).font(DS.text(13)).foregroundStyle(DS.muted).lineLimit(1)
                    }
                    ProgressBar(value: Double(p.amount) / Double(max(1, p.goal)))
                    Text(p.name).font(DS.text(15)).foregroundStyle(DS.ink).lineLimit(1)
                }
            }
            Spacer(minLength: 0)
        }
        .padding(22)
        .background(done ? DS.green : DS.card, in: RoundedRectangle(cornerRadius: DS.rCard, style: .continuous))
    }
}

struct ProgressBar: View {
    var value: Double
    var height: CGFloat = 10
    var marks: [Double] = []
    var body: some View {
        GeometryReader { g in
            ZStack(alignment: .leading) {
                Capsule().fill(DS.line)
                Capsule().fill(DS.green).frame(width: g.size.width * min(1, max(0, value)))
                ForEach(marks, id: \.self) { m in
                    Rectangle().fill(.white).frame(width: 3, height: height).offset(x: g.size.width * m - 1.5)
                }
            }
        }
        .frame(height: height)
        .animation(.spring(response: 0.6, dampingFraction: 0.85), value: value)
    }
}
