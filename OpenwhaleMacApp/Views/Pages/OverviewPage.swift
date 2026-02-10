import SwiftUI

struct OverviewPage: View {
    @EnvironmentObject var appState: AppState

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                // Header
                HStack(alignment: .bottom) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Dashboard")
                            .font(.owLargeTitle)
                            .foregroundColor(.owTextPrimary)
                        Text("System overview and activity")
                            .font(.owBody)
                            .foregroundColor(.owTextSecondary)
                    }
                    Spacer()
                    Button {
                        Task { await appState.refreshDashboardData() }
                    } label: {
                        Image(systemName: "arrow.clockwise")
                            .font(.system(size: 13, weight: .medium))
                            .foregroundColor(.owTextSecondary)
                            .frame(width: 32, height: 32)
                            .background(Color.owSurface)
                            .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                    }
                    .buttonStyle(.plain)
                }

                // Stats Grid — 4 columns
                LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 14), count: 4), spacing: 14) {
                    StatTile(icon: "person.2", value: "\(appState.stats.users)", label: "Users", iconColor: .owPrimary)
                    StatTile(icon: "bubble.left.and.text.bubble.right", value: "\(appState.stats.sessions)", label: "Sessions", iconColor: .owCyan)
                    StatTile(icon: "text.bubble", value: "\(appState.stats.messages)", label: "Messages", iconColor: .owPink)
                    StatTile(icon: "sparkles", value: "\(appState.stats.totalTokens)", label: "Tokens Used", iconColor: .owOrange)
                }

                // Two-column layout
                HStack(alignment: .top, spacing: 14) {
                    // Left column — Server Info
                    VStack(alignment: .leading, spacing: 14) {
                        SectionCard(title: "Server", icon: "server.rack") {
                            VStack(spacing: 8) {
                                InfoRow(label: "Status", value: appState.isConnected ? "Online" : "Offline",
                                        valueColor: appState.isConnected ? .owGreen : .owRed)
                                if !appState.serverVersion.isEmpty {
                                    InfoRow(label: "Version", value: appState.serverVersion, valueColor: .owPrimary)
                                }
                                if !appState.activeModel.isEmpty {
                                    InfoRow(label: "Model", value: appState.activeModel, valueColor: .owCyan)
                                }
                            }
                        }

                        // Heartbeat summary
                        SectionCard(title: "Heartbeat", icon: "heart") {
                            VStack(spacing: 8) {
                                InfoRow(label: "Enabled", value: appState.heartbeat.enabled ? "Yes" : "No",
                                        valueColor: appState.heartbeat.enabled ? .owGreen : .owTextTertiary)
                                InfoRow(label: "Running", value: appState.heartbeat.running ? "Active" : "Idle",
                                        valueColor: appState.heartbeat.running ? .owGreen : .owTextTertiary)
                                InfoRow(label: "Interval", value: appState.heartbeat.every)
                            }
                        }
                    }
                    .frame(maxWidth: .infinity)

                    // Right column — Channels
                    SectionCard(title: "Channels", icon: "antenna.radiowaves.left.and.right") {
                        if appState.channels.isEmpty {
                            VStack(spacing: 8) {
                                Image(systemName: "antenna.radiowaves.left.and.right.slash")
                                    .font(.system(size: 20, weight: .light))
                                    .foregroundColor(.owTextTertiary)
                                Text("No channels configured")
                                    .font(.owCaption)
                                    .foregroundColor(.owTextTertiary)
                            }
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 16)
                        } else {
                            VStack(spacing: 6) {
                                ForEach(appState.channels) { channel in
                                    HStack(spacing: 10) {
                                        Image(systemName: iconForChannel(channel.name))
                                            .font(.system(size: 13))
                                            .foregroundColor(.owPrimary)
                                            .frame(width: 28, height: 28)
                                            .background(Color.owPrimary.opacity(0.10))
                                            .clipShape(RoundedRectangle(cornerRadius: 7, style: .continuous))
                                        VStack(alignment: .leading, spacing: 2) {
                                            Text(channel.name)
                                                .font(.owBodyMedium)
                                                .foregroundColor(.owTextPrimary)
                                            Text(channel.connected ? "Connected" : "Disconnected")
                                                .font(.system(size: 10))
                                                .foregroundColor(channel.connected ? .owGreen : .owTextTertiary)
                                        }
                                        Spacer()
                                        Circle()
                                            .fill(channel.connected ? Color.owGreen : Color.owTextTertiary)
                                            .frame(width: 8, height: 8)
                                    }
                                    .padding(.vertical, 4)
                                }
                            }
                        }
                    }
                    .frame(maxWidth: .infinity)
                }
            }
            .padding(28)
        }
    }

    private func iconForChannel(_ name: String) -> String {
        let n = name.lowercased()
        if n.contains("imessage") { return "message" }
        if n.contains("whatsapp") { return "phone.bubble" }
        if n.contains("telegram") { return "paperplane" }
        if n.contains("discord") { return "gamecontroller" }
        if n.contains("twitter") || n.contains("x.com") { return "at" }
        if n.contains("slack") { return "number" }
        return "bubble.left"
    }
}
