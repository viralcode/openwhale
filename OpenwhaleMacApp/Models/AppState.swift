import Foundation
import AppKit
import Combine

/// Observable state model for the entire app
@MainActor
class AppState: ObservableObject {
    @Published var isConnected = false
    @Published var serverVersion = ""
    @Published var activeModel = ""
    @Published var channels: [OpenWhaleClient.ChannelInfo] = []
    @Published var heartbeat = HeartbeatStatus()
    @Published var heartbeatConfig = HeartbeatConfig()
    @Published var heartbeatMdContent = ""
    @Published var heartbeatMdPath = ""
    @Published var heartbeatMdExists = false
    @Published var heartbeatAlerts: [OpenWhaleClient.HeartbeatAlert] = []
    @Published var chatInput = ""
    @Published var chatMessages: [ChatMessage] = []
    @Published var isSending = false
    @Published var healthTimestamp = ""

    // Dashboard-level data
    @Published var stats = StatsData()
    @Published var logs: [OpenWhaleClient.LogEntry] = []
    @Published var sessions: [OpenWhaleClient.SessionInfo] = []
    @Published var providers: [OpenWhaleClient.ProvidersResponse.ProviderInfo] = []
    @Published var tools: [OpenWhaleClient.ToolInfo] = []
    @Published var skills: [OpenWhaleClient.SkillInfo] = []
    @Published var mdSkills: [OpenWhaleClient.MdSkillInfo] = []

    let client = OpenWhaleClient()
    private var pollTimer: Timer?

    struct HeartbeatStatus {
        var enabled = false
        var running = false
        var every = "30m"
        var lastRunAt: String? = nil
        var lastResult: String? = nil
        var heartbeatMdExists = false
    }

    struct HeartbeatConfig {
        var enabled = false
        var every = "30m"
        var prompt = ""
        var activeHoursStart = ""
        var activeHoursEnd = ""
        var model = ""
        var forwardTo = ""
    }

    struct StatsData {
        var users = 0
        var sessions = 0
        var messages = 0
        var totalTokens = 0
    }

    enum ChatStepKind: String {
        case user, assistant, toolStart, toolEnd, thinking, error
    }

    struct ChatMessage: Identifiable {
        let id = UUID()
        let kind: ChatStepKind
        var content: String
        let toolName: String?
        let toolStatus: String?
        let timestamp = Date()

        init(kind: ChatStepKind, content: String, toolName: String? = nil, toolStatus: String? = nil) {
            self.kind = kind
            self.content = content
            self.toolName = toolName
            self.toolStatus = toolStatus
        }
    }

    init() {
        startPolling()
    }

    func startPolling() {
        Task { await refresh() }
        pollTimer = Timer.scheduledTimer(withTimeInterval: 5, repeats: true) { [weak self] _ in
            Task { @MainActor in await self?.refresh() }
        }
    }

    func refresh() async {
        if let health = await client.getHealth() {
            isConnected = true
            serverVersion = health.version ?? ""
            healthTimestamp = health.timestamp ?? ""
        } else {
            isConnected = false
            channels = []
            return
        }

        activeModel = await client.getActiveModel()

        if let provResp = await client.getProviders() {
            providers = provResp.providers ?? []
        }

        if let channelData = await client.getChannelStatus() {
            channels = channelData
        }

        if let hb = await client.getHeartbeatStatus() {
            heartbeat.enabled = hb.enabled ?? false
            heartbeat.running = hb.running ?? false
            heartbeat.every = hb.every ?? "30m"
            heartbeat.lastRunAt = hb.lastRunAt
            heartbeat.lastResult = hb.lastResult
            heartbeat.heartbeatMdExists = hb.heartbeatMdExists ?? false
        }

        if let cfg = await client.getHeartbeatConfig() {
            heartbeatConfig.enabled = cfg.enabled ?? false
            heartbeatConfig.every = cfg.every ?? "30m"
            heartbeatConfig.prompt = cfg.prompt ?? ""
            heartbeatConfig.activeHoursStart = cfg.activeHoursStart ?? ""
            heartbeatConfig.activeHoursEnd = cfg.activeHoursEnd ?? ""
            heartbeatConfig.model = cfg.model ?? ""
            heartbeatConfig.forwardTo = cfg.forwardTo ?? ""
        }
    }

    func refreshDashboardData() async {
        if let s = await client.getStats() {
            stats.users = s.users ?? 0
            stats.sessions = s.sessions ?? 0
            stats.messages = s.messages ?? 0
            stats.totalTokens = s.tokenUsage?.total ?? 0
        }

        if let l = await client.getLogs() {
            logs = l.entries ?? []
        }

        if let sess = await client.getSessions() {
            sessions = sess.sessions ?? []
        }

        if let md = await client.getHeartbeatMd() {
            heartbeatMdContent = md.content ?? ""
            heartbeatMdPath = md.path ?? ""
            heartbeatMdExists = md.exists ?? false
        }

        if let t = await client.getTools() {
            tools = t
        }

        if let s = await client.getSkills() {
            skills = s
        }

        if let ms = await client.getMdSkills() {
            mdSkills = ms
        }

        if let a = await client.getHeartbeatAlerts() {
            heartbeatAlerts = a
        }
    }

