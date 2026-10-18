import SwiftUI

// MARK: - Демо-данные: 100 входящих переводов с фиксированным зерном (одинаковые при каждом открытии)

struct Transfer: Identifiable {
    let id: Int
    let day: Date
    let time: String
    let name: String
    let sub: String
    let sum: Int
    let tint: Color
    let bg: Color
}

enum HistoryData {
    static let all: [Transfer] = make()

    private static func make() -> [Transfer] {
        var seed: UInt64 = 20261018
        func rnd() -> Double { seed = (seed &* 1103515245 &+ 12345) % 2147483648; return Double(seed) / 2147483648 }
        func pick<T>(_ a: [T]) -> T { a[Int(rnd() * Double(a.count)) % a.count] }
        let who: [(String, String, Color, Color, [Int])] = [
            ("Мама", "Перевод", DS.peach, DS.peachBg, [100, 150, 200, 250, 300, 500]),
            ("Папа", "Перевод", DS.blue, DS.blueBg, [100, 200, 300, 500, 1000]),
            ("Бабушка Валя", "Перевод", DS.violet, DS.violetBg, [200, 300, 500, 1000]),
            ("Дедушка Коля", "Перевод", DS.mint, DS.mintBg, [100, 300, 500, 700]),
            ("Тётя Оля", "Перевод", DS.peach, DS.peachBg, [150, 250, 400]),
            ("Брат Саша", "Перевод", DS.blue, DS.blueBg, [50, 70, 100, 120]),
            ("Мама", "Карманные на неделю", DS.peach, DS.peachBg, [300, 350, 400]),
            ("Папа", "За пятёрку", DS.blue, DS.blueBg, [50, 100]),
            ("Бабушка Валя", "На мороженое", DS.violet, DS.violetBg, [80, 100, 150]),
            ("Крёстная", "Перевод", DS.mint, DS.mintBg, [500, 1000])
        ]
        var out: [Transfer] = []
        var day = Calendar.current.startOfDay(for: Date())
        while out.count < 100 {
            let n = rnd() < 0.35 ? 0 : 1 + Int(rnd() * 3)
            var todays: [Transfer] = []
            for _ in 0..<n where out.count + todays.count < 100 {
                let w = pick(who)
                let hh = 8 + Int(rnd() * 13), mm = Int(rnd() * 60)
                todays.append(Transfer(id: out.count + todays.count, day: day, time: String(format: "%02d:%02d", hh, mm),
                                       name: w.0, sub: w.1, sum: pick(w.4), tint: w.2, bg: w.3))
            }
            out += todays.sorted { $0.time > $1.time }
            day = Calendar.current.date(byAdding: .day, value: -1, to: day) ?? day
        }
        return out
    }

    static func title(_ d: Date) -> String {
        let cal = Calendar.current
        if cal.isDateInToday(d) { return "Сегодня" }
        if cal.isDateInYesterday(d) { return "Вчера" }
        let f = DateFormatter(); f.locale = Locale(identifier: "ru_RU"); f.dateFormat = "d MMMM"
        return f.string(from: d)
    }
}

// MARK: - Экран истории

struct HistoryView: View {
    @EnvironmentObject var store: AppStore
    @StateObject private var speed = ScrollSpeedFX()
    @State private var planetIn = false
    @State private var coinFlip = false
    @State private var found = false

    private struct DayGroup: Identifiable { let id: String; var items: [Transfer] }

    private var groups: [DayGroup] {
        var out: [DayGroup] = []
        for t in HistoryData.all {
            let k = HistoryData.title(t.day)
            if out.last?.id == k { out[out.count - 1].items.append(t) } else { out.append(DayGroup(id: k, items: [t])) }
        }
        return out
    }

