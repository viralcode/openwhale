import SwiftUI

struct HeartbeatPage: View {
    @EnvironmentObject var appState: AppState
    @State private var activeTab: HeartbeatTab = .config

    enum HeartbeatTab: String, CaseIterable {
        case config = "Configuration"
        case alerts = "Alerts"
        case editor = "HEARTBEAT.md"
    }

    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                PageHeader(title: "Heartbeat", subtitle: "Autonomous check-in system")
                Spacer()
                HStack(spacing: 4) {
                    Circle()
                        .fill(appState.heartbeat.enabled ? Color.owGreen : Color.owTextTertiary)
                        .frame(width: 7, height: 7)
                    Text(appState.heartbeat.enabled ? "Enabled" : "Disabled")
                        .font(.owCaption)
                        .foregroundColor(appState.heartbeat.enabled ? .owGreen : .owTextTertiary)
                }
            }
            .padding(.horizontal, 24)
            .padding(.top, 20)
            .padding(.bottom, 12)

            // Tab bar
            HStack(spacing: 0) {
                ForEach(HeartbeatTab.allCases, id: \.self) { tab in
                    Button {
                        activeTab = tab
                    } label: {
                        Text(tab.rawValue)
                            .font(.system(size: 12, weight: activeTab == tab ? .semibold : .regular))
                            .foregroundColor(activeTab == tab ? .owPrimary : .owTextSecondary)
                            .padding(.horizontal, 14)
                            .padding(.vertical, 8)
                            .background(activeTab == tab ? Color.owPrimary.opacity(0.1) : Color.clear)
                            .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
                    }
                    .buttonStyle(.plain)
                }
                Spacer()
            }
            .padding(.horizontal, 24)
            .padding(.bottom, 8)

            Divider().background(Color.owBorder)

            // Content
            switch activeTab {
            case .config:
                configView
            case .alerts:
                alertsView
            case .editor:
                editorView
            }
        }
    }

    // MARK: - Config

    private var configView: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                // Status card
                SectionCard(title: "Status", icon: "heart") {
                    VStack(spacing: 4) {
                        InfoRow(label: "Running", value: appState.heartbeat.running ? "Yes" : "No",
                                valueColor: appState.heartbeat.running ? .owGreen : .owTextTertiary)
                        InfoRow(label: "Interval", value: appState.heartbeat.every)
                        if let lastRun = appState.heartbeat.lastRunAt {
                            InfoRow(label: "Last Run", value: lastRun)
                        }
                        if let lastResult = appState.heartbeat.lastResult {
                            InfoRow(label: "Last Result", value: String(lastResult.prefix(80)))
                        }
                    }
                }

                // Settings
                SectionCard(title: "Settings", icon: "gear") {
                    VStack(spacing: 12) {
                        ModernToggleRow(label: "Enable Heartbeat", isOn: $appState.heartbeatConfig.enabled, icon: "heart")

                        VStack(alignment: .leading, spacing: 4) {
                            Text("INTERVAL")
                                .sectionHeader()
                            ModernTextField(placeholder: "e.g. 30m, 1h", text: $appState.heartbeatConfig.every)
                        }

                        HStack(spacing: 12) {
                            VStack(alignment: .leading, spacing: 4) {
                                Text("ACTIVE HOURS START")
                                    .sectionHeader()
                                ModernTextField(placeholder: "e.g. 08:00", text: $appState.heartbeatConfig.activeHoursStart)
                            }
                            VStack(alignment: .leading, spacing: 4) {
                                Text("ACTIVE HOURS END")
                                    .sectionHeader()
                                ModernTextField(placeholder: "e.g. 22:00", text: $appState.heartbeatConfig.activeHoursEnd)
                            }
                        }

                        VStack(alignment: .leading, spacing: 4) {
                            Text("MODEL")
                                .sectionHeader()
                            ModernTextField(placeholder: "Model name", text: $appState.heartbeatConfig.model)
                        }

                        VStack(alignment: .leading, spacing: 4) {
                            Text("FORWARD TO")
                                .sectionHeader()
                            ModernTextField(placeholder: "Channel to forward alerts", text: $appState.heartbeatConfig.forwardTo)
                        }

                        VStack(alignment: .leading, spacing: 4) {
                            Text("PROMPT")
                                .sectionHeader()
                            WhiteTextEditor(text: $appState.heartbeatConfig.prompt, placeholder: "Enter heartbeat prompt...", minHeight: 80)
                        }

                        HStack {
                            Spacer()
                            ActionButton(title: "Save Settings", icon: "checkmark") {
                                Task { await appState.saveHeartbeatSettings() }
                            }
                        }
                    }
                }
            }
            .padding(24)
        }
    }

    // MARK: - Alerts

    private var alertsView: some View {
        Group {
            if appState.heartbeatAlerts.isEmpty {
                EmptyStateView(
                    icon: "bell.slash",
                    title: "No Alerts",
                    subtitle: "No heartbeat alerts recorded"
                )
            } else {
                ScrollView {
                    VStack(spacing: 8) {
                        ForEach(appState.heartbeatAlerts) { alert in
                            HStack(alignment: .top, spacing: 10) {
                                Image(systemName: "exclamationmark.triangle.fill")
                                    .font(.system(size: 13))
                                    .foregroundColor(.owYellow)
                                    .padding(.top, 2)
                                VStack(alignment: .leading, spacing: 3) {
                                    Text(alert.text ?? "")
                                        .font(.owBody)
                                        .foregroundColor(.owTextPrimary)
                                    HStack(spacing: 8) {
                                        if let ts = alert.timestamp {
                                            Text(ts)
                                                .font(.owCaption)
                                                .foregroundColor(.owTextTertiary)
                                        }
                                        if let fwd = alert.forwardedTo, !fwd.isEmpty {
                                            Text("→ \(fwd.joined(separator: ", "))")
                                                .font(.owCaption)
                                                .foregroundColor(.owCyan)
                                        }
                                    }
                                }
                                Spacer()
                            }
                            .cardStyle()
                        }
                    }
                    .padding(24)
                }
            }
        }
    }

    // MARK: - Editor

    private var editorView: some View {
        VStack(spacing: 0) {
            HStack {
                if appState.heartbeatMdExists {
                    Text(appState.heartbeatMdPath)
                        .font(.owCaption)
                        .foregroundColor(.owTextTertiary)
                }
                Spacer()
                ActionButton(title: "Save", icon: "square.and.arrow.down") {
                    Task { await appState.saveHeartbeatMdContent(appState.heartbeatMdContent) }
                }
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 10)

            Divider().background(Color.owBorder)

            WhiteTextEditor(text: $appState.heartbeatMdContent, placeholder: "Edit HEARTBEAT.md...", font: .owMono, minHeight: 200)
        }
    }
}
