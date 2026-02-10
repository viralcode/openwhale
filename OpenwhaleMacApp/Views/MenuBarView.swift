import SwiftUI

struct MenuBarView: View {
    @EnvironmentObject var appState: AppState
    @Environment(\.openWindow) private var openWindow

    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                HStack(spacing: 8) {
                    Text("🐋")
                        .font(.system(size: 16))
                    Text("OpenWhale")
                        .font(.system(size: 14, weight: .bold, design: .rounded))
                        .foregroundColor(.owTextPrimary)
                }
                Spacer()
                HStack(spacing: 5) {
                    Circle()
                        .fill(appState.isConnected ? Color.owGreen : Color.owRed)
                        .frame(width: 7, height: 7)
                    Text(appState.isConnected ? "Online" : "Offline")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundColor(appState.isConnected ? .owGreen : .owRed)
                }
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(Color.owSurface)
                .clipShape(Capsule())
            }
            .padding(.horizontal, 16)
            .padding(.top, 14)
            .padding(.bottom, 10)

            SubtleDivider()

            if appState.isConnected {
                connectedContent
            } else {
                offlineContent
            }

            SubtleDivider()

            // Footer
            HStack(spacing: 10) {
                Button {
                    openWindow(id: "main-app")
                    NSApp.activate(ignoringOtherApps: true)
                } label: {
                    HStack(spacing: 5) {
                        Image(systemName: "macwindow")
                            .font(.system(size: 11))
                        Text("Open App")
                            .font(.system(size: 12, weight: .semibold))
                    }
                    .foregroundColor(.owPrimary)
                }
                .buttonStyle(.plain)

                Spacer()

                Button {
                    appState.openDashboard()
                } label: {
                    HStack(spacing: 5) {
                        Image(systemName: "globe")
                            .font(.system(size: 11))
                        Text("Web")
                            .font(.system(size: 12, weight: .medium))
                    }
                    .foregroundColor(.owTextSecondary)
                }
                .buttonStyle(.plain)

                Button {
                    NSApp.terminate(nil)
                } label: {
                    Image(systemName: "power")
                        .font(.system(size: 11))
                        .foregroundColor(.owTextTertiary)
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
        }
        .frame(width: 290)
        .background(Color.owBackground)
    }

    // MARK: - Connected

    private var connectedContent: some View {
        VStack(spacing: 0) {
            // Server info
            VStack(spacing: 6) {
                if !appState.serverVersion.isEmpty {
                    InfoRow(label: "Version", value: appState.serverVersion)
                }
                if !appState.activeModel.isEmpty {
                    InfoRow(label: "Model", value: appState.activeModel, valueColor: .owPrimary)
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 10)

            // Channels
            if !appState.channels.isEmpty {
                SubtleDivider()
                VStack(alignment: .leading, spacing: 8) {
                    Text("CHANNELS")
                        .sectionHeader()
                    ForEach(appState.channels) { channel in
                        HStack {
                            Text(channel.name)
                                .font(.owBodyMedium)
                                .foregroundColor(.owTextPrimary)
                            Spacer()
                            HStack(spacing: 5) {
                                Circle()
                                    .fill(channel.connected ? Color.owGreen : Color.owTextTertiary)
                                    .frame(width: 6, height: 6)
                                Text(channel.enabled ? "On" : "Off")
                                    .font(.owCaption)
                                    .foregroundColor(.owTextSecondary)
                            }
                        }
                    }
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 10)
            }

        }
    }

    // MARK: - Offline

    private var offlineContent: some View {
        VStack(spacing: 14) {
            Image(systemName: "antenna.radiowaves.left.and.right.slash")
                .font(.system(size: 28, weight: .ultraLight))
                .foregroundColor(.owTextTertiary)
            Text("Server Offline")
                .font(.owBodyMedium)
                .foregroundColor(.owTextSecondary)
            Button {
                appState.startOpenWhaleService()
            } label: {
                HStack(spacing: 5) {
                    Image(systemName: "play.fill")
                        .font(.system(size: 10))
                    Text("Start OpenWhale")
                        .font(.system(size: 12, weight: .semibold))
                }
                .foregroundColor(.white)
                .padding(.horizontal, 16)
                .padding(.vertical, 7)
                .background(Color.owPrimary)
                .clipShape(RoundedRectangle(cornerRadius: 9, style: .continuous))
            }
            .buttonStyle(.plain)
        }
        .padding(.vertical, 24)
        .frame(maxWidth: .infinity)
    }
}
