import SwiftUI

struct Op: Identifiable {
    let id = UUID()
    var title: String
    var sub: String
    var sum: Int
    var icon: String
    var tint: Color
    var bg: Color
}

struct Piggy: Identifiable {
    let id: String
    var name: String
    var pic: String
    var bg: Color
    var amount: Int
    var goal: Int
    var history: [Op] = []
}

enum Tab { case home, piggies }

enum Route: Hashable { case piggy(String), topup(String), history, pay }

/// Состояние демо-приложения. В СберKids это данные существующих экранов (счёт, копилки),
/// а от нас — только конфиг и выбранное оформление цифр.
final class AppStore: ObservableObject {
    @Published var tab: Tab = .home
    @Published var homePath: [Route] = []
    @Published var piggiesPath: [Route] = []

    @Published var balance = 3250
    let balanceKop = 40
    @Published var piggies: [Piggy] = [
        Piggy(id: "scooter", name: "Самокат", pic: "🛴", bg: Color(hex: "#fff3e0"), amount: 980, goal: 5000, history: [
            Op(title: "Отложено со счёта", sub: "вчера", sum: 200, icon: "arrow.down", tint: DS.greenInk, bg: Color(hex: "#e3f8de")),
            Op(title: "Отложено со счёта", sub: "12 октября", sum: 500, icon: "arrow.down", tint: DS.greenInk, bg: Color(hex: "#e3f8de")),
            Op(title: "Подарок от бабушки", sub: "5 октября", sum: 280, icon: "gift.fill", tint: DS.peach, bg: DS.peachBg)
        ]),
        Piggy(id: "boots", name: "Резиновые сапоги", pic: "🥾", bg: Color(hex: "#ffe9e4"), amount: 450, goal: 500),
        Piggy(id: "slime", name: "Слайм розовый", pic: "🫧", bg: Color(hex: "#eceaff"), amount: 580, goal: 700),
        Piggy(id: "pens", name: "Фломастеры", pic: "🖍️", bg: Color(hex: "#e6f4ff"), amount: 100, goal: 200),
        Piggy(id: "robot", name: "Робот", pic: "🤖", bg: Color(hex: "#e4f7f4"), amount: 3950, goal: 12000)
    ]
    @Published var homeHistory: [Op] = [
        Op(title: "Канцтовары", sub: "Покупка", sum: -240, icon: "cart.fill", tint: Color(hex: "#9fa4e8"), bg: Color(hex: "#ecebff")),
        Op(title: "В копилку «Самокат»", sub: "Перевод", sum: -200, icon: "arrow.down", tint: DS.greenInk, bg: Color(hex: "#e3f8de")),
        Op(title: "От мамы", sub: "Пополнение", sum: 500, icon: "gift.fill", tint: DS.peach, bg: DS.peachBg)
    ]

    // Конфиг «без релиза»
    @Published private(set) var raw: RawConfig?
    @Published private(set) var cfg: PrettyConfig = .off
    @Published var configStatus = ""
    @Published var seasonOverride = "auto"   // auto | <id> | none

    // Выбранное ребёнком оформление цифр — хранится только на устройстве
    @Published var theme: String = UserDefaults.standard.string(forKey: "kb.digits.theme") ?? "auto" {
        didSet { UserDefaults.standard.set(theme, forKey: "kb.digits.theme") }
    }

    /// Пополнение, которое надо «досчитать» на экране копилки после возврата с экрана перевода.
    var pendingTopup: (id: String, from: Int, to: Int)?

    let fx = FX()

    init() {
        // Сразу — локальный конфиг (кэш или встроенный), главный экран сеть не ждёт.
        apply(ConfigStore.loadLocal(), status: "Конфиг: сохранённый на устройстве")
        Task { await refreshFromCMS() }
    }

    func apply(_ r: RawConfig?, status: String? = nil) {
        raw = r
        cfg = PrettyConfig.sanitize(r)
        if let status { configStatus = status }
    }

    @MainActor
    func refreshFromCMS() async {
        if let r = await ConfigStore.fetchRemote() {
            apply(r, status: "✓ Конфиг загружен из CMS (GitHub)")
        } else {
            configStatus = "Нет сети — работаем на сохранённом конфиге"
        }
    }

    /// Правка конфига «руками контент-менеджера» прямо в демо-панели.
    func editConfig(_ change: (inout RawConfig) -> Void) {
        guard var r = raw else { return }
        change(&r)
        apply(r, status: "✓ Применено без релиза")
    }

    /// Открыть экран в текущей вкладке.
    func push(_ r: Route) { if tab == .home { homePath.append(r) } else { piggiesPath.append(r) } }

    func piggy(_ id: String) -> Piggy? { piggies.first { $0.id == id } }
    func index(_ id: String) -> Int? { piggies.firstIndex { $0.id == id } }

    var totalSaved: Int { piggies.reduce(0) { $0 + $1.amount } }

    /// Стиль суммы: выбранное оформление, а в «Авто» — стиль красивого числа (или обычные цифры).
    func style(for hit: PrettyEngine.Hit?) -> PrettyStyleSpec? {
        if cfg.enabled, let t = cfg.themes.first(where: { $0.id == theme }), let key = t.styleKey, let s = cfg.styles[key] { return s }
        return hit?.style
    }

    func season() -> Season? {
        switch seasonOverride {
        case "none": return nil
        case "auto": return PrettyEngine.activeSeason(cfg)
        default: return cfg.seasons.first { $0.id == seasonOverride }
        }
    }

    /// Перевод в копилку. Проверки — как на настоящем экране перевода.
    func topup(_ id: String, _ sum: Int) -> String? {
        guard sum > 0 else { return "Введи сумму" }
        guard sum <= balance else { return "На счёте столько нет" }
        guard let i = index(id) else { return "Копилка не найдена" }
        let from = piggies[i].amount
        balance -= sum
        piggies[i].amount += sum
        piggies[i].history.insert(Op(title: "Отложено со счёта", sub: "только что", sum: sum, icon: "arrow.down", tint: DS.greenInk, bg: Color(hex: "#e3f8de")), at: 0)
        homeHistory.insert(Op(title: "В копилку «\(piggies[i].name)»", sub: "Перевод", sum: -sum, icon: "arrow.down", tint: DS.greenInk, bg: Color(hex: "#e3f8de")), at: 0)
        if homeHistory.count > 3 { homeHistory.removeLast(homeHistory.count - 3) }
        pendingTopup = (id, from, piggies[i].amount)
        return nil
    }

    /// Демо: поставить сумму в копилку «Самокат» и открыть её.
    func demoSet(_ amount: Int) {
        guard let i = index("scooter") else { return }
        piggies[i].amount = min(99_999_999, max(0, amount))
        tab = .piggies
        homePath = []
        piggiesPath = [.piggy("scooter")]
        demoTick += 1
    }
    @Published var demoTick = 0
}
