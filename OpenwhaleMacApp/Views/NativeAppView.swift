import SwiftUI

// MARK: - Sidebar Navigation

enum AppSection: String, CaseIterable, Identifiable {
    case overview = "Overview"
    case chat = "Chat"
    case channels = "Channels"
    case providers = "Providers"
    case skills = "API Skills"
    case mdSkills = "Skills Editor"
    case tools = "Tools"
    case heartbeat = "Heartbeat"
    case logs = "Logs"

    var id: String { rawValue }

    var icon: String {
        switch self {
        case .overview: return "gauge.open.with.lines.needle.33percent"
        case .chat: return "bubble.left.and.bubble.right.fill"
        case .channels: return "antenna.radiowaves.left.and.right"
        case .providers: return "cpu"
        case .skills: return "puzzlepiece.extension"
        case .mdSkills: return "doc.richtext"
        case .tools: return "wrench.and.screwdriver"
        case .heartbeat: return "heart.fill"
        case .logs: return "doc.text.magnifyingglass"
        }
    }
}

// MARK: - Main App Window

struct NativeAppView: View {
    @EnvironmentObject var state: AppState
    @State private var selectedSection: AppSection = .overview

    var body: some View {
        NavigationSplitView {
            sidebar
        } detail: {
            detailView
        }
        .navigationSplitViewStyle(.balanced)
        .frame(minWidth: 900, minHeight: 600)
        .task {
            await state.refreshDashboardData()
        }
    }

    private var sidebar: some View {
        List(AppSection.allCases, selection: $selectedSection) { section in
            Label(section.rawValue, systemImage: section.icon)
                .tag(section)
        }
        .listStyle(.sidebar)
        .navigationTitle("OpenWhale")
        .safeAreaInset(edge: .top) {
            connectionBanner.padding(.horizontal, 10).padding(.top, 6)
        }
        .safeAreaInset(edge: .bottom) {
            VStack(spacing: 4) {
                Divider()

                // Start Service button
                if !state.isConnected {
                    Button {
                        state.startOpenWhaleService()
                    } label: {
                        Label("Start OpenWhale", systemImage: "play.circle.fill")
                            .font(.caption)
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(.green)
                    .controlSize(.small)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 4)
                }

                HStack {
                    if !state.activeModel.isEmpty {
                        Image(systemName: "cpu").font(.caption2).foregroundStyle(.secondary)
                        Text(state.activeModel).font(.caption2).foregroundStyle(.secondary).lineLimit(1)
                    }
                    Spacer()
                    if !state.serverVersion.isEmpty {
                        Text("v\(state.serverVersion)").font(.caption2).foregroundStyle(.tertiary)
                    }
                }
                .padding(.horizontal, 16).padding(.bottom, 8)
            }
        }
    }

    private var connectionBanner: some View {
        HStack(spacing: 6) {
            Circle()
                .fill(state.isConnected ? Color.green : Color.red)
                .frame(width: 8, height: 8)
            Text(state.isConnected ? "Connected" : "Offline")
                .font(.caption).fontWeight(.medium)
                .foregroundStyle(state.isConnected ? Color.primary : Color.red)
            Spacer()
            Button { Task { await state.refresh() } } label: {
                Image(systemName: "arrow.clockwise").font(.caption)
            }.buttonStyle(.borderless)
        }
        .padding(.horizontal, 12).padding(.vertical, 8)
        .background(RoundedRectangle(cornerRadius: 8).fill(state.isConnected ? Color.green.opacity(0.1) : Color.red.opacity(0.1)))
    }

    @ViewBuilder
    private var detailView: some View {
        switch selectedSection {
        case .overview: OverviewPage()
        case .chat: FullChatPage()
        case .channels: ChannelsPage()
        case .providers: ProvidersPage()
        case .skills: APISkillsPage()
        case .mdSkills: MdSkillsPage()
        case .tools: ToolsPage()
        case .heartbeat: HeartbeatPage()
        case .logs: LogsPage()
        }
    }
}

// ═══════════════════════════════════════════════
// MARK: - Overview Page
// ═══════════════════════════════════════════════

struct OverviewPage: View {
    @EnvironmentObject var state: AppState

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 4), spacing: 16) {
                    StatCard(title: "Users", value: "\(state.stats.users)", icon: "person.2.fill", color: .blue)
                    StatCard(title: "Sessions", value: "\(state.stats.sessions)", icon: "bubble.left.and.text.bubble.right.fill", color: .purple)
                    StatCard(title: "Messages", value: "\(state.stats.messages)", icon: "text.bubble.fill", color: .green)
                    StatCard(title: "Tokens", value: formatNumber(state.stats.totalTokens), icon: "number", color: .orange)
                }

                GroupBox {
                    VStack(alignment: .leading, spacing: 12) {
                        HStack {
                            Label("Server Info", systemImage: "server.rack").font(.headline)
                            Spacer()
                            HStack(spacing: 4) {
                                Image(systemName: "heart.text.clipboard").font(.caption)
                                Text("Healthy").font(.caption).fontWeight(.medium)
                            }
                            .foregroundStyle(.green)
                            .padding(.horizontal, 8).padding(.vertical, 3)
                            .background(Color.green.opacity(0.1), in: Capsule())
                        }
                        HStack(spacing: 24) {
                            InfoItem(label: "Status", value: state.isConnected ? "Running" : "Offline")
                            InfoItem(label: "Version", value: state.serverVersion.isEmpty ? "—" : state.serverVersion)
                            InfoItem(label: "Active Model", value: state.activeModel.isEmpty ? "None" : state.activeModel)
                            InfoItem(label: "Tools", value: "\(state.tools.count)")
                            InfoItem(label: "Skills", value: "\(state.skills.count)")
                        }
                    }.frame(maxWidth: .infinity, alignment: .leading).padding(4)
                }

                HStack(spacing: 16) {
                    GroupBox {
                        VStack(alignment: .leading, spacing: 8) {
                            Label("Channels", systemImage: "antenna.radiowaves.left.and.right").font(.headline)
                            ForEach(state.channels) { ch in
                                HStack {
                                    Text(ch.name).font(.callout)
                                    Spacer()
                                    Circle().fill(ch.connected ? Color.green : Color.red.opacity(0.6)).frame(width: 8, height: 8)
                                }
                            }
                            if state.channels.isEmpty { Text("No channels").foregroundStyle(.secondary).font(.caption) }
                        }.frame(maxWidth: .infinity, alignment: .leading).padding(4)
                    }

                    GroupBox {
                        VStack(alignment: .leading, spacing: 8) {
                            Label("Heartbeat", systemImage: "heart.fill").font(.headline)
                            HStack(spacing: 16) {
                                InfoItem(label: "Status", value: state.heartbeat.enabled ? (state.heartbeat.running ? "Running" : "Stopped") : "Disabled")
                                InfoItem(label: "Interval", value: state.heartbeat.every)
                                InfoItem(label: "Last", value: state.heartbeat.lastResult ?? "—")
                            }
                        }.frame(maxWidth: .infinity, alignment: .leading).padding(4)
                    }
                }
            }.padding(24)
        }
        .navigationTitle("Overview")
        .task { await state.refreshDashboardData() }
    }

    private func formatNumber(_ n: Int) -> String {
        if n >= 1_000_000 { return String(format: "%.1fM", Double(n) / 1_000_000) }
        if n >= 1_000 { return String(format: "%.1fK", Double(n) / 1_000) }
        return "\(n)"
    }
}

