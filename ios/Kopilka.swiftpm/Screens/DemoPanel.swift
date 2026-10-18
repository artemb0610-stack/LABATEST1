import SwiftUI

/// Демо-панель для жюри (в приложение не входит).
/// Показывает, что контент-менеджер меняет красивые числа без релиза.
struct DemoPanel: View {
    @EnvironmentObject var store: AppStore
    @Environment(\.dismiss) private var dismiss
    @State private var customAmount = ""
    @State private var newNumber = ""
    @State private var newStyle = "same-digits"
    @State private var newBadge = ""
    @State private var json = ""
    @State private var jsonError = ""
    @State private var loading = false

    private let presets = [995, 1000, 1230, 1234, 7777, 12321, 4990, 2020]

    var body: some View {
        NavigationStack {
            Form {
                Section("Сумма в копилке «Самокат»") {
                    LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 6), count: 4), spacing: 6) {
                        ForEach(presets, id: \.self) { v in
                            Button(Rub.group(v)) { set(v) }
                                .buttonStyle(.bordered).font(DS.text(13, .semibold))
                        }
                    }
                    HStack {
                        TextField("своя сумма", text: $customAmount).keyboardType(.numberPad)
                        Button("Поставить") { set(Int(customAmount.filter(\.isNumber)) ?? 0) }
                    }
                }

                Section {
                    if let rules = store.raw?.rules?.items {
                        ForEach(Array(rules.enumerated()), id: \.offset) { i, r in
                            Toggle(isOn: Binding(
                                get: { r.enabled != false },
                                set: { on in store.editConfig { $0.rules?.items[i].enabled = on } }
                            )) {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(ruleName(r)).font(DS.text(15, .semibold))
                                    Text(ruleExample(r)).font(DS.text(12)).foregroundStyle(.secondary)
                                }
                            }
                            .tint(DS.green)
                            .swipeActions {
                                if (r.id ?? "").hasPrefix("custom-") {
                                    Button(role: .destructive) { store.editConfig { _ = $0.rules?.items.remove(at: i) } } label: { Label("Удалить", systemImage: "trash") }
                                }
                            }
                        }
                    } else {
                        Text("Конфиг не загружен — эффекты выключены, приложение работает как обычно").foregroundStyle(.secondary)
                    }
                } header: { Text("Красивые числа — правка без релиза (CMS)") } footer: { Text("Свои числа удаляются свайпом влево.") }

                Section("Добавить своё число") {
                    TextField("Число, например 2026", text: $newNumber).keyboardType(.numberPad)
                    Picker("Оформление", selection: $newStyle) {
                        ForEach((store.raw?.styles ?? [:]).keys.sorted(), id: \.self) { Text(styleName($0)).tag($0) }
                    }
                    TextField("Текст плашки: «Число этого года!»", text: $newBadge)
                    Button("Добавить и показать") { addNumber() }.disabled(Int(newNumber) ?? 0 <= 0)
                }

                Section("Сезон") {
                    Picker("Частицы", selection: $store.seasonOverride) {
                        Text("По дате").tag("auto")
                        ForEach(store.cfg.seasons, id: \.id) { Text($0.id == "autumn" ? "Осень" : $0.id == "winter" ? "Зима" : $0.id).tag($0.id) }
                        Text("Без сезона").tag("none")
                    }
                    .pickerStyle(.segmented)
                }

                Section {
                    Button(loading ? "Загружаю…" : "Загрузить свежий конфиг из CMS (GitHub)") {
                        loading = true
                        Task { await store.refreshFromCMS(); loading = false; json = ConfigStore.encode(store.raw ?? RawConfig()) }
                    }
                    Button("Сломать конфиг", role: .destructive) { store.apply(nil, status: "Конфиг битый — эффекты выключены, приложение работает") }
                    Button("Сброс на встроенный") { store.apply(ConfigStore.bundled(), status: "✓ Встроенный конфиг") }
                    Text(store.configStatus).font(DS.text(13)).foregroundStyle(.secondary)
                    ForEach(store.cfg.warnings, id: \.self) { Text($0).font(DS.text(12)).foregroundStyle(.orange) }
                } header: { Text("Конфиг") }

                Section("Для разработчика: JSON по ключу CMS") {
                    TextEditor(text: $json)
                        .font(.system(size: 11, design: .monospaced))
                        .frame(minHeight: 220)
                        .autocorrectionDisabled()
                        .textInputAutocapitalization(.never)
                    Button("Применить без релиза") {
                        if let r = ConfigStore.decode(Data(json.utf8)) { store.apply(r, status: "✓ Применено без релиза"); jsonError = "" }
                        else { store.apply(nil, status: "JSON не разобрался — эффекты выключены"); jsonError = "JSON не разобрался — эффекты выключены, приложение работает как обычно" }
                    }
                    if !jsonError.isEmpty { Text(jsonError).font(DS.text(12)).foregroundStyle(.red) }
                }
            }
            .navigationTitle("Демо для жюри")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Готово") { dismiss() } } }
            .onAppear { json = ConfigStore.encode(store.raw ?? RawConfig()) }
        }
    }

    private func set(_ v: Int) {
        dismiss()
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) { store.demoSet(v) }
    }

    private func addNumber() {
        guard let n = Int(newNumber), n > 0 else { return }
        let badge = newBadge.trimmingCharacters(in: .whitespaces).isEmpty ? "Особое число!" : newBadge
        store.editConfig { c in
            var items = c.rules?.items ?? []
            items.removeAll { $0.id == "custom-\(n)" }
            items.insert(RawRule(id: "custom-\(n)", type: "exact", values: [n], minLength: nil, minZeros: nil, pattern: nil,
                                 style: newStyle, badge: badge, effects: ["confetti", "fireworks", "coins"], enabled: true), at: 0)
            c.rules = LossyArray(items)
        }
        newNumber = ""; newBadge = ""
        set(n)
    }

    private func ruleName(_ r: RawRule) -> String {
        switch r.type {
        case "exact":
            let nums = (r.values ?? []).map { Rub.group($0) }.joined(separator: ", ")
            return (r.id ?? "").hasPrefix("bn-") ? "Как купюра \(nums)" : "Число \(nums)"
        case "repdigit": return "Одинаковые цифры"
        case "sequence": return "Цифры по порядку"
        case "palindrome": return "Зеркальные"
        case "regex": return "Повторяющиеся пары"
        case "round": return "Круглые"
        default: return r.type
        }
    }

    private func ruleExample(_ r: RawRule) -> String {
        let ex: String
        switch r.type {
        case "repdigit": ex = "777, 2 222, 7 777"
        case "sequence": ex = "123, 1 234, 4 321"
        case "palindrome": ex = "1 221, 12 321"
        case "regex": ex = "1 212, 2 020"
        case "round": ex = "300, 2 500, 10 000"
        default: ex = r.badge ?? ""
        }
        return ex + " · " + styleName(r.style)
    }

    private func styleName(_ k: String) -> String {
        [ "banknote-100": "Купюра 100", "banknote-500": "Купюра 500", "banknote-1000": "Купюра 1 000",
          "banknote-2000": "Купюра 2 000", "banknote-5000": "Купюра 5 000", "same-digits": "Переливы",
          "counting": "Кубики", "mirror": "Зеркало", "round": "Зелёное", "strict": "Строгий" ][k] ?? k
    }
}
