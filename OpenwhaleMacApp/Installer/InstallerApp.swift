import SwiftUI
import AppKit

@main
struct OpenWhaleInstallerApp: App {
    @NSApplicationDelegateAdaptor(InstallerAppDelegate.self) var appDelegate
    @StateObject private var state = InstallerState()

    var body: some Scene {
        WindowGroup {
            InstallerView()
                .environmentObject(state)
                .frame(minWidth: 720, minHeight: 560)
                .onAppear {
                    NSApp.activate(ignoringOtherApps: true)
                }
        }
        .defaultSize(width: 780, height: 600)
        .windowResizability(.contentSize)
    }
}

class InstallerAppDelegate: NSObject, NSApplicationDelegate {
    func applicationDidFinishLaunching(_ notification: Notification) {
        if let iconPath = Bundle.main.path(forResource: "AppIcon", ofType: "icns"),
           let icon = NSImage(contentsOfFile: iconPath) {
            NSApp.applicationIconImage = icon
        }
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        return true
    }
}
