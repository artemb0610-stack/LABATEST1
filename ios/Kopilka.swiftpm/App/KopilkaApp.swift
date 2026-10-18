import SwiftUI
import UIKit

@main
struct KopilkaApp: App {
    @StateObject private var store = AppStore()

    init() {
        // Кнопка «назад» — только стрелка, без подписи (как в макетах СберKids) на всех экранах.
        let hidden: [NSAttributedString.Key: Any] = [.foregroundColor: UIColor.clear, .font: UIFont.systemFont(ofSize: 0.1)]
        let standard = UINavigationBarAppearance()
        standard.configureWithDefaultBackground()
        standard.backButtonAppearance.normal.titleTextAttributes = hidden
        standard.backButtonAppearance.highlighted.titleTextAttributes = hidden
        let edge = UINavigationBarAppearance()
        edge.configureWithTransparentBackground()
        edge.backButtonAppearance.normal.titleTextAttributes = hidden
        edge.backButtonAppearance.highlighted.titleTextAttributes = hidden
        UINavigationBar.appearance().standardAppearance = standard
        UINavigationBar.appearance().compactAppearance = standard
        UINavigationBar.appearance().scrollEdgeAppearance = edge
        UINavigationBar.appearance().tintColor = UIColor(red: 0.17, green: 0.70, blue: 0.30, alpha: 1)
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(store)
                .environmentObject(store.fx)
                .preferredColorScheme(.light)
        }
    }
}

struct RootView: View {
    @EnvironmentObject var store: AppStore
    @State private var showDemo = false

    private var atRoot: Bool {
        store.tab == .home ? store.homePath.isEmpty : store.piggiesPath.isEmpty
    }

    var body: some View {
        ZStack(alignment: .bottom) {
            Group {
                switch store.tab {
                case .home:
                    NavigationStack(path: $store.homePath) {
                        HomeView().navigationDestination(for: Route.self) { RouteView(route: $0) }
                    }
                case .piggies:
                    NavigationStack(path: $store.piggiesPath) {
                        PiggiesView().navigationDestination(for: Route.self) { RouteView(route: $0) }
                    }
                }
            }

            if atRoot {
                TabBar()
                    .padding(.horizontal, 16)
                    .padding(.bottom, 6)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
            }

            // Слой эффектов: поверх всего, касания пропускает
            FXOverlay(fx: store.fx)

            // Демо-панель для жюри (в приложение не входит)
            HStack {
                Spacer()
                Button { showDemo = true } label: {
                    Image(systemName: "gearshape.fill")
                        .font(.system(size: 14))
                        .foregroundStyle(DS.ink.opacity(0.35))
                        .frame(width: 32, height: 32)
                        .background(DS.ink.opacity(0.06), in: Circle())
                }
                .padding(.trailing, 10)
                .padding(.bottom, atRoot ? 96 : 12)
            }
        }
        .animation(.easeInOut(duration: 0.25), value: atRoot)
        .sheet(isPresented: $showDemo) { DemoPanel().environmentObject(store) }
        .onAppear { applyLaunchArguments() }
    }
}

extension RootView {
    /// Аргументы запуска для автоматических скриншотов в CI (на обычный запуск не влияют):
    /// -kbScreen home|piggies|piggy|themes|history|demo  -kbAmount 1234  -kbTheme cubes  -kbParty YES  -kbHistoryEnd YES
    func applyLaunchArguments() {
        let d = UserDefaults.standard
        guard let screen = d.string(forKey: "kbScreen") else { return }
        if let t = d.string(forKey: "kbTheme") { store.theme = t }
        if let a = d.string(forKey: "kbAmount"), let v = Int(a), let i = store.index("scooter") { store.piggies[i].amount = v }
        switch screen {
        case "piggies": store.tab = .piggies
        case "piggy", "themes": store.tab = .piggies; store.piggiesPath = [.piggy("scooter")]
        case "history": store.tab = .home; store.homePath = [.history]
        case "demo": showDemo = true
        default: break
        }
    }
}

struct RouteView: View {
    let route: Route
    var body: some View {
        switch route {
        case .piggy(let id): PiggyView(id: id)
        case .topup(let id): TopupView(id: id)
        case .history: HistoryView()
        case .pay: PayStubView()
        }
    }
}

struct TabBar: View {
    @EnvironmentObject var store: AppStore
    var body: some View {
        HStack {
            item("house.fill", "Главный", active: store.tab == .home) { switchTo(.home) }
            item("dollarsign.circle.fill", "Копилки", active: store.tab == .piggies) { switchTo(.piggies) }
            Button { store.fx.haptic() } label: {
                Image(systemName: "sparkles")
                    .font(.system(size: 24, weight: .bold))
                    .foregroundStyle(.white)
                    .frame(width: 56, height: 56)
                    .background(DS.grad, in: Circle())
                    .shadow(color: DS.green.opacity(0.45), radius: 8, y: 4)
            }
            .frame(maxWidth: .infinity)
            item("checkmark.circle.fill", "Дела", active: false) { store.fx.haptic() }
            item("sparkle", "Контент", active: false) { store.fx.haptic() }
        }
        .frame(height: 76)
        .background(.white.opacity(0.96), in: RoundedRectangle(cornerRadius: 26, style: .continuous))
        .shadow(color: .black.opacity(0.08), radius: 15, y: 6)
    }

    private func switchTo(_ t: Tab) {
        if store.tab == t { if t == .home { store.homePath = [] } else { store.piggiesPath = [] } }
        store.tab = t
    }

    private func item(_ icon: String, _ title: String, active: Bool, _ action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(spacing: 4) {
                Image(systemName: icon).font(.system(size: 22))
                Text(title).font(DS.text(11, .semibold))
            }
            .foregroundStyle(active ? DS.greenInk : Color(hex: "#b5bcc6"))
            .frame(maxWidth: .infinity)
        }
    }
}