    var body: some View {
        ZStack {
            DS.bg.ignoresSafeArea()
            // Эффект скорости рисуется ПОД карточками: виден только в промежутках и по краям
            if store.cfg.enabled && store.cfg.scrollFx.enabled {
                ScrollSpeedCanvas(fx: speed).ignoresSafeArea()
            }
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    GeometryReader { g in
                        Color.clear.preference(key: ScrollOffsetKey.self, value: g.frame(in: .named("hist")).minY)
                    }
                    .frame(height: 0)

                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Пришло за месяц").font(DS.text(13)).foregroundStyle(DS.muted)
                            Text("+" + Rub.format(monthSum)).font(DS.display(20)).foregroundStyle(DS.greenInk)
                        }
                        Spacer()
                        VStack(alignment: .trailing, spacing: 2) {
                            Text("Переводов").font(DS.text(13)).foregroundStyle(DS.muted)
                            Text("\(HistoryData.all.count)").font(DS.display(20))
                        }
                    }
                    .padding(.horizontal, 22).padding(.vertical, 18)
                    .background(DS.card, in: RoundedRectangle(cornerRadius: DS.rCard, style: .continuous))

                    LazyVStack(alignment: .leading, spacing: 0) {
                        ForEach(groups) { g in
                            Text(g.id).font(DS.text(15, .bold)).foregroundStyle(Color(hex: "#6b7380"))
                                .padding(.horizontal, 6).padding(.top, 20).padding(.bottom, 10)
                            VStack(spacing: 0) {
                                ForEach(g.items) { t in
                                    OpRow(op: Op(title: t.name, sub: "\(t.sub) · \(t.time)", sum: t.sum, icon: "", tint: t.tint, bg: t.bg),
                                          letter: String(t.name.prefix(1)))
                                }
                            }
                            .padding(.horizontal, 20).padding(.vertical, 8)
                            .background(DS.card, in: RoundedRectangle(cornerRadius: DS.rCard, style: .continuous))
                        }

                        // Пасхалка в конце истории
                        Planet(rise: planetIn, coinFlip: coinFlip) { tapCoin() }
                            .padding(.top, 34)
                            .padding(.horizontal, -16)
                            .onAppear { withAnimation(.spring(response: 0.9, dampingFraction: 0.8)) { planetIn = true } }
                            .onDisappear { planetIn = false }
                    }
                }
                .padding(.horizontal, 16)
            }
            .coordinateSpace(name: "hist")
            .onPreferenceChange(ScrollOffsetKey.self) { y in speed.feed(offset: y, cfg: store.cfg.scrollFx) }
        }
        .navigationTitle("История")
        .navigationBarTitleDisplayMode(.inline)
        .onDisappear { speed.stop() }
    }

    private var monthSum: Int {
        let from = Calendar.current.date(byAdding: .day, value: -30, to: Date()) ?? Date()
        return HistoryData.all.filter { $0.day >= from }.reduce(0) { $0 + $1.sum }
    }

    private func tapCoin() {
        withAnimation(.spring(response: 0.6, dampingFraction: 0.55)) { coinFlip.toggle() }
        store.fx.haptic(.coin); store.fx.chime()
        if !found { found = true; store.fx.showToast("Пасхалка найдена! Ты долистал до самого начала", seconds: 2.2) }
    }
}

private struct ScrollOffsetKey: PreferenceKey {
    static var defaultValue: CGFloat = 0
    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) { value = nextValue() }
}

// MARK: - Эффект скорости

/// Следы «гиперпрыжка» при СИЛЬНОЙ прокрутке и зелёные молнии по краям на самых резких рывках.
/// Скорость сглаживается: на обычной прокрутке эффекта нет. Кадры считаются только пока эффект идёт.
final class ScrollSpeedFX: ObservableObject {
    struct Streak { var x, y, vx, vy, len, w: Double; var c: Color; var t = 0.0; var life: Double }
    struct Bolt { var pts: [CGPoint]; var t = 0.0; var life = 0.24 }

