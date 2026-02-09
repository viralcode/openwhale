import SwiftUI

/// Main menu bar popover content
struct MenuBarView: View {
    @EnvironmentObject var state: AppState
    @Environment(\.openWindow) private var openWindow

    var body: some View {
        VStack(spacing: 0) {
            headerSection
            Divider()

            ScrollView {
                VStack(spacing: 12) {
                    if state.isConnected {
                        StatusSection()
                        Divider().padding(.horizontal)
                        ChannelsSection()
                        Divider().padding(.horizontal)
                        HeartbeatSection()
                        Divider().padding(.horizontal)
                        MiniChatView()
                    } else {
                        disconnectedView
                    }
                }
                .padding(.vertical, 12)
            }

            Divider()
            footerSection
        }
        .frame(width: 340, height: 520)
    }

    // MARK: - Header

    private var headerSection: some View {
        HStack {
            Text("🐋")
                .font(.title2)

            Text("OpenWhale")
                .font(.headline)

            Spacer()

            HStack(spacing: 4) {
                Circle()
                    .fill(state.isConnected ? Color.green : Color.red)
                    .frame(width: 7, height: 7)
                Text(state.isConnected ? "Connected" : "Offline")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(.ultraThinMaterial, in: Capsule())
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
    }

    // MARK: - Disconnected

    private var disconnectedView: some View {
        VStack(spacing: 16) {
            Spacer()
            Text("🐋")
                .font(.system(size: 48))
                .grayscale(1.0)
                .opacity(0.4)
            Text("Server Offline")
                .font(.title3)
                .fontWeight(.semibold)
            Text("OpenWhale is not running on port 7777.\nStart it with `npm run dev`")
                .font(.caption)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
            Button("Open Dashboard Anyway") {
                state.openDashboard()
            }
            .buttonStyle(.bordered)
            Spacer()
        }
        .padding()
    }

    // MARK: - Footer

    private var footerSection: some View {
        HStack(spacing: 8) {
            // Open Native App
            Button {
                NSApp.activate(ignoringOtherApps: true)
                openWindow(id: "main-app")
            } label: {
                Label("Open App", systemImage: "macwindow")
                    .font(.caption)
            }
            .buttonStyle(.borderless)

            // Web Dashboard
            Button {
                state.openDashboard()
            } label: {
                Label("Web", systemImage: "globe")
                    .font(.caption)
            }
            .buttonStyle(.borderless)

            Spacer()

            if !state.activeModel.isEmpty {
                Text(state.activeModel)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }

            Spacer()

            Button {
                NSApp.terminate(nil)
            } label: {
                Label("Quit", systemImage: "power")
                    .font(.caption)
            }
            .buttonStyle(.borderless)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
    }
}

// MARK: - Status Section

struct StatusSection: View {
    @EnvironmentObject var state: AppState

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Label("Server Status", systemImage: "server.rack")
                .font(.caption)
                .fontWeight(.semibold)
                .foregroundStyle(.secondary)

            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Active Model")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                    Text(state.activeModel.isEmpty ? "None" : state.activeModel)
                        .font(.callout)
                        .fontWeight(.medium)
                }

                Spacer()

                VStack(alignment: .trailing, spacing: 2) {
                    Text("Version")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                    Text(state.serverVersion.isEmpty ? "—" : state.serverVersion)
                        .font(.callout)
                        .fontWeight(.medium)
                }
            }
            .padding(10)
            .background(.quaternary.opacity(0.5), in: RoundedRectangle(cornerRadius: 8))

            // Health Check
            HStack(spacing: 6) {
                Image(systemName: "heart.text.clipboard")
                    .font(.caption2)
                    .foregroundStyle(.green)
                Text("Health: OK")
                    .font(.caption2)
                    .foregroundStyle(.green)
                Spacer()
                if !state.healthTimestamp.isEmpty {
                    Text(formatTimestamp(state.healthTimestamp))
                        .font(.system(size: 9))
                        .foregroundStyle(.tertiary)
                }
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 4)
        }
        .padding(.horizontal, 16)
    }

    private func formatTimestamp(_ ts: String) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = formatter.date(from: ts) {
            let relative = RelativeDateTimeFormatter()
            relative.unitsStyle = .abbreviated
            return relative.localizedString(for: date, relativeTo: Date())
        }
        return ts
    }
}

