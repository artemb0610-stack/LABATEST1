import SwiftUI

/// Экран копилки — здесь живёт прикол «красивые числа».
struct PiggyView: View {
    @EnvironmentObject var store: AppStore
    let id: String

    @State private var shown: Int? = nil        // сумма во время «досчёта» после пополнения
    @State private var partyTick = 0
    @State private var popTick = false
    @State private var shine = false
    @State private var showTapHint = false
    @State private var amountFrame: CGRect = .zero
    @State private var showThemes = false
    @State private var soundOn = false

    private var p: Piggy { store.piggy(id) ?? store.piggies[0] }
    private var value: Int { shown ?? p.amount }
    private var hit: PrettyEngine.Hit? { shown == nil ? PrettyEngine.classify(p.amount, store.cfg) : nil }

    var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                hero
                GradButton(title: "Пополнить копилку") { store.push(.topup(id)) }
                Text("История копилки").font(DS.display(24)).frame(maxWidth: .infinity, alignment: .leading).padding(.top, 12).padding(.horizontal, 4)
                OpsList(ops: p.history)
            }
            .padding(.horizontal, 16)
            .padding(.bottom, 40)
        }
        .background(alignment: .top) {
            LinearGradient(colors: [Color(hex: "#f6eda6"), Color(hex: "#f8e2c4"), Color(hex: "#f3c2dc")], startPoint: .leading, endPoint: .trailing)
                .frame(height: 260).mask(LinearGradient(colors: [.black, .clear], startPoint: .top, endPoint: .bottom))
                .ignoresSafeArea()
        }
        .screenBackground()
        .navigationTitle(p.name)
        .navigationBarTitleDisplayMode(.inline)
        .toolbarRole(.editor)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    soundOn.toggle(); store.fx.soundOn = soundOn
                } label: {
                    Image(systemName: soundOn ? "speaker.wave.2.fill" : "speaker.slash.fill").foregroundStyle(DS.ink)
                }
                .accessibilityLabel(soundOn ? "Звук включён" : "Звук выключен")
            }
        }
        .sheet(isPresented: $showThemes) { ThemePicker(value: p.amount).environmentObject(store).presentationDetents([.large]) }
        .onAppear {
            soundOn = store.fx.soundOn
            let d = UserDefaults.standard   // только для CI-скриншотов
            if d.string(forKey: "kbScreen") == "themes" { DispatchQueue.main.asyncAfter(deadline: .now() + 0.6) { showThemes = true } }
            if d.bool(forKey: "kbParty") { DispatchQueue.main.asyncAfter(deadline: .now() + 1.2) { tapAmount() } }
            if let t = store.pendingTopup, t.id == id {
                store.pendingTopup = nil
                animateTopup(from: t.from, to: t.to)
            } else {
                autoShow()
            }
        }
        .onChange(of: store.demoTick) { _, _ in autoShow() }
        .onReceive(NotificationCenter.default.publisher(for: .deviceDidShake)) { _ in shake() }
    }

    // MARK: карточка с суммой

    private var hero: some View {
        VStack(spacing: 0) {
            HStack {
                Spacer()
                Button { showThemes = true } label: {
                    HStack(spacing: 4) {
                        Image(systemName: "paintpalette.fill").foregroundStyle(DS.violet)
                        Text("Цифры").font(DS.text(13, .bold)).foregroundStyle(Color(hex: "#6b7380"))
                    }
                    .padding(.horizontal, 12).padding(.vertical, 8)
                    .background(DS.bg, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                }
                .buttonStyle(PressStyle())
            }
            Text(p.pic).font(.system(size: 60))
                .frame(width: 112, height: 112)
                .background(p.bg, in: RoundedRectangle(cornerRadius: 30, style: .continuous))
                .padding(.top, -18)

            ZStack {
                PartyHalo(tick: partyTick)
                AmountDigits(value: value, spec: shown == nil ? store.style(for: hit) : nil, size: 52, partyTick: partyTick)
                    .overlay { ShineSweep(on: shine) }
                    .scaleEffect(popTick ? 1.1 : 1)
                    .background(GeometryReader { g in
                        Color.clear
                            .onAppear { amountFrame = g.frame(in: .global) }
                            .onChange(of: g.frame(in: .global)) { _, f in amountFrame = f }
                    })
                    .contentShape(Rectangle())
                    .onTapGesture { tapAmount() }
                    .accessibilityAddTraits(.isButton)
            }
            .frame(minHeight: 100)
            .padding(.top, 16)

            if showTapHint, let h = hit, !store.cfg.tapHint.isEmpty {
                let s = store.style(for: h) ?? h.style
                Text(store.cfg.tapHint)
                    .font(DS.text(13, .bold))
                    .foregroundStyle(s.pattern == .blocks || s.pattern == .strict ? DS.ink : s.color)
                    .padding(.horizontal, 12).padding(.vertical, 5)
                    .background(Capsule().fill(.white))
                    .overlay(Capsule().strokeBorder(s.color.opacity(0.18)))
                    .padding(.top, 6)
                    .transition(.scale.combined(with: .opacity))
                    .phaseAnimator([CGFloat(0), CGFloat(-3)]) { v, ph in v.offset(y: ph) } animation: { _ in .easeInOut(duration: 1.2) }
            }

            VStack(spacing: 10) {
                HStack {
                    Text("\(percent(value))% накоплено").font(DS.text(14, .bold))
                    Spacer()
                    Text("из " + Rub.format(p.goal)).font(DS.text(14)).foregroundStyle(DS.muted)
                }
                ProgressBar(value: Double(value) / Double(max(1, p.goal)), height: 14, marks: [0.25, 0.5, 0.75])
            }
            .padding(.top, 16)
        }
        .padding(20)
        .background(DS.card, in: RoundedRectangle(cornerRadius: DS.rCard, style: .continuous))
    }

    private func percent(_ v: Int) -> Int { min(100, Int((Double(v) / Double(max(1, p.goal)) * 100).rounded())) }

    // MARK: эффекты

    /// Автоматически — только тихий намёк (блик + «Нажми на цифры»). Режим задаётся конфигом.
    private func autoShow() {
        showTapHint = false
        guard let h = hit else { return }
        switch store.cfg.autoMode {
        case "off": return
        case "full": party(h)
        default:
            shine = false
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) { shine = true }
            withAnimation(.spring(response: 0.4, dampingFraction: 0.7).delay(0.3)) { showTapHint = true }
        }
    }

    private func tapAmount() {
        if let h = hit { party(h) } else { store.fx.haptic(.light); bump() }
    }

    private func shake() {
        if let h = hit { party(h) }
        else if store.cfg.enabled {
            store.fx.play([.coins], origin: amountFrame, duration: 1.0)
            store.fx.haptic(.coin); store.fx.chime()
        }
    }

    private func bump() {
        withAnimation(.spring(response: 0.2, dampingFraction: 0.5)) { popTick = true }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.18) { withAnimation(.spring()) { popTick = false } }
    }

    /// Праздник: вариант анимации из конфига + радужная волна + сезонные частицы,
    /// цифры перекатываются и подпрыгивают, плашка, вибрация, звук (если включён).
    private func party(_ h: PrettyEngine.Hit) {
        let cfg = store.cfg
        var kinds: [EffectKind] = [h.rule.effects.randomElement() ?? .confetti, .burst]
        let season = store.season()
        if let sp = season?.particles { kinds.append(sp) }
        let s = store.style(for: h) ?? h.style
        store.fx.play(kinds, origin: amountFrame, palette: [s.color, s.accent] + s.palette, duration: cfg.maxEffect)
        let prefix = (season?.badgePrefix ?? "").isEmpty ? "" : season!.badgePrefix + " "
        store.fx.showToast(prefix + h.rule.badge)
        store.fx.haptic(.party); store.fx.chime()
        partyTick += 1
        bump()
        withAnimation { showTapHint = false }
    }

    // MARK: пополнение

    /// Монетка падает в копилку, сумма «досчитывается», затем — красивое число и/или этап цели.
    private func animateTopup(from: Int, to: Int) {
        shown = from
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) {
            if store.cfg.enabled && store.cfg.topupEnabled {
                var top = amountFrame; top.origin.y -= amountFrame.height / 2
                store.fx.play([.coinDrop], origin: top, duration: 0.9)
                store.fx.haptic(.coin); store.fx.chime()
            }
            let steps = 24
            for i in 1...steps {
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.65 * Double(i) / Double(steps)) {
                    let k = Double(i) / Double(steps), e = 1 - pow(1 - k, 3)
                    shown = from + Int((Double(to - from) * e).rounded())
                    if i == steps { shown = nil; afterTopup(from: from, to: to) }
                }
            }
        }
    }

    private func afterTopup(from: Int, to: Int) {
        let cfg = store.cfg
        guard cfg.enabled else { return }
        var celebrated = false
        if let h = PrettyEngine.classify(to, cfg) {
            celebrated = true
            if cfg.autoOnTopup == "full" { party(h) } else if cfg.autoOnTopup == "hint" { autoShow() }
        }
        if cfg.milestonesEnabled {
            let crossed = PrettyEngine.crossedMilestones(from: from, to: to, goal: p.goal, percents: cfg.milestonePercents)
            if let top = crossed.last {
                let text = PrettyEngine.fill(cfg.milestoneTexts[String(top)] ?? "Пройдено \(top)% пути к цели!", ["goal": Rub.format(p.goal)])
                store.fx.play(cfg.milestoneEffects + [.burst], origin: amountFrame,
                              palette: [DS.green, Color(hex: "#c4f23a"), Color(hex: "#7fd6f7")], duration: cfg.maxEffect)
                store.fx.showToast(text, seconds: 2.0)
                if !celebrated { store.fx.haptic(.party); store.fx.chime(); partyTick += 1 }
                celebrated = true
            }
        }
        if !celebrated { store.fx.play([.sparkles], origin: amountFrame, duration: 0.9) }
    }
}