    @Published private(set) var running = false
    fileprivate var streaks: [Streak] = []
    fileprivate var bolts: [Bolt] = []
    fileprivate var size: CGSize = .zero
    fileprivate var cfg = ScrollFxConfig()
    private var lastY: CGFloat? = nil
    private var lastT = Date()
    private var v = 0.0
    private var lastBolt: [Bool: Date] = [:]
    private var last = Date()

    func feed(offset y: CGFloat, cfg c: ScrollFxConfig) {
        cfg = c
        let now = Date()
        defer { lastY = y; lastT = now }
        guard let ly = lastY, size.width > 0 else { return }
        let gapMs = now.timeIntervalSince(lastT) * 1000
        let dt = max(12, gapMs)
        let inst = Double(ly - y) / dt            // > 0 — листаем вниз (контент уходит вверх)
        if gapMs > 150 { v = 0 }
        v = v * 0.55 + inst * 0.45
        let sp = abs(v)
        guard sp >= c.minSpeed else { return }
        let dir: Double = v > 0 ? -1 : 1
        let cols = v > 0 ? c.down : c.up
        let over = sp - c.minSpeed
        let n = min(11, 4 + Int(over * 3))
        let w = Double(size.width), h = Double(size.height)
        for _ in 0..<n where streaks.count < 140 {
            let x = Double.random(in: 0...w), yy = Double.random(in: 0...h)
            streaks.append(Streak(x: x, y: yy, vx: (x - w / 2) * (0.8 + over * 0.35), vy: dir * (700 + sp * 480),
                                  len: min(220, 70 + over * 50), w: .random(in: 1.6...3.2), c: cols.randomElement() ?? .green,
                                  life: .random(in: 0.3...0.48)))
        }
        if c.lightning && sp >= c.lightningSpeed {
            for left in [true, false] {
                if let lb = lastBolt[left], now.timeIntervalSince(lb) < 0.26 { continue }
                if Bool.random() { continue }
                lastBolt[left] = now
                bolts.append(makeBolt(left: left, w: w, h: h))
            }
        }
        if !running { last = now; running = true }
    }

    private func makeBolt(left: Bool, w: Double, h: Double) -> Bolt {
        let y0 = Double.random(in: h * 0.08 ... h * 0.55), len = Double.random(in: 140...280)
        let edge = left ? 7.0 : w - 7
        var pts: [CGPoint] = []
        var y = y0
        while y <= y0 + len {
            let side: Double = left ? 1 : -1
            let jitter = Double.random(in: 0...14) * side + Double.random(in: -4...4)
            pts.append(CGPoint(x: edge + jitter, y: y))
            y += .random(in: 14...26)
        }
        return Bolt(pts: pts)
    }

    fileprivate func step(_ now: Date) {
        let dt = min(0.033, max(0, now.timeIntervalSince(last))); last = now
        for i in streaks.indices.reversed() {
            streaks[i].t += dt
            if streaks[i].t >= streaks[i].life { streaks.remove(at: i); continue }
            streaks[i].x += streaks[i].vx * dt; streaks[i].y += streaks[i].vy * dt
        }
        for i in bolts.indices.reversed() {
            bolts[i].t += dt
            if bolts[i].t >= bolts[i].life { bolts.remove(at: i) }
        }
        if streaks.isEmpty && bolts.isEmpty && running {
            DispatchQueue.main.async { [weak self] in self?.running = false }
        }
    }

    func stop() { streaks.removeAll(); bolts.removeAll(); running = false }
}