struct StatCard: View {
    let title: String; let value: String; let icon: String; let color: Color
    var body: some View {
        VStack(spacing: 8) {
            Image(systemName: icon).font(.title2).foregroundStyle(color)
            Text(value).font(.title).fontWeight(.bold).monospacedDigit()
            Text(title).font(.caption).foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity).padding(16)
        .background(color.opacity(0.08), in: RoundedRectangle(cornerRadius: 12))
    }
}

struct InfoItem: View {
    let label: String; let value: String
    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label).font(.caption).foregroundStyle(.secondary)
            Text(value).font(.body).fontWeight(.medium)
        }
    }
}

// ═══════════════════════════════════════════════
// MARK: - Markdown Helpers
// ═══════════════════════════════════════════════

struct MarkdownText: View {
    let content: String
    var body: some View {
        if let attributed = try? AttributedString(markdown: content, options: .init(interpretedSyntax: .inlineOnlyPreservingWhitespace)) {
            Text(attributed).textSelection(.enabled)
        } else {
            Text(content).textSelection(.enabled)
        }
    }
}

struct FullChatPage: View {
    @EnvironmentObject var state: AppState
    @FocusState private var isInputFocused: Bool
    @State private var expandedTools: Set<UUID> = []

    var body: some View {
        VStack(spacing: 0) {
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(spacing: 12) {
                        if state.chatMessages.isEmpty {
                            VStack(spacing: 16) {
                                Text("🐋").font(.system(size: 64))
                                Text("Ask OpenWhale anything...").font(.title3).foregroundStyle(.secondary)
                            }.frame(maxWidth: .infinity).padding(.top, 80)
                        }
                        ForEach(state.chatMessages) { msg in
                            chatStepView(msg).id(msg.id)
                        }
                        if state.isSending {
                            HStack(spacing: 8) {
                                Circle().fill(Color.blue).frame(width: 6, height: 6)
                                    .opacity(0.8)
                                    .scaleEffect(1.0)
                                    .animation(.easeInOut(duration: 0.6).repeatForever(autoreverses: true), value: state.isSending)
                                Text("Thinking...").font(.callout).foregroundStyle(.secondary)
                                Spacer()
                            }.padding(.leading, 52).padding(.vertical, 4)
                        }
                    }.padding(20)
                }
                .onChange(of: state.chatMessages.count) { _, _ in
                    if let last = state.chatMessages.last {
                        withAnimation { proxy.scrollTo(last.id, anchor: .bottom) }
                    }
                }
            }
            Divider()
            HStack(spacing: 12) {
                TextField("Ask OpenWhale anything...", text: $state.chatInput, axis: .vertical)
                    .textFieldStyle(.plain).font(.body).lineLimit(1...5)
                    .focused($isInputFocused)
                    .onSubmit { Task { await state.sendMessage() } }
                    .disabled(state.isSending)
                if state.isSending {
                    ProgressView().controlSize(.small)
                } else {
                    Button { Task { await state.sendMessage() } } label: {
                        Image(systemName: "arrow.up.circle.fill").font(.title2).foregroundStyle(.blue)
                    }.buttonStyle(.borderless)
                    .disabled(state.chatInput.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            }.padding(16).background(.bar)
        }
        .navigationTitle("Chat")
        .onAppear { isInputFocused = true }
    }

    // MARK: - Message rendering

