import SwiftUI
import AppKit

class AppDelegate: NSObject, NSApplicationDelegate {
    func applicationDidFinishLaunching(_ notification: Notification) {
        // Set app icon from bundle resources
        if let iconPath = Bundle.main.path(forResource: "AppIcon", ofType: "icns"),
           let icon = NSImage(contentsOfFile: iconPath) {
            NSApp.applicationIconImage = icon
        } else if let logoPath = Bundle.main.path(forResource: "logo", ofType: "png"),
                  let icon = NSImage(contentsOfFile: logoPath) {
            NSApp.applicationIconImage = icon
        }
    }
}

@main
struct OpenWhaleMenuBarApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) var appDelegate
    @StateObject private var appState = AppState()
    @Environment(\.openWindow) private var openWindow

    var body: some Scene {
        MenuBarExtra {
            MenuBarView()
                .environmentObject(appState)
        } label: {
            Text("🐋")
        }
        .menuBarExtraStyle(.window)

        Window("OpenWhale", id: "main-app") {
            NativeAppView()
                .environmentObject(appState)
                .onAppear {
                    NSApp.activate(ignoringOtherApps: true)
                    if let window = NSApp.windows.first(where: { $0.title == "OpenWhale" }) {
                        window.makeKeyAndOrderFront(nil)
                    }
                }
        }
        .defaultSize(width: 1000, height: 700)
    }
}

