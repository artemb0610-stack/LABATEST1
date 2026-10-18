import SwiftUI
import UIKit
import AudioToolbox

/// Слой эффектов поверх приложения.
///  - не перехватывает касания (allowsHitTesting(false)) — ввод не блокируется ни на миг;
///  - на экранах оплаты и перевода выключен (forbidden), запущенный эффект гаснет сразу;
///  - длительность ограничена maxEffect из конфига, частиц не больше 240, один Canvas — 60 кадров/с.
/// В продукте частицы можно заменить готовыми Lottie-анимациями: Lottie уже есть в стеке.
final class FX: ObservableObject {
    @Published private(set) var running = false
    @Published var toast: String? = nil
    @Published var forbidden = false {
        didSet { if forbidden { cancel() } }
    }
    var soundOn = false

    fileprivate var particles: [Particle] = []
    fileprivate var endAt = Date.distantPast
    fileprivate var last = Date()
    private var toastQueue: [(String, Double)] = []
    private var toastBusy = false
    var screen: CGSize = UIScreen.main.bounds.size

    // MARK: запуск

    func play(_ kinds: [EffectKind], origin: CGRect, palette: [Color] = [], duration: Double) {
        guard !forbidden else { return }
        let now = Date()
        endAt = max(endAt, now.addingTimeInterval(duration))
        if endAt.timeIntervalSince(now) > duration { endAt = now.addingTimeInterval(duration) }
        for k in kinds { spawn(k, origin, palette, duration) }
        if !running { last = now; running = true }
    }

    func cancel() {
        particles.removeAll(); endAt = .distantPast; running = false
        toastQueue.removeAll(); toast = nil; toastBusy = false
    }

    // MARK: плашки

    func showToast(_ text: String, seconds: Double = 1.8) {
        guard !forbidden, !text.isEmpty else { return }
        if toast == text || toastQueue.contains(where: { $0.0 == text }) || toastQueue.count >= 2 { return }
        toastQueue.append((text, seconds))
        if !toastBusy { nextToast() }
    }