    @ViewBuilder
    private func chatStepView(_ msg: AppState.ChatMessage) -> some View {
        switch msg.kind {
        case .user:
            // User message — right-aligned blue bubble
            HStack(alignment: .top) {
                Spacer(minLength: 80)
                VStack(alignment: .trailing, spacing: 4) {
                    Text(msg.content).font(.body).textSelection(.enabled)
                        .padding(12)
                        .background(Color.blue.opacity(0.12), in: RoundedRectangle(cornerRadius: 16))
                    Text(msg.timestamp, style: .time).font(.caption2).foregroundStyle(.tertiary)
                }
            }

        case .assistant:
            // Assistant message — left-aligned with 🐋 avatar (matches dashboard)
            HStack(alignment: .top, spacing: 10) {
                // Whale avatar
                Text("🐋").font(.title3)
                    .frame(width: 32, height: 32)
                    .background(Color.blue.opacity(0.08), in: Circle())

                VStack(alignment: .leading, spacing: 4) {
                    MarkdownText(content: msg.content).font(.body).textSelection(.enabled)
                    Text(msg.timestamp, style: .time).font(.caption2).foregroundStyle(.tertiary)
                }
                Spacer(minLength: 40)
            }

        case .toolStart:
            // Tool call chip — matches dashboard's tool-call-chip style
            HStack(alignment: .top, spacing: 10) {
                Color.clear.frame(width: 32, height: 0) // avatar spacer
                toolChipView(msg, isRunning: true)
            }

        case .toolEnd:
            // Completed tool — expandable chip with result preview
            HStack(alignment: .top, spacing: 10) {
                Color.clear.frame(width: 32, height: 0) // avatar spacer
                toolChipView(msg, isRunning: false)
            }

        case .thinking:
            // Thinking indicator — matches dashboard's thinking step
            HStack(alignment: .top, spacing: 10) {
                Color.clear.frame(width: 32, height: 0)
                HStack(spacing: 6) {
                    ProgressView().controlSize(.mini)
                    Text(msg.content).font(.caption).foregroundStyle(.secondary)
                    Spacer()
                }
                .padding(.horizontal, 12).padding(.vertical, 6)
            }

        case .error:
            HStack(alignment: .top, spacing: 10) {
                Text("⚠️").font(.title3)
                    .frame(width: 32, height: 32)
                    .background(Color.red.opacity(0.08), in: Circle())
                Text(msg.content).font(.callout).foregroundStyle(.red)
                    .padding(10)
                    .background(Color.red.opacity(0.06), in: RoundedRectangle(cornerRadius: 10))
                Spacer()
            }
        }
    }

    // MARK: - Tool call chip (matches dashboard tool-call-chip)

    @ViewBuilder
    private func toolChipView(_ msg: AppState.ChatMessage, isRunning: Bool) -> some View {
        let isExpanded = expandedTools.contains(msg.id)

        VStack(alignment: .leading, spacing: 0) {
            // Header row (clickable for completed tools)
            Button {
                if !isRunning {
                    withAnimation(.easeInOut(duration: 0.2)) {
                        if expandedTools.contains(msg.id) {
                            expandedTools.remove(msg.id)
                        } else {
                            expandedTools.insert(msg.id)
                        }
                    }
                }
            } label: {
                HStack(spacing: 8) {
                    // Status icon
                    if isRunning {
                        ProgressView().controlSize(.mini)
                    } else {
                        Image(systemName: "checkmark")
                            .font(.system(size: 10, weight: .bold))
                            .foregroundStyle(.green)
                            .frame(width: 16, height: 16)
                            .background(Color.green.opacity(0.15), in: Circle())
                    }

                    // Tool name
                    Text(isRunning ? "Running" : (msg.toolName ?? ""))
                        .font(.caption)
                        .fontWeight(.semibold)
                        .foregroundStyle(isRunning ? Color.orange : Color.green)

                    Text(msg.toolName ?? "")
                        .font(.caption)
                        .foregroundStyle(.primary)

                    if isRunning {
                        ProgressView().controlSize(.mini)
                    }

                    Spacer()

                    // Chevron for completed tools
                    if !isRunning {
                        Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                            .font(.system(size: 9))
                            .foregroundStyle(.tertiary)
                    }
                }
                .padding(.horizontal, 12).padding(.vertical, 8)
            }
            .buttonStyle(.plain)

            // Expanded result preview
            if isExpanded, let result = msg.toolStatus, !result.isEmpty {
                Divider().padding(.horizontal, 12)
                Text(result)
                    .font(.system(size: 11, design: .monospaced))
                    .foregroundStyle(.secondary)
                    .lineLimit(8)
                    .padding(.horizontal, 12).padding(.vertical, 8)
            }
        }
        .background(
            RoundedRectangle(cornerRadius: 10)
                .fill(isRunning ? Color.orange.opacity(0.06) : Color.green.opacity(0.06))
                .overlay(
                    RoundedRectangle(cornerRadius: 10)
                        .strokeBorder(isRunning ? Color.orange.opacity(0.15) : Color.green.opacity(0.15), lineWidth: 1)
                )
        )
    }
}

// ═══════════════════════════════════════════════
// MARK: - Channels Page
// ═══════════════════════════════════════════════

struct ChannelsPage: View {
    @EnvironmentObject var state: AppState
    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                ForEach(state.channels) { ch in ChannelRow(channel: ch) }
                if state.channels.isEmpty {
                    VStack(spacing: 12) {
                        Image(systemName: "antenna.radiowaves.left.and.right.slash").font(.system(size: 48)).foregroundStyle(.tertiary)
                        Text("No channels available").foregroundStyle(.secondary)
                    }.frame(maxWidth: .infinity).padding(.top, 80)
                }
            }.padding(24)
        }.navigationTitle("Channels")
    }
}

struct ChannelRow: View {
    @EnvironmentObject var state: AppState
    let channel: OpenWhaleClient.ChannelInfo
    private let iconMap: [String: String] = ["whatsapp": "📱", "telegram": "✈️", "discord": "🎮", "imessage": "💬", "slack": "💼", "twitter": "🐦", "web": "🌐"]

    var body: some View {
        HStack(spacing: 16) {
            Text(iconMap[channel.type] ?? "📡").font(.largeTitle)
            VStack(alignment: .leading, spacing: 4) {
                Text(channel.name).font(.headline)
                HStack(spacing: 8) {
                    Circle().fill(channel.connected ? Color.green : Color.red.opacity(0.6)).frame(width: 8, height: 8)
                    Text(channel.connected ? "Connected" : "Disconnected").font(.caption).foregroundStyle(.secondary)
                }
            }
            Spacer()
            if channel.type != "web" {
                Toggle("", isOn: Binding(
                    get: { channel.enabled },
                    set: { _ in Task { await state.toggleChannel(channel.type) } }
                )).toggleStyle(.switch)
            }
        }
        .padding(16).background(.quaternary.opacity(0.3), in: RoundedRectangle(cornerRadius: 12))
    }
}

// ═══════════════════════════════════════════════
// MARK: - Providers Page (Full Config with API Keys)
// ═══════════════════════════════════════════════

