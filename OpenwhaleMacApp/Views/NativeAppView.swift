import SwiftUI

enum SidebarPage: String, CaseIterable, Identifiable {
    case overview = "Overview"
    case chat = "Chat"
    case channels = "Channels"
    case providers = "Providers"
    case skills = "API Skills"
    case skillEditor = "Skills Editor"
    case tools = "Tools"
    case heartbeat = "Heartbeat"
    case logs = "Logs"

    var id: String { rawValue }

    var icon: String {
        switch self {
        case .overview: return "square.grid.2x2"
        case .chat: return "bubble.left.and.bubble.right"
        case .channels: return "antenna.radiowaves.left.and.right"
        case .providers: return "cpu"
        case .skills: return "wrench.and.screwdriver"
        case .skillEditor: return "doc.text"
        case .tools: return "hammer"
        case .heartbeat: return "heart.text.square"
        case .logs: return "list.bullet.rectangle"
        }
    }
}

struct NativeAppView: View {
    @EnvironmentObject var appState: AppState
    @State private var selectedPage: SidebarPage = .overview

    var body: some View {
        VStack(spacing: 0) {
            topNavBar
            detailView
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(Color.owBackground)
        }
        .frame(minWidth: 960, minHeight: 640)
        .background(Color.owBackground)
        .onAppear {
            Task { await appState.refreshDashboardData() }
        }
    }

    // MARK: - Top Navigation

    private var topNavBar: some View {
        HStack(spacing: 0) {
            // App identity
            HStack(spacing: 8) {
                Text("🐋")
                    .font(.system(size: 20))
                Text("OpenWhale")
                    .font(.system(size: 15, weight: .bold, design: .rounded))
                    .foregroundColor(.owTextPrimary)
            }
            .padding(.leading, 20)

            // Connection pill
            HStack(spacing: 5) {
                Circle()
                    .fill(appState.isConnected ? Color.owGreen : Color.owRed)
                    .frame(width: 7, height: 7)
                if !appState.serverVersion.isEmpty {
                    Text("v\(appState.serverVersion)")
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundColor(.owTextTertiary)
                }
            }
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(Color.owSurface)
            .clipShape(Capsule())
            .padding(.leading, 10)

            Spacer().frame(width: 20)

            // Navigation tabs
            HStack(spacing: 2) {
                ForEach(SidebarPage.allCases) { page in
                    tabItem(page)
                }
            }

            Spacer()

            // Right-side actions
            HStack(spacing: 12) {
                if !appState.isConnected {
                    Button {
                        appState.startOpenWhaleService()
                    } label: {
                        HStack(spacing: 5) {
                            Image(systemName: "play.fill")
                                .font(.system(size: 9))
                            Text("Start")
                                .font(.system(size: 11, weight: .semibold))
                        }
                        .foregroundColor(.white)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 6)
                        .background(Color.owPrimary)
                        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                    }
                    .buttonStyle(.plain)
                }

                if !appState.activeModel.isEmpty {
                    HStack(spacing: 5) {
                        Circle()
                            .fill(Color.owPrimary)
                            .frame(width: 5, height: 5)
                        Text(appState.activeModel)
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundColor(.owPrimary)
                    }
                    .padding(.horizontal, 10)
                    .padding(.vertical, 5)
                    .background(Color.owPrimary.opacity(0.10))
                    .clipShape(Capsule())
                }

                Button {
                    appState.openDashboard()
                } label: {
                    Image(systemName: "globe")
                        .font(.system(size: 14))
                        .foregroundColor(.owTextSecondary)
                        .frame(width: 28, height: 28)
                        .background(Color.owSurface)
                        .clipShape(Circle())
                }
                .buttonStyle(.plain)
                .help("Web Dashboard")
            }
            .padding(.trailing, 20)
        }
        .frame(height: 48)
        .background(Color.owSidebarBg)
    }

    private func tabItem(_ page: SidebarPage) -> some View {
        Button {
            selectedPage = page
        } label: {
            HStack(spacing: 5) {
                Image(systemName: page.icon)
                    .font(.system(size: 11, weight: .medium))
                Text(page.rawValue)
                    .font(.system(size: 12, weight: selectedPage == page ? .semibold : .regular))
            }
            .foregroundColor(selectedPage == page ? .owPrimary : .owTextTertiary)
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .background(
                selectedPage == page
                    ? Color.owPrimary.opacity(0.10)
                    : Color.clear
            )
            .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    // MARK: - Content

    @ViewBuilder
    private var detailView: some View {
        switch selectedPage {
        case .overview: OverviewPage()
        case .chat: ChatPage()
        case .channels: ChannelsPage()
        case .providers: ProvidersPage()
        case .skills: SkillsPage()
        case .skillEditor: SkillEditorPage()
        case .tools: ToolsPage()
        case .heartbeat: HeartbeatPage()
        case .logs: LogsPage()
        }
    }
}