    private func nextToast() {
        guard !forbidden, !toastQueue.isEmpty else { toastBusy = false; withAnimation { toast = nil }; return }
        toastBusy = true
        let (text, secs) = toastQueue.removeFirst()
        withAnimation(.spring(response: 0.35, dampingFraction: 0.7)) { toast = text }
        DispatchQueue.main.asyncAfter(deadline: .now() + secs) { [weak self] in
            guard let self else { return }
            withAnimation(.easeIn(duration: 0.25)) { self.toast = nil }
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) { self.nextToast() }
        }
    }

    // MARK: тактильность и звук

    func haptic(_ kind: HapticKind = .light) {
        switch kind {
        case .light: UIImpactFeedbackGenerator(style: .light).impactOccurred()
        case .party: UINotificationFeedbackGenerator().notificationOccurred(.success)
        case .coin: UIImpactFeedbackGenerator(style: .rigid).impactOccurred(intensity: 0.8)
        }
    }
    enum HapticKind { case light, party, coin }

    /// Звук выключен по умолчанию и включается только кнопкой — требование брифа.
    func chime() { if soundOn { AudioServicesPlaySystemSound(1057) } }

    // MARK: частицы

    fileprivate func spawn(_ kind: EffectKind, _ o: CGRect, _ palette: [Color], _ dur: Double) {
        let w = Double(screen.width), h = Double(screen.height)
        let cols = DS.festive + palette
        let life = dur
        let cx = Double(o.midX), cy = Double(o.midY), ow = Double(o.width), oh = Double(o.height)
        func add(_ p: Particle) { if particles.count < 240 { particles.append(p) } }
        switch kind {
        case .coins:
            for _ in 0..<18 { add(Particle(kind: .coin, x: .random(in: 20...(w - 20)), y: .random(in: -120 ... -20), vx: .random(in: -20...20), vy: .random(in: 120...260), g: 520, r: .random(in: 9...14), spin: .random(in: 4...9), phase: .random(in: 0...6), color: Color(hex: "#ffd45c"), life: life)) }
            for _ in 0..<14 { add(Particle(kind: .star, x: .random(in: 20...(w - 20)), y: .random(in: -60...(h * 0.4)), vy: .random(in: 60...140), r: .random(in: 3...6), phase: .random(in: 0...6), color: [Color(hex: "#fff3a6"), Color(hex: "#ffd23f"), .white].randomElement()!, life: life)) }
        case .confetti:
            for _ in 0..<90 {
                let a = Double.random(in: -.pi * 0.95 ... -.pi * 0.05), sp = Double.random(in: 280...620)
                add(Particle(kind: .confetti, shape: Int.random(in: 0...2), x: cx, y: cy, vx: cos(a) * sp, vy: sin(a) * sp, g: 700, drag: 0.985, r: .random(in: 7...11), rot: .random(in: 0...6), vr: .random(in: -12...12), color: cols.randomElement()!, life: life))
            }
        case .streamers:
            for _ in 0..<16 { add(Particle(kind: .ribbon, x: .random(in: 10...(w - 10)), y: .random(in: -160 ... -20), vx: .random(in: -25...25), vy: .random(in: 170...280), g: 60, r: .random(in: 26...40), phase: .random(in: 0...6), rot: .random(in: -0.6...0.6), vr: .random(in: -2.5...2.5), color: DS.festive.randomElement()!, life: life)) }
        case .fireworks:
            for f in 0..<3 {
                let fx = Double.random(in: w * 0.18 ... w * 0.82), fy = Double.random(in: h * 0.1 ... h * 0.36)
                let c1 = DS.festive.randomElement()!, c2 = DS.festive.randomElement()!, delay = Double(f) * 0.28
                add(Particle(kind: .flash, x: fx, y: fy, delay: delay, color: c1, life: delay + 0.35))
                for i in 0..<30 {
                    let a = Double(i) / 30 * .pi * 2 + .random(in: -0.08...0.08), sp = Double.random(in: 150...260)
                    add(Particle(kind: .spark, x: fx, y: fy, vx: cos(a) * sp, vy: sin(a) * sp, g: 160, drag: 0.94, delay: delay, r: .random(in: 2...3.4), color: i % 3 == 0 ? c2 : c1, life: min(life, delay + .random(in: 0.9...1.3))))
                }
            }
        case .burst:
            add(Particle(kind: .ring, x: cx, y: cy, r: max(30, ow * 0.3), r2: max(120, ow * 0.8), color: .white, life: min(life, 0.7)))
            for i in 0..<26 {
                let a = Double(i) / 26 * .pi * 2, sp = Double.random(in: 180...320)
                add(Particle(kind: .star, x: cx, y: cy, vx: cos(a) * sp, vy: sin(a) * sp, drag: 0.9, r: .random(in: 4...8), phase: .random(in: 0...6), color: DS.festive[i % DS.festive.count], life: min(life, .random(in: 0.6...0.9))))
            }
        case .sparkles:
            for _ in 0..<30 { add(Particle(kind: .star, x: cx + .random(in: -(ow / 2 + 20)...(ow / 2 + 20)), y: cy + .random(in: -(oh / 2 + 20)...(oh / 2 + 20)), vx: .random(in: -20...20), vy: .random(in: -50 ... -5), r: .random(in: 4...10), phase: .random(in: 0...6), color: cols.randomElement()!, life: life * .random(in: 0.6...1))) }
        case .leaves:
            let leaf = ["#e8772e", "#d9542c", "#f2b630", "#b8642a"].map { Color(hex: $0) }
            for _ in 0..<14 { add(Particle(kind: .leaf, x: .random(in: 0...w), y: .random(in: -80 ... -10), vx: .random(in: -30...30), vy: .random(in: 60...120), g: 30, sway: .random(in: 30...60), r: .random(in: 7...11), phase: .random(in: 0...6), rot: .random(in: 0...6), vr: .random(in: -2...2), color: leaf.randomElement()!, life: life)) }
        case .snow:
            for _ in 0..<40 { add(Particle(kind: .snow, x: .random(in: 0...w), y: .random(in: -80 ... -5), vx: .random(in: -10...10), vy: .random(in: 40...90), sway: .random(in: 10...25), r: .random(in: 1.5...3.5), phase: .random(in: 0...6), color: .white, life: life)) }
        case .coinDrop:
            add(Particle(kind: .coin, x: cx, y: -30, vy: 380, g: 1500, r: 22, spin: 7, color: Color(hex: "#ffd45c"), life: min(life, 0.9), stopY: Double(o.minY)))
        }
    }

    /// Шаг физики. Вызывается из Canvas на каждом кадре.
    fileprivate func step(_ now: Date) {
        let dt = min(0.033, max(0, now.timeIntervalSince(last)))
        last = now
        let remaining = endAt.timeIntervalSince(now)
        if remaining <= 0 || particles.isEmpty {
            particles.removeAll()
            if running { DispatchQueue.main.async { [weak self] in self?.running = false } }
            return
        }
        for i in particles.indices.reversed() {
            particles[i].t += dt
            var p = particles[i]
            if p.t > p.life { particles.remove(at: i); continue }
            if p.delay > 0 && p.t < p.delay { continue }
            p.vy += p.g * dt
            if p.drag > 0 { p.vx *= p.drag; p.vy *= p.drag }
            p.x += p.vx * dt + (p.sway > 0 ? cos(p.t * 3 + p.phase) * p.sway * dt : 0)
            p.y += p.vy * dt
            if let s = p.stopY, p.y > s { p.y = s; p.vy *= -0.35; if abs(p.vy) < 60 { p.vy = 0 } }
            p.rot += p.vr * dt
            particles[i] = p
        }
    }

    fileprivate var fade: Double {
        let r = endAt.timeIntervalSinceNow
        return r < 0.3 ? max(0, r / 0.3) : 1
    }
}