    func sendMessage() async {
        let text = chatInput.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        chatMessages.append(ChatMessage(kind: .user, content: text))
        chatInput = ""
        isSending = true

        // Track streaming state — mirrors dashboard's streamingSteps/streamingContent
        var pendingContent = ""
        var gotDone = false
        // Track the index of the current "thinking" step so we can UPDATE it instead of adding duplicates
        var currentThinkingIdx: Int? = nil

        await client.sendChatStream(text) { [weak self] event in
            Task { @MainActor in
                guard let self = self else { return }
                switch event {
                case .toolStart(let name, _):
                    // Remove current thinking indicator (replaces it with the tool step)
                    if let tIdx = currentThinkingIdx, tIdx < self.chatMessages.count {
                        self.chatMessages.remove(at: tIdx)
                        currentThinkingIdx = nil
                    }
                    self.chatMessages.append(ChatMessage(kind: .toolStart, content: "Running \(name)...", toolName: name))

                case .toolEnd(let name, _, let result):
                    // Find and replace the matching toolStart with a toolEnd
                    if let startIdx = self.chatMessages.lastIndex(where: { $0.kind == .toolStart && $0.toolName == name }) {
                        let preview = (result ?? "").prefix(500)
                        self.chatMessages[startIdx] = ChatMessage(kind: .toolEnd, content: "\(name) completed", toolName: name, toolStatus: String(preview))
                    } else {
                        let preview = (result ?? "").prefix(500)
                        self.chatMessages.append(ChatMessage(kind: .toolEnd, content: "\(name) completed", toolName: name, toolStatus: String(preview)))
                    }

                case .thinking(let text):
                    // Update existing thinking step or create one
                    if let tIdx = currentThinkingIdx, tIdx < self.chatMessages.count {
                        self.chatMessages[tIdx] = ChatMessage(kind: .thinking, content: text)
                    } else {
                        self.chatMessages.append(ChatMessage(kind: .thinking, content: text))
                        currentThinkingIdx = self.chatMessages.count - 1
                    }

                case .content(let text):
                    // Buffer content — dashboard does NOT show content until done
                    // (mid-stream content happens between tool iterations)
                    pendingContent += text

                case .done(let fullContent):
                    gotDone = true
                    // Remove any remaining thinking indicator
                    if let tIdx = currentThinkingIdx, tIdx < self.chatMessages.count {
                        self.chatMessages.remove(at: tIdx)
                        currentThinkingIdx = nil
                    }
                    // Create the final assistant message
                    let finalText = fullContent.isEmpty ? pendingContent : fullContent
                    if !finalText.isEmpty {
                        self.chatMessages.append(ChatMessage(kind: .assistant, content: finalText))
                    }

                case .error(let message):
                    self.chatMessages.append(ChatMessage(kind: .error, content: message))
                }
            }
        }

        // Stream closed — ensure we have a response
        if !gotDone && !pendingContent.isEmpty {
            chatMessages.append(ChatMessage(kind: .assistant, content: pendingContent))
        } else if !gotDone && pendingContent.isEmpty {
            chatMessages.append(ChatMessage(kind: .error, content: "No response received"))
        }
        isSending = false
    }

    func openDashboard() {
        if let url = URL(string: "http://localhost:7777/dashboard") {
            NSWorkspace.shared.open(url)
        }
    }

    func toggleHeartbeat() async {
        let newState = !heartbeat.enabled
        await client.setHeartbeatEnabled(newState)
        await refresh()
    }

    func toggleChannel(_ type: String) async {
        if let ch = channels.first(where: { $0.type == type }) {
            let _ = await client.toggleChannel(type, enabled: !ch.enabled)
            await refresh()
        }
    }

    func saveHeartbeatMdContent(_ content: String) async {
        let _ = await client.saveHeartbeatMd(content)
        heartbeatMdContent = content
    }

    func saveHeartbeatSettings() async {
        let config: [String: Any] = [
            "enabled": heartbeatConfig.enabled,
            "every": heartbeatConfig.every,
            "prompt": heartbeatConfig.prompt,
            "activeHoursStart": heartbeatConfig.activeHoursStart,
            "activeHoursEnd": heartbeatConfig.activeHoursEnd,
            "model": heartbeatConfig.model,
            "forwardTo": heartbeatConfig.forwardTo,
        ]
        let _ = await client.saveHeartbeatConfig(config)
        await refresh()
    }

    func saveProviderConfig(type: String, apiKey: String?, enabled: Bool?, selectedModel: String?) async {
        let _ = await client.saveProviderConfig(type: type, apiKey: apiKey, enabled: enabled, selectedModel: selectedModel)
        await refresh()
    }

    func saveSkillConfig(id: String, apiKey: String?, enabled: Bool?) async {
        let _ = await client.saveSkillConfig(id: id, apiKey: apiKey, enabled: enabled)
        if let s = await client.getSkills() {
            skills = s
        }
    }

    func startOpenWhaleService() {
        // Launch openwhale server in background
        let task = Process()
        task.launchPath = "/usr/bin/env"
        task.arguments = ["bash", "-c", "cd ~/Desktop/openwhale/openwhale && npm run start &"]
        task.standardOutput = FileHandle.nullDevice
        task.standardError = FileHandle.nullDevice
        try? task.launch()
    }
}
