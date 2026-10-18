// swift-tools-version: 5.9

// Приложение-прототип для iOS. Открывается двойным кликом в Xcode (или в Swift Playgrounds на Mac/iPad).
// В Xcode: выбрать свой iPhone вверху → Signing & Capabilities → Team = свой Apple ID → ▶︎ Run.

import PackageDescription
import AppleProductTypes

let package = Package(
    name: "Kopilka",
    platforms: [
        .iOS("17.0")
    ],
    products: [
        .iOSApplication(
            name: "Копилка",
            targets: ["AppModule"],
            bundleIdentifier: "ru.hackathon.kopilka.prettynumbers",
            teamIdentifier: "",
            displayVersion: "1.0",
            bundleVersion: "1",
            accentColor: .presetColor(.green),
            supportedDeviceFamilies: [
                .phone
            ],
            supportedInterfaceOrientations: [
                .portrait
            ]
        )
    ],
    targets: [
        .executableTarget(
            name: "AppModule",
            path: ".",
            exclude: ["README.md"],
            resources: [
                .process("Resources")
            ]
        )
    ]
)
