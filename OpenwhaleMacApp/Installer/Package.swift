// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "OpenWhaleInstaller",
    platforms: [.macOS(.v13)],
    targets: [
        .executableTarget(
            name: "OpenWhaleInstaller",
            path: ".",
            exclude: ["build.sh", "AppIcon.icns", "Info.plist"]
        )
    ]
)