/// Однократный блик по сумме — тихий намёк, что число особенное.
struct ShineSweep: View {
    var on: Bool
    @State private var x: CGFloat = -1
    var body: some View {
        GeometryReader { g in
            LinearGradient(colors: [.clear, .white.opacity(0.75), .clear], startPoint: .leading, endPoint: .trailing)
                .frame(width: g.size.width * 0.5)
                .offset(x: x * g.size.width)
                .opacity(on ? 1 : 0)
        }
        .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
        .allowsHitTesting(false)
        .onChange(of: on) { _, v in
            guard v else { x = -1; return }
            x = -0.6
            withAnimation(.easeOut(duration: 1.1)) { x = 1.2 }
        }
    }
}

// MARK: - Экран пополнения (перевод — эффектов здесь нет)

struct TopupView: View {
    @EnvironmentObject var store: AppStore
    let id: String
    @State private var text = ""
    @State private var error: String? = nil
    @State private var done = false
    @FocusState private var focused: Bool

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                VStack(alignment: .leading, spacing: 16) {
                    HStack(spacing: 14) {
                        Image(systemName: "arrow.right").font(.system(size: 18, weight: .bold)).foregroundStyle(DS.blue)
                            .frame(width: 50, height: 50).background(DS.blueBg, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Со счёта").font(DS.text(14)).foregroundStyle(DS.muted)
                            Text(Rub.format(store.balance)).font(DS.display(18))
                        }
                    }
                    Text("Сколько отложить").font(DS.text(14)).foregroundStyle(DS.muted)
                    TextField("0 ₽", text: $text)
                        .keyboardType(.numberPad)
                        .font(DS.display(36))
                        .focused($focused)
                        .onChange(of: text) { _, v in
                            let digits = v.filter(\.isNumber)
                            if digits != v { text = digits }
                            error = nil
                        }
                    Rectangle().fill(focused ? DS.green : DS.line).frame(height: 2)
                    LazyVGrid(columns: [GridItem(.adaptive(minimum: 84), spacing: 8)], alignment: .leading, spacing: 8) {
                        ForEach([10, 20, 50, 100, 200, 500], id: \.self) { add in
                            Button {
                                text = String((Int(text) ?? 0) + add); store.fx.haptic()
                            } label: {
                                Text("+\(add) ₽").font(DS.text(14, .bold)).foregroundStyle(DS.ink)
                                    .padding(.horizontal, 14).padding(.vertical, 10)
                                    .background(DS.bg, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                            }
                        }
                    }
                    if let error { Text(error).font(DS.text(14)).foregroundStyle(Color(hex: "#e5484d")) }
                }
                .padding(22)
                .background(DS.card, in: RoundedRectangle(cornerRadius: DS.rCard, style: .continuous))

                GradButton(title: "Отложить в копилку", icon: nil) { submit() }
                    .disabled(done)
            }
            .padding(16)
        }
        .scrollDismissesKeyboard(.interactively)
        .screenBackground()
        .navigationTitle("Пополнить копилку")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear { store.fx.forbidden = true }
        .onDisappear { store.fx.forbidden = false }
    }

    private func submit() {
        guard !done else { return }                   // двойной тап не спишет деньги дважды
        if let e = store.topup(id, Int(text) ?? 0) { error = e; store.fx.haptic(); return }
        done = true
        focused = false
        // Возвращаемся в копилку — праздник запускается уже там, а не на экране перевода
        if store.tab == .piggies, !store.piggiesPath.isEmpty { store.piggiesPath.removeLast() }
        else if !store.homePath.isEmpty { store.homePath.removeLast() }
    }
}