struct ProvidersPage: View {
    @EnvironmentObject var state: AppState

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                ForEach(state.providers) { provider in
                    ProviderConfigCard(provider: provider)
                }
                if state.providers.isEmpty {
                    VStack(spacing: 12) {
                        Image(systemName: "cpu").font(.system(size: 48)).foregroundStyle(.tertiary)
                        Text("No providers configured").foregroundStyle(.secondary)
                    }.frame(maxWidth: .infinity).padding(.top, 80)
                }
            }.padding(24)
        }.navigationTitle("AI Providers")
    }
}

struct ProviderConfigCard: View {
    @EnvironmentObject var state: AppState
    let provider: OpenWhaleClient.ProvidersResponse.ProviderInfo

    @State private var apiKeyInput = ""
    @State private var isEnabled: Bool = false
    @State private var selectedModel: String = ""
    @State private var showKey = false
    @State private var isSaving = false
    @State private var saved = false

    var body: some View {
        GroupBox {
            VStack(alignment: .leading, spacing: 12) {
                // Header
                HStack {
                    Image(systemName: "cpu").font(.title2).foregroundStyle(provider.enabled ?? false ? .blue : .secondary)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(provider.name ?? "Unknown").font(.headline)
                        HStack(spacing: 8) {
                            if provider.hasKey ?? false {
                                Label("Key Set", systemImage: "key.fill").font(.caption).foregroundStyle(.green)
                            } else {
                                Label("No Key", systemImage: "key").font(.caption).foregroundStyle(.orange)
                            }
                            if provider.supportsTools ?? false {
                                Label("Tools", systemImage: "wrench.and.screwdriver").font(.caption2).foregroundStyle(.secondary)
                            }
                            if provider.supportsVision ?? false {
                                Label("Vision", systemImage: "eye").font(.caption2).foregroundStyle(.secondary)
                            }
                        }
                    }
                    Spacer()
                    Toggle("", isOn: $isEnabled).toggleStyle(.switch)
                }

                Divider()

                // API Key
                if provider.type != "ollama" {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("API Key").font(.caption).foregroundStyle(.secondary)
                        HStack {
                            if showKey {
                                TextField("Enter API key", text: $apiKeyInput)
                                    .textFieldStyle(.roundedBorder).font(.system(.callout, design: .monospaced))
                            } else {
                                SecureField("Enter API key", text: $apiKeyInput)
                                    .textFieldStyle(.roundedBorder).font(.callout)
                            }
                            Button { showKey.toggle() } label: {
                                Image(systemName: showKey ? "eye.slash" : "eye").font(.caption)
                            }.buttonStyle(.borderless)
                        }
                    }
                }

                // Model Selection
                if let models = provider.models, !models.isEmpty {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Active Model").font(.caption).foregroundStyle(.secondary)
                        Picker("", selection: $selectedModel) {
                            ForEach(models, id: \.self) { model in
                                Text(model).tag(model)
                            }
                        }.labelsHidden()
                    }
                }

                // Save
                HStack {
                    Spacer()
                    if saved {
                        Text("✓ Saved").font(.caption).foregroundStyle(.green).transition(.opacity)
                    }
                    Button {
                        isSaving = true
                        Task {
                            await state.saveProviderConfig(
                                type: provider.type ?? "",
                                apiKey: apiKeyInput.isEmpty ? nil : apiKeyInput,
                                enabled: isEnabled,
                                selectedModel: selectedModel.isEmpty ? nil : selectedModel
                            )
                            isSaving = false
                            saved = true
                            DispatchQueue.main.asyncAfter(deadline: .now() + 2) { saved = false }
                        }
                    } label: {
                        if isSaving { ProgressView().controlSize(.small) }
                        else { Label("Save", systemImage: "checkmark.circle") }
                    }
                    .buttonStyle(.borderedProminent).disabled(isSaving)
                }
            }.padding(4)
        }
        .onAppear {
            isEnabled = provider.enabled ?? false
            selectedModel = provider.models?.first ?? ""
        }
    }
}

// ═══════════════════════════════════════════════
// MARK: - API Skills Page
// ═══════════════════════════════════════════════

struct APISkillsPage: View {
    @EnvironmentObject var state: AppState

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                ForEach(state.skills) { skill in
                    SkillConfigCard(skill: skill)
                }
                if state.skills.isEmpty {
                    VStack(spacing: 12) {
                        Image(systemName: "puzzlepiece.extension").font(.system(size: 48)).foregroundStyle(.tertiary)
                        Text("No API skills found").foregroundStyle(.secondary)
                    }.frame(maxWidth: .infinity).padding(.top, 80)
                }
            }.padding(24)
        }
        .navigationTitle("API Skills")
        .task { await state.refreshDashboardData() }
    }
}

struct SkillConfigCard: View {
    @EnvironmentObject var state: AppState
    let skill: OpenWhaleClient.SkillInfo

    @State private var apiKeyInput = ""
    @State private var isEnabled = false
    @State private var showKey = false
    @State private var isSaving = false
    @State private var saved = false

    var body: some View {
        GroupBox {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    Image(systemName: skillIcon(skill.id)).font(.title2).foregroundStyle(skill.enabled ?? false ? .blue : .secondary)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(skill.name ?? skill.id).font(.headline)
                        if let desc = skill.description {
                            Text(desc).font(.caption).foregroundStyle(.secondary)
                        }
                    }
                    Spacer()
                    HStack(spacing: 6) {
                        if skill.hasKey ?? false {
                            Label("Key Set", systemImage: "key.fill").font(.caption).foregroundStyle(.green)
                        }
                        Toggle("", isOn: $isEnabled).toggleStyle(.switch)
                    }
                }