fileprivate struct Particle {
    enum Kind { case coin, confetti, ribbon, spark, flash, ring, star, leaf, snow }
    var kind: Kind
    var shape = 0
    var x: Double, y: Double
    var vx = 0.0, vy = 0.0, g = 0.0, drag = 0.0, sway = 0.0
    var delay = 0.0
    var r = 4.0, r2 = 0.0
    var spin = 0.0, phase = 0.0, rot = 0.0, vr = 0.0
    var color: Color
    var t = 0.0
    var life: Double
    var stopY: Double? = nil
}

/// Холст эффектов. Кладётся поверх всего приложения, касания пропускает насквозь.
struct FXOverlay: View {
    @ObservedObject var fx: FX

    var body: some View {
        ZStack(alignment: .top) {
            if fx.running {
                TimelineView(.animation) { tl in
                    Canvas { ctx, size in
                        fx.screen = size
                        fx.step(tl.date)
                        let fade = fx.fade
                        for p in fx.particles { draw(p, in: &ctx, fade: fade) }
                    }
                }
                .ignoresSafeArea()
            }
            if let text = fx.toast {
                ToastView(text: text)
                    .padding(.top, 8)
                    .transition(.move(edge: .top).combined(with: .opacity))
            }
        }
        .allowsHitTesting(false)
    }