struct ScrollSpeedCanvas: View {
    @ObservedObject var fx: ScrollSpeedFX
    var body: some View {
        GeometryReader { g in
            Color.clear
                .onAppear { fx.size = g.size }
                .onChange(of: g.size) { _, s in fx.size = s }
            if fx.running {
                TimelineView(.animation) { tl in
                    Canvas { ctx, _ in
                        fx.step(tl.date)
                        for s in fx.streaks {
                            let a = 1 - s.t / s.life
                            let m = max(1, (s.vx * s.vx + s.vy * s.vy).squareRoot())
                            let tx = s.x - s.vx / m * s.len, ty = s.y - s.vy / m * s.len
                            var tail = Path(); tail.move(to: CGPoint(x: tx, y: ty)); tail.addLine(to: CGPoint(x: s.x, y: s.y))
                            var c = ctx
                            c.opacity = a * 0.28
                            c.stroke(tail, with: .color(s.c), style: StrokeStyle(lineWidth: s.w * 2.6, lineCap: .round))
                            var head = Path(); head.move(to: CGPoint(x: (s.x + tx) / 2, y: (s.y + ty) / 2)); head.addLine(to: CGPoint(x: s.x, y: s.y))
                            c.opacity = a * 0.85
                            c.stroke(head, with: .color(s.c), style: StrokeStyle(lineWidth: s.w, lineCap: .round))
                        }
                        for b in fx.bolts {
                            let f = (1 - b.t / b.life) * Double.random(in: 0.55...1)
                            var path = Path(); path.addLines(b.pts)
                            var c = ctx
                            c.opacity = f * 0.35
                            c.stroke(path, with: .color(fx.cfg.boltGlow), style: StrokeStyle(lineWidth: 7, lineCap: .round, lineJoin: .round))
                            c.opacity = f
                            c.stroke(path, with: .color(fx.cfg.boltCore), style: StrokeStyle(lineWidth: 2, lineCap: .round, lineJoin: .round))
                        }
                    }
                }
            }
        }
        .allowsHitTesting(false)
    }
}

// MARK: - Пасхалка: планета с монетой и флажком

struct Planet: View {
    var rise: Bool
    var coinFlip: Bool
    var onCoin: () -> Void
    @State private var wave = false