                if !(skill.noCreds ?? false) {
                    Divider()
                    VStack(alignment: .leading, spacing: 4) {
                        Text("API Key").font(.caption).foregroundStyle(.secondary)
                        HStack {
                            if showKey {
                                TextField("Enter API key", text: $apiKeyInput).textFieldStyle(.roundedBorder).font(.system(.callout, design: .monospaced))
                            } else {
                                SecureField("Enter API key", text: $apiKeyInput).textFieldStyle(.roundedBorder)
                            }
                            Button { showKey.toggle() } label: {
                                Image(systemName: showKey ? "eye.slash" : "eye").font(.caption)
                            }.buttonStyle(.borderless)
                        }
                    }

                    HStack {
                        Spacer()
                        if saved { Text("✓ Saved").font(.caption).foregroundStyle(.green) }
                        Button {
                            isSaving = true
                            Task {
                                await state.saveSkillConfig(id: skill.id, apiKey: apiKeyInput.isEmpty ? nil : apiKeyInput, enabled: isEnabled)
                                isSaving = false; saved = true
                                DispatchQueue.main.asyncAfter(deadline: .now() + 2) { saved = false }
                            }
                        } label: {
                            if isSaving { ProgressView().controlSize(.small) }
                            else { Label("Save", systemImage: "checkmark.circle") }
                        }.buttonStyle(.borderedProminent).disabled(isSaving)
                    }
                }
            }.padding(4)
        }
        .onAppear { isEnabled = skill.enabled ?? false }
    }

    private func skillIcon(_ id: String) -> String {
        switch id {
        case "github": return "chevron.left.forwardslash.chevron.right"
        case "weather": return "cloud.sun.fill"
        case "notion": return "doc.text"
        case "google": return "g.circle.fill"
        case "onepassword": return "lock.shield"
        case "twitter": return "at"
        case "elevenlabs": return "waveform"
        case "twilio": return "phone.fill"
        default: return "puzzlepiece.extension"
        }
    }
}

// ═══════════════════════════════════════════════
// MARK: - MD Skills Editor Page
// ═══════════════════════════════════════════════

struct MdSkillsPage: View {
    @EnvironmentObject var state: AppState
    @State private var selectedSkill: OpenWhaleClient.MdSkillInfo?
    @State private var fileTree: [OpenWhaleClient.FileNode] = []
    @State private var editingContent = ""
    @State private var editingFilePath = ""
    @State private var isSaving = false
    @State private var showCreateSkill = false
    @State private var newSkillName = ""
    @State private var newSkillDesc = ""
    @State private var showCreateFile = false
    @State private var newFileName = ""
    @State private var showCreateFolder = false
    @State private var newFolderName = ""

    var body: some View {
        HSplitView {
            // Left: skill browser
            VStack(spacing: 0) {
                HStack {
                    Text("Skills").font(.headline)
                    Spacer()
                    Button { showCreateSkill = true } label: {
                        Image(systemName: "plus.circle").font(.title3)
                    }.buttonStyle(.borderless)
                }
                .padding(12)
                Divider()

                List(state.mdSkills) { skill in
                    Button {
                        selectedSkill = skill
                        loadSkillContent(skill)
                    } label: {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(skill.name ?? "Unnamed").font(.callout).fontWeight(.medium)
                            if let desc = skill.description, !desc.isEmpty {
                                Text(desc).font(.caption2).foregroundStyle(.secondary).lineLimit(1)
                            }
                        }
                    }
                    .buttonStyle(.plain)
                    .padding(.vertical, 4)
                    .listRowBackground(selectedSkill?.id == skill.id ? Color.accentColor.opacity(0.15) : Color.clear)
                }
                .listStyle(.plain)

                if !fileTree.isEmpty {
                    Divider()
                    VStack(alignment: .leading, spacing: 4) {
                        HStack {
                            Text("Files").font(.caption).fontWeight(.semibold).foregroundStyle(.secondary)
                            Spacer()
                            Button { showCreateFolder = true } label: {
                                Image(systemName: "folder.badge.plus").font(.caption)
                            }.buttonStyle(.borderless)
                            Button { showCreateFile = true } label: {
                                Image(systemName: "doc.badge.plus").font(.caption)
                            }.buttonStyle(.borderless)
                        }.padding(.horizontal, 12)

                        ScrollView {
                            VStack(alignment: .leading, spacing: 2) {
                                ForEach(fileTree) { node in
                                    FileTreeNodeView(node: node, depth: 0) { path in
                                        editingFilePath = path
                                        Task {
                                            if let content = await state.client.getMdSkillContent(path: path) {
                                                editingContent = content
                                            }
                                        }
                                    }
                                }
                            }.padding(.horizontal, 8)
                        }.frame(maxHeight: 200)
                    }.padding(.vertical, 8)
                }
            }
            .frame(minWidth: 220, maxWidth: 280)

            // Right: editor
            VStack(spacing: 0) {
                if !editingFilePath.isEmpty {
                    HStack {
                        Image(systemName: "doc.text").foregroundStyle(.secondary)
                        Text(URL(fileURLWithPath: editingFilePath).lastPathComponent).font(.callout).fontWeight(.medium)
                        Spacer()
                        if isSaving { ProgressView().controlSize(.small) }
                        else {
                            Button {
                                isSaving = true
                                Task {
                                    let _ = await state.client.saveMdSkillContent(path: editingFilePath, content: editingContent)
                                    isSaving = false
                                }
                            } label: {
                                Label("Save", systemImage: "square.and.arrow.down")
                            }.buttonStyle(.borderedProminent).controlSize(.small)
                        }
                    }.padding(12)
                    Divider()
                    TextEditor(text: $editingContent)
                        .font(.system(.body, design: .monospaced))
                        .scrollContentBackground(.hidden)
                        .padding(8)
                } else {
                    VStack(spacing: 12) {
                        Image(systemName: "doc.richtext").font(.system(size: 48)).foregroundStyle(.tertiary)
                        Text("Select a skill to edit").foregroundStyle(.secondary)
                    }.frame(maxWidth: .infinity, maxHeight: .infinity)
                }
            }
        }
        .navigationTitle("Skills Editor")
        .task { await state.refreshDashboardData() }
        .sheet(isPresented: $showCreateSkill) {
            VStack(spacing: 16) {
                Text("Create New Skill").font(.headline)
                TextField("Skill Name", text: $newSkillName).textFieldStyle(.roundedBorder)
                TextField("Description", text: $newSkillDesc).textFieldStyle(.roundedBorder)
                HStack {
                    Button("Cancel") { showCreateSkill = false }.keyboardShortcut(.cancelAction)
                    Spacer()
                    Button("Create") {
                        Task {
                            let _ = await state.client.createMdSkill(name: newSkillName, description: newSkillDesc)
                            await state.refreshDashboardData()
                            showCreateSkill = false; newSkillName = ""; newSkillDesc = ""
                        }
                    }.buttonStyle(.borderedProminent).keyboardShortcut(.defaultAction)
                    .disabled(newSkillName.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }.padding(24).frame(width: 380)
        }
        .sheet(isPresented: $showCreateFile) {
            VStack(spacing: 16) {
                Text("Create File").font(.headline)
                TextField("File name (e.g. guide.md)", text: $newFileName).textFieldStyle(.roundedBorder)
                HStack {
                    Button("Cancel") { showCreateFile = false }.keyboardShortcut(.cancelAction)
                    Spacer()
                    Button("Create") {
                        if let skill = selectedSkill, let skillPath = skill.path {
                            let dir = URL(fileURLWithPath: skillPath).deletingLastPathComponent().path
                            Task {
                                let _ = await state.client.createMdSkillFile(parentDir: dir, fileName: newFileName)
                                loadSkillContent(skill)
                                showCreateFile = false; newFileName = ""
                            }
                        }
                    }.buttonStyle(.borderedProminent).keyboardShortcut(.defaultAction)
                }
            }.padding(24).frame(width: 340)
        }
        .sheet(isPresented: $showCreateFolder) {
            VStack(spacing: 16) {
                Text("Create Folder").font(.headline)
                TextField("Folder name", text: $newFolderName).textFieldStyle(.roundedBorder)
                HStack {
                    Button("Cancel") { showCreateFolder = false }.keyboardShortcut(.cancelAction)
                    Spacer()
                    Button("Create") {
                        if let skill = selectedSkill, let skillPath = skill.path {
                            let dir = URL(fileURLWithPath: skillPath).deletingLastPathComponent().path
                            Task {
                                let _ = await state.client.createMdSkillFolder(skillDir: dir, folderName: newFolderName)
                                loadSkillContent(skill)
                                showCreateFolder = false; newFolderName = ""
                            }
                        }
                    }.buttonStyle(.borderedProminent).keyboardShortcut(.defaultAction)
                }
            }.padding(24).frame(width: 340)
        }
    }

    private func loadSkillContent(_ skill: OpenWhaleClient.MdSkillInfo) {
        guard let path = skill.path else { return }
        editingFilePath = path
        Task {
            if let content = await state.client.getMdSkillContent(path: path) {
                editingContent = content
            }
            let dir = URL(fileURLWithPath: path).deletingLastPathComponent().path
            if let tree = await state.client.getMdSkillTree(dir: dir) {
                fileTree = tree
            }
        }
    }
}

struct FileTreeNodeView: View {
    let node: OpenWhaleClient.FileNode
    let depth: Int
    let onSelect: (String) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 1) {
            Button { if let path = node.path, node.type == "file" { onSelect(path) } } label: {
                HStack(spacing: 4) {
                    Image(systemName: node.type == "directory" ? "folder.fill" : "doc.text")
                        .font(.caption2)
                        .foregroundStyle(node.type == "directory" ? .yellow : .secondary)
                    Text(node.name ?? "").font(.caption).lineLimit(1)
                }.padding(.leading, CGFloat(depth * 16))
            }
            .buttonStyle(.plain)

            if let children = node.children {
                ForEach(children) { child in
                    FileTreeNodeView(node: child, depth: depth + 1, onSelect: onSelect)
                }
            }
        }
    }
}