// MARK: - Channels Section

struct ChannelsSection: View {
    @EnvironmentObject var state: AppState

    private var iconMap: [String: String] {
        [
            "whatsapp": "📱", "telegram": "✈️", "discord": "🎮",
            "imessage": "💬", "slack": "💼", "twitter": "🐦", "web": "🌐"
        ]
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Label("Connected Channels", systemImage: "antenna.radiowaves.left.and.right")
                .font(.caption)
                .fontWeight(.semibold)
                .foregroundStyle(.secondary)

            if state.channels.isEmpty {
                Text("No channels connected")
                    .font(.caption)
                    .foregroundStyle(.tertiary)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding(.vertical, 8)
            } else {
                LazyVGrid(columns: [
                    GridItem(.flexible()),
                    GridItem(.flexible()),
                ], spacing: 6) {
                    ForEach(state.channels) { channel in
                        channelBadge(channel)
                    }
                }
            }
        }
        .padding(.horizontal, 16)
    }

    private func channelBadge(_ channel: OpenWhaleClient.ChannelInfo) -> some View {
        HStack(spacing: 6) {
            Text(iconMap[channel.type] ?? "📡")
                .font(.callout)
            Text(channel.name)
                .font(.caption)
                .fontWeight(.medium)
                .lineLimit(1)
            Spacer()
            Circle()
                .fill(channel.connected ? Color.green : Color.red.opacity(0.6))
                .frame(width: 6, height: 6)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 6)
        .background(.quaternary.opacity(0.5), in: RoundedRectangle(cornerRadius: 6))
    }
}

// MARK: - Heartbeat Section

struct HeartbeatSection: View {
    @EnvironmentObject var state: AppState

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Label("Heartbeat", systemImage: "heart.fill")
                    .font(.caption)
                    .fontWeight(.semibold)
                    .foregroundStyle(.secondary)

                Spacer()

                Toggle("", isOn: Binding(
                    get: { state.heartbeat.enabled },
                    set: { _ in Task { await state.toggleHeartbeat() } }
                ))
                .toggleStyle(.switch)
                .controlSize(.small)
            }

            if state.heartbeat.enabled {
                HStack(spacing: 12) {
                    statusPill(
                        icon: state.heartbeat.running ? "bolt.fill" : "bolt.slash",
                        text: state.heartbeat.running ? "Running" : "Stopped",
                        color: state.heartbeat.running ? .green : .orange
                    )

                    statusPill(
                        icon: "clock",
                        text: "Every \(state.heartbeat.every)",
                        color: .blue
                    )

                    if let result = state.heartbeat.lastResult {
                        statusPill(
                            icon: result == "ok" ? "checkmark.circle" : "exclamationmark.triangle",
                            text: result,
                            color: result == "ok" ? .green : .orange
                        )
                    }
                }

                // MD file status
                HStack(spacing: 4) {
                    Image(systemName: state.heartbeat.heartbeatMdExists ? "doc.fill" : "doc")
                        .font(.caption2)
                        .foregroundStyle(state.heartbeat.heartbeatMdExists ? .blue : .secondary)
                    Text(state.heartbeat.heartbeatMdExists ? "HEARTBEAT.md loaded" : "No HEARTBEAT.md")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }
        }
        .padding(.horizontal, 16)
    }

    private func statusPill(icon: String, text: String, color: Color) -> some View {
        HStack(spacing: 3) {
            Image(systemName: icon)
                .font(.system(size: 9))
            Text(text)
                .font(.caption2)
        }
        .foregroundStyle(color)
        .padding(.horizontal, 6)
        .padding(.vertical, 3)
        .background(color.opacity(0.1), in: Capsule())
    }
}