    var body: some View {
        VStack(spacing: 4) {
            Text("Это самое начало твоей истории").font(DS.text(13, .semibold)).foregroundStyle(Color(hex: "#aab1bb"))
            GeometryReader { g in
                let k = g.size.width / 390
                ZStack(alignment: .topLeading) {
                    Canvas { ctx, size in
                        let s = size.width / 390
                        ctx.scaleBy(x: s, y: s)
                        let gray = GraphicsContext.Shading.color(Color(hex: "#c9ced6"))
                        // звёзды
                        for (x, y) in [(54.0, 30.0), (338.0, 21.0), (304.0, 55.0)] {
                            var p = Path(); p.move(to: CGPoint(x: x, y: y - 4)); p.addLine(to: CGPoint(x: x, y: y + 4))
                            p.move(to: CGPoint(x: x - 4, y: y)); p.addLine(to: CGPoint(x: x + 4, y: y))
                            ctx.stroke(p, with: gray, lineWidth: 1.6)
                        }
                        for (x, y) in [(104.0, 14.0), (262.0, 10.0), (34.0, 70.0), (360.0, 78.0)] {
                            ctx.fill(Path(ellipseIn: CGRect(x: x - 1.5, y: y - 1.5, width: 3, height: 3)), with: gray)
                        }
                        // планета
                        let body = Path(ellipseIn: CGRect(x: 195 - 300, y: 370 - 300, width: 600, height: 600))
                        ctx.fill(body, with: .color(Color(hex: "#e4f3ea")))
                        ctx.stroke(body, with: .color(Color(hex: "#a9d4b8")), lineWidth: 2.5)
                        let dash = StrokeStyle(lineWidth: 2, lineCap: .round, dash: [3, 7])
                        var l1 = Path(); l1.move(to: CGPoint(x: 40, y: 118)); l1.addQuadCurve(to: CGPoint(x: 350, y: 118), control: CGPoint(x: 195, y: 88))
                        var l2 = Path(); l2.move(to: CGPoint(x: 22, y: 146)); l2.addQuadCurve(to: CGPoint(x: 368, y: 146), control: CGPoint(x: 195, y: 112))
                        ctx.stroke(l1, with: .color(Color(hex: "#bfe0ca")), style: dash)
                        ctx.stroke(l2, with: .color(Color(hex: "#bfe0ca")), style: dash)
                        for (x, y, rx, ry) in [(110.0, 104.0, 18.0, 6.0), (286.0, 100.0, 13.0, 4.5), (198.0, 130.0, 24.0, 7.0), (322.0, 134.0, 9.0, 3.5)] {
                            let e = Path(ellipseIn: CGRect(x: x - rx, y: y - ry, width: rx * 2, height: ry * 2))
                            ctx.fill(e, with: .color(Color(hex: "#d8eedf")))
                            ctx.stroke(e, with: .color(Color(hex: "#a9d4b8")), lineWidth: 2)
                        }
                        // тень монеты и флагшток
                        ctx.fill(Path(ellipseIn: CGRect(x: 147, y: 69.4, width: 26, height: 5.2)), with: .color(Color(hex: "#cde6d5")))
                        var pole = Path(); pole.move(to: CGPoint(x: 236, y: 73)); pole.addLine(to: CGPoint(x: 236, y: 32))
                        ctx.stroke(pole, with: .color(Color(hex: "#b9c0c9")), style: StrokeStyle(lineWidth: 2, lineCap: .round))
                    }

                    // Флажок (нейтральный, без символики) — колышется
                    FlagCloth()
                        .fill(Color(hex: "#e4f3ea"))
                        .overlay(FlagCloth().stroke(Color(hex: "#9ccdae"), lineWidth: 2))
                        .frame(width: 30 * k, height: 17 * k)
                        .scaleEffect(x: wave ? 0.93 : 1, y: 1, anchor: .leading)
                        .rotation3DEffect(.degrees(wave ? -8 : 0), axis: (x: 0, y: 1, z: 0), anchor: .leading)
                        .offset(x: 236 * k, y: 32 * k)

                    // Монета — тап переворачивает её (пасхалка)
                    Button(action: onCoin) {
                        ZStack {
                            Circle().fill(Color(hex: "#fdf6e3"))
                            Circle().strokeBorder(Color(hex: "#d8b45c"), lineWidth: 2)
                            Circle().strokeBorder(Color(hex: "#d8b45c"), style: StrokeStyle(lineWidth: 1.4, dash: [2, 3])).padding(4 * k)
                            Text("₽").font(.system(size: 15 * k, weight: .bold)).foregroundStyle(Color(hex: "#c9a24a"))
                        }
                        .frame(width: 30 * k, height: 30 * k)
                    }
                    .buttonStyle(.plain)
                    .rotationEffect(.degrees(-8))
                    .rotation3DEffect(.degrees(coinFlip ? 360 : 0), axis: (x: 0, y: 1, z: 0))
                    .offset(x: (160 - 15) * k, y: (57 - 15) * k)
                }
            }
            .aspectRatio(390.0 / 150.0, contentMode: .fit)
        }
        .opacity(rise ? 1 : 0)
        .offset(y: rise ? 0 : 46)
        .onAppear { withAnimation(.easeInOut(duration: 1.3).repeatForever(autoreverses: true)) { wave = true } }
    }
}

private struct FlagCloth: Shape {
    func path(in r: CGRect) -> Path {
        var p = Path()
        let w = r.width, h = r.height
        p.move(to: CGPoint(x: 0, y: h * 0.06))
        p.addQuadCurve(to: CGPoint(x: w * 0.5, y: h * 0.06), control: CGPoint(x: w * 0.25, y: -h * 0.15))
        p.addQuadCurve(to: CGPoint(x: w, y: h * 0.12), control: CGPoint(x: w * 0.75, y: h * 0.27))
        p.addLine(to: CGPoint(x: w, y: h))
        p.addQuadCurve(to: CGPoint(x: w * 0.5, y: h * 0.94), control: CGPoint(x: w * 0.75, y: h * 0.8))
        p.addQuadCurve(to: CGPoint(x: 0, y: h * 0.9), control: CGPoint(x: w * 0.25, y: h * 1.08))
        p.closeSubpath()
        return p
    }
}