// ═══════════════════════════════════════════════
// MARK: - Tools Page
// ═══════════════════════════════════════════════

struct ToolsPage: View {
    @EnvironmentObject var state: AppState
    @State private var searchText = ""

    private var filteredTools: [OpenWhaleClient.ToolInfo] {
        if searchText.isEmpty { return state.tools }
        return state.tools.filter {
            ($0.name ?? "").localizedCaseInsensitiveContains(searchText) ||
            ($0.description ?? "").localizedCaseInsensitiveContains(searchText) ||
            ($0.category ?? "").localizedCaseInsensitiveContains(searchText)
        }
    }

    private var categories: [String] {
        let cats = Set(state.tools.compactMap { $0.category })
        return Array(cats).sorted()
    }

    var body: some View {
        VStack(spacing: 0) {
            // Search bar
            HStack {
                Image(systemName: "magnifyingglass").foregroundStyle(.secondary)
                TextField("Search tools...", text: $searchText).textFieldStyle(.plain)
                Text("\(state.tools.count) tools").font(.caption).foregroundStyle(.secondary)
            }
            .padding(12).background(.bar)
            Divider()

            ScrollView {
                LazyVStack(spacing: 8, pinnedViews: .sectionHeaders) {
                    ForEach(categories, id: \.self) { category in
                        let categoryTools = filteredTools.filter { $0.category == category }
                        if !categoryTools.isEmpty {
                            Section {
                                ForEach(categoryTools) { tool in
                                    ToolRow(tool: tool)
                                }
                            } header: {
                                HStack {
                                    Text(category.capitalized).font(.caption).fontWeight(.bold).foregroundStyle(.secondary)
                                    Text("(\(categoryTools.count))").font(.caption2).foregroundStyle(.tertiary)
                                    Spacer()
                                }
                                .padding(.horizontal, 24).padding(.vertical, 6)
                                .background(.bar)
                            }
                        }
                    }

                    // Uncategorized
                    let uncategorized = filteredTools.filter { ($0.category ?? "").isEmpty }
                    if !uncategorized.isEmpty {
                        Section {
                            ForEach(uncategorized) { tool in ToolRow(tool: tool) }
                        } header: {
                            HStack {
                                Text("Other").font(.caption).fontWeight(.bold).foregroundStyle(.secondary)
                                Spacer()
                            }.padding(.horizontal, 24).padding(.vertical, 6).background(.bar)
                        }
                    }
                }.padding(.bottom, 16)
            }
        }
        .navigationTitle("Tools")
        .task { await state.refreshDashboardData() }
    }
}