    private func draw(_ p: Particle, in ctx: inout GraphicsContext, fade: Double) {
        if p.delay > 0 && p.t < p.delay { return }
        let alpha = max(0, fade * min(1, (p.life - p.t) / 0.25))
        var c = ctx
        c.opacity = alpha
        switch p.kind {
        case .coin:
            let sx = abs(cos(p.t * p.spin + p.phase)) * 0.85 + 0.15
            c.translateBy(x: p.x, y: p.y); c.scaleBy(x: sx, y: 1)
            let rect = CGRect(x: -p.r, y: -p.r, width: p.r * 2, height: p.r * 2)
            c.fill(Path(ellipseIn: rect), with: .color(p.color))
            c.stroke(Path(ellipseIn: rect), with: .color(Color(hex: "#c98f12")), lineWidth: p.r * 0.14)
            if sx > 0.5 {
                c.draw(Text("₽").font(.system(size: p.r * 1.15, weight: .heavy)).foregroundColor(Color(hex: "#b07a0c")), at: .zero)
            }
        case .confetti:
            c.translateBy(x: p.x, y: p.y); c.rotate(by: .radians(p.rot))
            let k = abs(cos(p.rot * 2)) * 0.8 + 0.2
            let s = p.r
            var path: Path
            switch p.shape {
            case 1: path = Path(ellipseIn: CGRect(x: -s / 2.4, y: -s / 2.4 * k, width: s / 1.2, height: s / 1.2 * k))
            case 2:
                path = Path(); path.move(to: CGPoint(x: 0, y: -s / 2)); path.addLine(to: CGPoint(x: s / 2, y: s / 2 * k)); path.addLine(to: CGPoint(x: -s / 2, y: s / 2 * k)); path.closeSubpath()
            default: path = Path(CGRect(x: -s / 2, y: -s * 0.3 * k, width: s, height: s * 0.6 * k + 1))
            }
            c.fill(path, with: .color(p.color))
        case .ribbon:
            c.translateBy(x: p.x, y: p.y); c.rotate(by: .radians(p.rot))
            var path = Path()
            for j in 0...10 {
                let yy = (Double(j) / 10 - 0.5) * p.r, xx = sin(Double(j) * 0.9 + p.t * 9 + p.phase) * 5
                if j == 0 { path.move(to: CGPoint(x: xx, y: yy)) } else { path.addLine(to: CGPoint(x: xx, y: yy)) }
            }
            c.stroke(path, with: .color(p.color), style: StrokeStyle(lineWidth: 4, lineCap: .round))
        case .spark:
            var path = Path(); path.move(to: CGPoint(x: p.x, y: p.y)); path.addLine(to: CGPoint(x: p.x - p.vx * 0.035, y: p.y - p.vy * 0.035))
            c.stroke(path, with: .color(p.color), style: StrokeStyle(lineWidth: p.r, lineCap: .round))
        case .flash:
            let ft = (p.t - p.delay) / 0.35, fr = 8 + ft * 34
            c.opacity = alpha * max(0, 1 - ft)
            c.fill(Path(ellipseIn: CGRect(x: p.x - fr, y: p.y - fr, width: fr * 2, height: fr * 2)),
                   with: .radialGradient(Gradient(colors: [.white, p.color, p.color.opacity(0)]), center: CGPoint(x: p.x, y: p.y), startRadius: 0, endRadius: fr))
        case .ring:
            let rt = p.t / p.life, rr = p.r + (p.r2 - p.r) * (1 - pow(1 - rt, 3))
            c.opacity = alpha * (1 - rt)
            let n = DS.festive.count
            for q in 0..<n {
                var arc = Path()
                arc.addArc(center: CGPoint(x: p.x, y: p.y), radius: rr,
                           startAngle: .radians(Double(q) / Double(n) * .pi * 2 + rt * 2),
                           endAngle: .radians(Double(q + 1) / Double(n) * .pi * 2 + rt * 2 - 0.05), clockwise: false)
                c.stroke(arc, with: .color(DS.festive[q]), style: StrokeStyle(lineWidth: 10 * (1 - rt) + 2, lineCap: .round))
            }
        case .star:
            let s = p.r * (0.6 + 0.4 * sin(p.t * 10 + p.phase))
            c.translateBy(x: p.x, y: p.y)
            var path = Path()
            path.move(to: CGPoint(x: 0, y: -s))
            path.addQuadCurve(to: CGPoint(x: s, y: 0), control: .zero)
            path.addQuadCurve(to: CGPoint(x: 0, y: s), control: .zero)
            path.addQuadCurve(to: CGPoint(x: -s, y: 0), control: .zero)
            path.addQuadCurve(to: CGPoint(x: 0, y: -s), control: .zero)
            c.fill(path, with: .color(p.color))
        case .leaf:
            c.translateBy(x: p.x, y: p.y); c.rotate(by: .radians(p.rot + sin(p.t * 2 + p.phase) * 0.6))
            c.fill(Path(ellipseIn: CGRect(x: -p.r, y: -p.r / 2, width: p.r * 2, height: p.r)), with: .color(p.color))
        case .snow:
            c.fill(Path(ellipseIn: CGRect(x: p.x - p.r, y: p.y - p.r, width: p.r * 2, height: p.r * 2)), with: .color(p.color))
        }
    }
}

/// Плашка с радужной рамкой.
struct ToastView: View {
    let text: String
    var body: some View {
        Text(text)
            .font(DS.text(15, .bold))
            .foregroundStyle(DS.ink)
            .multilineTextAlignment(.center)
            .padding(.horizontal, 18).padding(.vertical, 12)
            .background(.white, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous)
                .strokeBorder(LinearGradient(colors: DS.festive, startPoint: .leading, endPoint: .trailing), lineWidth: 2.5))
            .shadow(color: .black.opacity(0.14), radius: 15, y: 10)
            .padding(.horizontal, 24)
    }
}

// MARK: - Встряхивание телефона (акселерометр: на iOS разрешение не нужно)

extension Notification.Name { static let deviceDidShake = Notification.Name("deviceDidShake") }

extension UIWindow {
    open override func motionEnded(_ motion: UIEvent.EventSubtype, with event: UIEvent?) {
        if motion == .motionShake { NotificationCenter.default.post(name: .deviceDidShake, object: nil) }
        super.motionEnded(motion, with: event)
    }
}