struct ToolRow: View {
    let tool: OpenWhaleClient.ToolInfo

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: "wrench.and.screwdriver")
                .font(.title3)
                .foregroundStyle(tool.disabled ?? false ? Color.secondary : Color.blue)
                .frame(width: 30)

            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 6) {
                    Text(tool.name ?? "").font(.callout).fontWeight(.medium)
                    if tool.disabled ?? false {
                        Text("Disabled").font(.system(size: 9)).foregroundStyle(.orange)
                            .padding(.horizontal, 4).padding(.vertical, 1)
                            .background(Color.orange.opacity(0.1), in: Capsule())
                    }
                    if tool.requiresApproval ?? false {
                        Image(systemName: "exclamationmark.shield").font(.caption2).foregroundStyle(.orange)
                    }
                    if tool.requiresElevated ?? false {
                        Image(systemName: "lock.shield").font(.caption2).foregroundStyle(.red)
                    }
                }
                if let desc = tool.description {
                    Text(desc).font(.caption).foregroundStyle(.secondary).lineLimit(2)
                }
            }
            Spacer()
        }
        .padding(.horizontal, 24).padding(.vertical, 6)
    }
}

// ═══════════════════════════════════════════════
// MARK: - Heartbeat Page
// ═══════════════════════════════════════════════

struct HeartbeatPage: View {
    @EnvironmentObject var state: AppState
    @State private var mdEditorText = ""
    @State private var isSavingMd = false
    @State private var isSavingConfig = false
    @State private var showSavedAlert = false

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                // Status
                GroupBox {
                    VStack(alignment: .leading, spacing: 16) {
                        HStack {
                            Label("Heartbeat Status", systemImage: "heart.fill").font(.headline)
                            Spacer()
                            Toggle("", isOn: Binding(
                                get: { state.heartbeatConfig.enabled },
                                set: { val in state.heartbeatConfig.enabled = val; Task { await state.saveHeartbeatSettings() } }
                            )).toggleStyle(.switch)
                        }
                        LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 3), spacing: 16) {
                            StatusCard(label: "Status", value: state.heartbeat.running ? "Running" : "Stopped",
                                       icon: state.heartbeat.running ? "bolt.fill" : "bolt.slash",
                                       color: state.heartbeat.running ? .green : .orange)
                            StatusCard(label: "Interval", value: state.heartbeatConfig.every, icon: "clock", color: .blue)
                            StatusCard(label: "Last Result", value: state.heartbeat.lastResult ?? "N/A",
                                       icon: state.heartbeat.lastResult == "ok" ? "checkmark.circle" : "exclamationmark.triangle",
                                       color: state.heartbeat.lastResult == "ok" ? .green : .orange)
                        }
                    }.padding(4)
                }

                // Alerts / Notifications
                if !state.heartbeatAlerts.isEmpty {
                    GroupBox {
                        VStack(alignment: .leading, spacing: 8) {
                            Label("Recent Alerts (\(state.heartbeatAlerts.count))", systemImage: "bell.badge.fill").font(.headline).foregroundStyle(.orange)
                            ForEach(state.heartbeatAlerts, id: \.stableId) { alert in
                                HStack(alignment: .top, spacing: 8) {
                                    Image(systemName: "exclamationmark.triangle.fill").foregroundStyle(.orange).font(.caption)
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(alert.text ?? "").font(.callout)
                                        HStack {
                                            if let ts = alert.timestamp { Text(ts).font(.caption2).foregroundStyle(.tertiary) }
                                            if let fwd = alert.forwardedTo, !fwd.isEmpty {
                                                Text("→ \(fwd.joined(separator: ", "))").font(.caption2).foregroundStyle(.blue)
                                            }
                                        }
                                    }
                                }
                                .padding(8).background(Color.orange.opacity(0.06), in: RoundedRectangle(cornerRadius: 6))
                            }
                        }.padding(4)
                    }
                }

                // Config
                GroupBox {
                    VStack(alignment: .leading, spacing: 16) {
                        Label("Configuration", systemImage: "gearshape.fill").font(.headline)
                        HStack {
                            Text("Interval").font(.subheadline).foregroundStyle(.secondary)
                            Spacer()
                            Picker("", selection: $state.heartbeatConfig.every) {
                                Text("5 min").tag("5m"); Text("10 min").tag("10m"); Text("15 min").tag("15m")
                                Text("30 min").tag("30m"); Text("1 hour").tag("1h"); Text("2 hours").tag("2h")
                            }.frame(width: 130)
                        }
                        Divider()
                        HStack(spacing: 16) {
                            VStack(alignment: .leading, spacing: 4) {
                                Text("Active Hours Start").font(.caption).foregroundStyle(.secondary)
                                TextField("08:00", text: $state.heartbeatConfig.activeHoursStart).textFieldStyle(.roundedBorder).frame(width: 100)
                            }
                            VStack(alignment: .leading, spacing: 4) {
                                Text("Active Hours End").font(.caption).foregroundStyle(.secondary)
                                TextField("24:00", text: $state.heartbeatConfig.activeHoursEnd).textFieldStyle(.roundedBorder).frame(width: 100)
                            }
                            Spacer()
                        }
                        Divider()
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Model Override").font(.caption).foregroundStyle(.secondary)
                            TextField("Leave empty for default", text: $state.heartbeatConfig.model).textFieldStyle(.roundedBorder)
                        }
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Forward Alerts To").font(.caption).foregroundStyle(.secondary)
                            Picker("", selection: $state.heartbeatConfig.forwardTo) {
                                Text("Dashboard Only").tag(""); Text("All Channels").tag("all")
                                Text("WhatsApp").tag("whatsapp"); Text("Telegram").tag("telegram")
                                Text("Discord").tag("discord"); Text("iMessage").tag("imessage")
                            }.labelsHidden()
                        }
                        Divider()
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Heartbeat Prompt").font(.caption).foregroundStyle(.secondary)
                            TextEditor(text: $state.heartbeatConfig.prompt).font(.callout).frame(height: 80)
                                .scrollContentBackground(.hidden).padding(8)
                                .background(Color.secondary.opacity(0.06), in: RoundedRectangle(cornerRadius: 8))
                        }
                        HStack {
                            Spacer()
                            if showSavedAlert { Text("✓ Saved").font(.caption).foregroundStyle(.green) }
                            Button {
                                isSavingConfig = true
                                Task {
                                    await state.saveHeartbeatSettings()
                                    isSavingConfig = false; showSavedAlert = true
                                    DispatchQueue.main.asyncAfter(deadline: .now() + 2) { showSavedAlert = false }
                                }
                            } label: {
                                if isSavingConfig { ProgressView().controlSize(.small) }
                                else { Label("Save Configuration", systemImage: "checkmark.circle") }
                            }.buttonStyle(.borderedProminent).disabled(isSavingConfig)
                        }
                    }.padding(4)
                }

                // HEARTBEAT.md
                GroupBox {
                    VStack(alignment: .leading, spacing: 12) {
                        HStack {
                            Label("HEARTBEAT.md", systemImage: "doc.text.fill").font(.headline)
                            Spacer()
                            if !state.heartbeatMdPath.isEmpty {
                                Text(state.heartbeatMdPath).font(.caption2).foregroundStyle(.tertiary).lineLimit(1).truncationMode(.middle)
                            }
                        }
                        TextEditor(text: $mdEditorText).font(.system(.body, design: .monospaced)).frame(minHeight: 200)
                            .scrollContentBackground(.hidden).padding(8)
                            .background(Color.secondary.opacity(0.06), in: RoundedRectangle(cornerRadius: 8))
                        HStack {
                            Button("Reset") { mdEditorText = state.heartbeatMdContent }.buttonStyle(.bordered)
                            Spacer()
                            Button {
                                isSavingMd = true
                                Task { await state.saveHeartbeatMdContent(mdEditorText); isSavingMd = false }
                            } label: {
                                if isSavingMd { ProgressView().controlSize(.small) }
                                else { Label("Save HEARTBEAT.md", systemImage: "square.and.arrow.down") }
                            }.buttonStyle(.borderedProminent).disabled(isSavingMd)
                        }
                    }.padding(4)
                }
            }.padding(24)
        }
        .navigationTitle("Heartbeat")
        .task { await state.refreshDashboardData(); mdEditorText = state.heartbeatMdContent }
    }
}

struct StatusCard: View {
    let label: String; let value: String; let icon: String; let color: Color
    var body: some View {
        VStack(spacing: 6) {
            Image(systemName: icon).font(.title3).foregroundStyle(color)
            Text(value).font(.callout).fontWeight(.semibold)
            Text(label).font(.caption2).foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity).padding(12)
        .background(color.opacity(0.08), in: RoundedRectangle(cornerRadius: 10))
    }
}

struct ChannelPill: View {
    let channel: OpenWhaleClient.ChannelInfo
    private let iconMap: [String: String] = ["whatsapp": "📱", "telegram": "✈️", "discord": "🎮", "imessage": "💬", "slack": "💼", "twitter": "🐦", "web": "🌐"]
    var body: some View {
        HStack(spacing: 6) {
            Text(iconMap[channel.type] ?? "📡")
            Text(channel.name).font(.callout).fontWeight(.medium)
            Spacer()
            Circle().fill(channel.connected ? Color.green : Color.red.opacity(0.6)).frame(width: 8, height: 8)
        }
        .padding(.horizontal, 10).padding(.vertical, 8)
        .background(.quaternary.opacity(0.5), in: RoundedRectangle(cornerRadius: 8))
    }
}

// ═══════════════════════════════════════════════
// MARK: - Logs Page
// ═══════════════════════════════════════════════

struct LogsPage: View {
    @EnvironmentObject var state: AppState
    @State private var isRefreshing = false

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Text("\(state.logs.count) entries").font(.caption).foregroundStyle(.secondary)
                Spacer()
                Button {
                    isRefreshing = true
                    Task { await state.refreshDashboardData(); isRefreshing = false }
                } label: {
                    Label("Refresh", systemImage: "arrow.clockwise").font(.caption)
                }.buttonStyle(.bordered).controlSize(.small).disabled(isRefreshing)
            }.padding(.horizontal, 24).padding(.vertical, 8)
            Divider()

            if state.logs.isEmpty {
                VStack(spacing: 12) {
                    Image(systemName: "doc.text.magnifyingglass").font(.system(size: 48)).foregroundStyle(.tertiary)
                    Text("No log entries").foregroundStyle(.secondary)
                }.frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                List(state.logs) { entry in
                    HStack(spacing: 12) {
                        logLevelBadge(entry.level ?? "info")
                        VStack(alignment: .leading, spacing: 2) {
                            Text(entry.message ?? "").font(.callout).lineLimit(2)
                            HStack {
                                if let cat = entry.category {
                                    Text(cat).font(.caption2).foregroundStyle(.blue)
                                        .padding(.horizontal, 4).padding(.vertical, 1)
                                        .background(Color.blue.opacity(0.1), in: Capsule())
                                }
                                if let time = entry.timestamp {
                                    Text(time).font(.caption2).foregroundStyle(.tertiary)
                                }
                            }
                        }
                    }.padding(.vertical, 2)
                }.listStyle(.inset)
            }
        }
        .navigationTitle("Logs")
        .task { await state.refreshDashboardData() }
    }

    private func logLevelBadge(_ level: String) -> some View {
        let color: Color = switch level {
        case "error": .red; case "warn": .orange; case "debug": .purple; default: .green
        }
        return Text(level.uppercased())
            .font(.system(size: 9, weight: .bold, design: .monospaced))
            .foregroundStyle(color).frame(width: 40).padding(.vertical, 2)
            .background(color.opacity(0.1), in: RoundedRectangle(cornerRadius: 4))
    }
}
