import Foundation

/// HTTP client for communicating with the OpenWhale server
actor OpenWhaleClient {
    private let baseURL = "http://localhost:7777"
    private let session: URLSession

    init() {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 60
        config.timeoutIntervalForResource = 600  // 10 mins for long tool chains
        self.session = URLSession(configuration: config)
    }

    // MARK: - Health

    struct HealthResponse: Codable {
        let status: String?
        let version: String?
        let timestamp: String?
        let providers: Int?
    }

    func getHealth() async -> HealthResponse? {
        return await get("/health")
    }

    // MARK: - Providers

    struct ProvidersResponse: Codable {
        let providers: [ProviderInfo]?

        struct ProviderInfo: Codable, Identifiable {
            let name: String?
            let type: String?
            let enabled: Bool?
            let hasKey: Bool?
            let supportsTools: Bool?
            let supportsVision: Bool?
            let models: [String]?

            var id: String { type ?? name ?? UUID().uuidString }
        }
    }

    func getProviders() async -> ProvidersResponse? {
        return await get("/dashboard/api/providers")
    }

    func getActiveModel() async -> String {
        guard let resp = await getProviders() else { return "" }
        if let active = resp.providers?.first(where: { ($0.enabled ?? false) && ($0.hasKey ?? false) }) {
            return active.models?.first ?? active.name ?? ""
        }
        return ""
    }

    func saveProviderConfig(type: String, apiKey: String?, enabled: Bool?, selectedModel: String?) async -> Bool {
        var body: [String: Any] = [:]
        if let apiKey = apiKey { body["apiKey"] = apiKey }
        if let enabled = enabled { body["enabled"] = enabled }
        if let selectedModel = selectedModel { body["selectedModel"] = selectedModel }
        return await postRaw("/dashboard/api/providers/\(type)/config", body: body)
    }

    // MARK: - Channel Status

    struct ChannelInfo: Identifiable, Codable {
        let name: String
        let type: String
        let enabled: Bool
        let connected: Bool
        let messagesSent: Int?
        let messagesReceived: Int?
        var id: String { type }
    }

    struct ChannelsResponse: Codable {
        let channels: [ChannelInfo]?
    }

    func getChannelStatus() async -> [ChannelInfo]? {
        guard let resp: ChannelsResponse = await get("/dashboard/api/channels") else { return nil }
        return resp.channels
    }

    func toggleChannel(_ type: String, enabled: Bool) async -> Bool {
        struct Body: Codable { let enabled: Bool }
        struct Resp: Codable { let ok: Bool? }
        let resp: Resp? = await post("/dashboard/api/channels/\(type)/toggle", body: Body(enabled: enabled))
        return resp?.ok ?? false
    }

    // MARK: - Heartbeat

    struct HeartbeatConfigResponse: Codable {
        let ok: Bool?
        let enabled: Bool?
        let every: String?
        let prompt: String?
        let activeHoursStart: String?
        let activeHoursEnd: String?
        let model: String?
        let forwardTo: String?
    }

    struct HeartbeatStatusResponse: Codable {
        let ok: Bool?
        let enabled: Bool?
        let running: Bool?
        let every: String?
        let lastRunAt: String?
        let lastResult: String?
        let nextDueAt: String?
        let heartbeatMdExists: Bool?
    }

    struct HeartbeatMdResponse: Codable {
        let ok: Bool?
        let content: String?
        let path: String?
        let exists: Bool?
    }

    struct HeartbeatAlert: Codable, Identifiable {
        let id: String?
        let text: String?
        let timestamp: String?
        let forwardedTo: [String]?

        var stableId: String { id ?? UUID().uuidString }
    }

    struct HeartbeatAlertsResponse: Codable {
        let ok: Bool?
        let alerts: [HeartbeatAlert]?
    }

    func getHeartbeatConfig() async -> HeartbeatConfigResponse? {
        return await get("/dashboard/api/settings/heartbeat")
    }

    func getHeartbeatStatus() async -> HeartbeatStatusResponse? {
        return await get("/dashboard/api/settings/heartbeat/status")
    }

    func setHeartbeatEnabled(_ enabled: Bool) async {
        struct Body: Codable { let enabled: Bool }
        let _: EmptyResponse? = await post("/dashboard/api/settings/heartbeat", body: Body(enabled: enabled))
    }

    func saveHeartbeatConfig(_ config: [String: Any]) async -> Bool {
        return await postRaw("/dashboard/api/settings/heartbeat", body: config)
    }

    func getHeartbeatMd() async -> HeartbeatMdResponse? {
        return await get("/dashboard/api/settings/heartbeat/md")
    }

    func saveHeartbeatMd(_ content: String) async -> Bool {
        struct Body: Codable { let content: String }
        struct Resp: Codable { let ok: Bool? }
        let resp: Resp? = await post("/dashboard/api/settings/heartbeat/md", body: Body(content: content))
        return resp?.ok ?? false
    }

    func getHeartbeatAlerts() async -> [HeartbeatAlert]? {
        let resp: HeartbeatAlertsResponse? = await get("/dashboard/api/settings/heartbeat/alerts")
        return resp?.alerts
    }

    // MARK: - Chat History (matches dashboard's loadMessages / clearChat)

    struct ChatHistoryResponse: Codable {
        struct HistoryMessage: Codable {
            let id: String?
            let role: String
            let content: String
            let createdAt: String?
            let toolCalls: [HistoryToolCall]?
        }
        struct HistoryToolCall: Codable {
            let name: String?
            let status: String?
            let arguments: AnyCodable? // We just need the name/status
        }
        let messages: [HistoryMessage]?
    }

    /// Wrapper for dynamic JSON values in tool call arguments
    struct AnyCodable: Codable {
        let value: Any
        init(from decoder: Decoder) throws {
            let container = try decoder.singleValueContainer()
            if let dict = try? container.decode([String: String].self) {
                value = dict
            } else if let str = try? container.decode(String.self) {
                value = str
            } else {
                value = ""
            }
        }
        func encode(to encoder: Encoder) throws {
            var container = encoder.singleValueContainer()
            try container.encode("")
        }
    }

    func getChatHistory() async -> [ChatHistoryResponse.HistoryMessage] {
        let resp: ChatHistoryResponse? = await get("/dashboard/api/chat/history")
        return resp?.messages ?? []
    }

    func clearChatHistory() async -> Bool {
        return await delete("/dashboard/api/chat/history")
    }

    // MARK: - Chat (SSE Streaming with Tool Calls)

    enum ChatEvent {
        case toolStart(name: String, args: String?)
        case toolEnd(name: String, status: String?, result: String?)
        case thinking(text: String)
        case content(text: String)
        case done(fullContent: String)
        case error(message: String)
        case planCreated(title: String, steps: [[String: Any]])
        case planStepUpdate(stepId: Int, status: String, notes: String?)
        case planCompleted
    }

    func sendChatStream(_ message: String, onEvent: @escaping @Sendable (ChatEvent) -> Void) async {
        guard let url = URL(string: "\(baseURL)/dashboard/api/chat/stream") else {
            onEvent(.error(message: "Invalid URL"))
            return
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("text/event-stream", forHTTPHeaderField: "Accept")
        request.httpBody = try? JSONEncoder().encode(["message": message])
        request.timeoutInterval = 600  // 10 min for long tool chains

        do {
            let (bytes, response) = try await session.bytes(for: request)
            guard let httpResponse = response as? HTTPURLResponse,
                  (200...299).contains(httpResponse.statusCode) else {
                onEvent(.error(message: "Server error"))
                return
            }

            var fullContent = ""
            var gotDone = false

            for try await line in bytes.lines {
                guard line.hasPrefix("data: ") else { continue }
                let jsonStr = String(line.dropFirst(6))
                guard let data = jsonStr.data(using: .utf8),
                      let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                      let event = json["event"] as? String,
                      let eventData = json["data"] as? [String: Any] else { continue }

                switch event {
                case "tool_start":
                    let name = eventData["name"] as? String ?? "unknown"
                    // Server sends "arguments" not "args"
                    let argsStr: String?
                    if let argsDict = eventData["arguments"] as? [String: Any] {
                        argsStr = try? String(data: JSONSerialization.data(withJSONObject: argsDict), encoding: .utf8)
                    } else {
                        argsStr = nil
                    }
                    onEvent(.toolStart(name: name, args: argsStr))

                case "tool_end":
                    let name = eventData["name"] as? String ?? "unknown"
                    let status = eventData["status"] as? String
                    // Result can be any type (string, dict, array, etc.)
                    let result: String?
                    if let str = eventData["result"] as? String {
                        result = str
                    } else if let obj = eventData["result"] {
                        result = try? String(data: JSONSerialization.data(withJSONObject: obj), encoding: .utf8)
                    } else {
                        result = nil
                    }
                    onEvent(.toolEnd(name: name, status: status, result: result))

                case "thinking":
                    // Server sends {iteration, maxIterations} not {text}
                    let iteration = eventData["iteration"] as? Int ?? 1
                    let maxIter = eventData["maxIterations"] as? Int ?? 25
                    onEvent(.thinking(text: "Thinking (round \(iteration)/\(maxIter))..."))

                case "content":
                    let text = eventData["text"] as? String ?? ""
                    fullContent += text
                    onEvent(.content(text: text))

                case "done":
                    gotDone = true
                    if let msg = eventData["message"] as? [String: Any],
                       let content = msg["content"] as? String {
                        fullContent = content
                    }
                    onEvent(.done(fullContent: fullContent))

                case "error":
                    let msg = eventData["message"] as? String ?? "Unknown error"
                    onEvent(.error(message: msg))

                case "plan_created":
                    let title = eventData["title"] as? String ?? "Plan"
                    let steps = eventData["steps"] as? [[String: Any]] ?? []
                    onEvent(.planCreated(title: title, steps: steps))

                case "plan_step_update":
                    let stepId = eventData["stepId"] as? Int ?? 0
                    let status = eventData["status"] as? String ?? "pending"
                    let notes = eventData["notes"] as? String
                    onEvent(.planStepUpdate(stepId: stepId, status: status, notes: notes))

                case "plan_completed":
                    onEvent(.planCompleted)

                default:
                    break
                }
            }

            // If stream ended without done event
            if !gotDone && !fullContent.isEmpty {
                onEvent(.done(fullContent: fullContent))
            }
        } catch {
            onEvent(.error(message: error.localizedDescription))
        }
    }

    /// Fallback non-streaming chat (increased timeout)
    func sendChat(_ message: String) async -> String? {
        struct ChatBody: Codable { let message: String }
        struct ChatResponse: Codable {
            let content: String?
            let role: String?
            let id: String?
            let error: String?
        }

        if let resp: ChatResponse = await post("/dashboard/api/chat", body: ChatBody(message: message)) {
            if let content = resp.content, !content.isEmpty { return content }
            if let error = resp.error { return "⚠️ \(error)" }
        }
        return nil
    }

    // MARK: - Stats

    struct StatsResponse: Codable {
        let users: Int?
        let sessions: Int?
        let messages: Int?
        let tokenUsage: TokenUsage?
        struct TokenUsage: Codable {
            let input: Int?
            let output: Int?
            let total: Int?
        }
    }

    func getStats() async -> StatsResponse? {
        return await get("/dashboard/api/stats")
    }

    // MARK: - Logs

    struct LogEntry: Codable, Identifiable {
        let timestamp: String?
        let level: String?
        let category: String?
        let message: String?
        var id: String { "\(timestamp ?? "")-\(message ?? "")" }
    }

    struct LogsResponse: Codable {
        let entries: [LogEntry]?
        let total: Int?
    }

    func getLogs(page: Int = 0, limit: Int = 50) async -> LogsResponse? {
        return await get("/dashboard/api/logs?page=\(page)&limit=\(limit)")
    }

    // MARK: - Tools

    struct ToolInfo: Codable, Identifiable {
        let name: String?
        let description: String?
        let category: String?
        let disabled: Bool?
        let requiresApproval: Bool?
        let requiresElevated: Bool?
        var id: String { name ?? UUID().uuidString }
    }

    struct ToolsResponse: Codable {
        let tools: [ToolInfo]?
    }

    func getTools() async -> [ToolInfo]? {
        let resp: ToolsResponse? = await get("/dashboard/api/tools")
        return resp?.tools
    }

    // MARK: - API Skills

    struct SkillInfo: Codable, Identifiable {
        let id: String
        let name: String?
        let enabled: Bool?
        let hasKey: Bool?
        let description: String?
        let noCreds: Bool?
        let multiField: Bool?
    }

    struct SkillsResponse: Codable {
        let skills: [SkillInfo]?
    }

    func getSkills() async -> [SkillInfo]? {
        let resp: SkillsResponse? = await get("/dashboard/api/skills")
        return resp?.skills
    }

    func saveSkillConfig(id: String, apiKey: String?, enabled: Bool?) async -> Bool {
        var body: [String: Any] = [:]
        if let apiKey = apiKey { body["apiKey"] = apiKey }
        if let enabled = enabled { body["enabled"] = enabled }
        return await postRaw("/dashboard/api/skills/\(id)/config", body: body)
    }

    // MARK: - MD Skills

    struct MdSkillInfo: Codable, Identifiable {
        let name: String?
        let description: String?
        let path: String?
        var id: String { path ?? name ?? UUID().uuidString }
    }

    struct MdSkillsResponse: Codable {
        let mdSkills: [MdSkillInfo]?
    }

    struct MdSkillContentResponse: Codable {
        let content: String?
    }

    struct FileNode: Codable, Identifiable {
        let name: String?
        let path: String?
        let type: String?
        let children: [FileNode]?
        var id: String { path ?? name ?? UUID().uuidString }
    }

    struct FileTreeResponse: Codable {
        let tree: [FileNode]?
    }

    func getMdSkills() async -> [MdSkillInfo]? {
        let resp: MdSkillsResponse? = await get("/dashboard/api/md-skills")
        return resp?.mdSkills
    }

    func getMdSkillContent(path: String) async -> String? {
        let encoded = path.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? path
        let resp: MdSkillContentResponse? = await get("/dashboard/api/md-skills/content?path=\(encoded)")
        return resp?.content
    }

    func getMdSkillTree(dir: String) async -> [FileNode]? {
        let encoded = dir.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? dir
        let resp: FileTreeResponse? = await get("/dashboard/api/md-skills/tree?dir=\(encoded)")
        return resp?.tree
    }

    func saveMdSkillContent(path: String, content: String) async -> Bool {
        struct Body: Codable { let path: String; let content: String }
        struct Resp: Codable { let success: Bool? }
        let resp: Resp? = await post("/dashboard/api/md-skills/save", body: Body(path: path, content: content))
        return resp?.success ?? false
    }

    func createMdSkill(name: String, description: String) async -> Bool {
        struct Body: Codable { let name: String; let description: String }
        struct Resp: Codable { let success: Bool? }
        let resp: Resp? = await post("/dashboard/api/md-skills/create", body: Body(name: name, description: description))
        return resp?.success ?? false
    }

    func createMdSkillFolder(skillDir: String, folderName: String) async -> Bool {
        struct Body: Codable { let skillDir: String; let folderName: String }
        struct Resp: Codable { let success: Bool? }
        let resp: Resp? = await post("/dashboard/api/md-skills/create-folder", body: Body(skillDir: skillDir, folderName: folderName))
        return resp?.success ?? false
    }

    func createMdSkillFile(parentDir: String, fileName: String, content: String = "") async -> Bool {
        struct Body: Codable { let parentDir: String; let fileName: String; let content: String }
        struct Resp: Codable { let success: Bool? }
        let resp: Resp? = await post("/dashboard/api/md-skills/create-file", body: Body(parentDir: parentDir, fileName: fileName, content: content))
        return resp?.success ?? false
    }

    // MARK: - Config

    func getConfig() async -> [String: String]? {
        return await get("/dashboard/api/config")
    }

    // MARK: - Sessions

    struct SessionInfo: Codable, Identifiable {
        let id: Int?
        let key: String?
        let userId: String?
        let model: String?
        let createdAt: String?
        let lastMessageAt: String?
    }

    struct SessionsResponse: Codable {
        let sessions: [SessionInfo]?
    }

    func getSessions() async -> SessionsResponse? {
        return await get("/dashboard/api/sessions")
    }

    // MARK: - HTTP Helpers
    private struct EmptyResponse: Codable {}

    private func get<T: Codable>(_ path: String) async -> T? {
        guard let url = URL(string: "\(baseURL)\(path)") else { return nil }
        do {
            let (data, response) = try await session.data(from: url)
            guard let httpResponse = response as? HTTPURLResponse,
                  (200...299).contains(httpResponse.statusCode) else { return nil }
            let decoder = JSONDecoder()
            decoder.keyDecodingStrategy = .convertFromSnakeCase
            return try decoder.decode(T.self, from: data)
        } catch {
            print("[OpenWhaleClient] GET \(path) error: \(error)")
            return nil
        }
    }

    private func post<B: Codable, T: Codable>(_ path: String, body: B) async -> T? {
        guard let url = URL(string: "\(baseURL)\(path)") else { return nil }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try? JSONEncoder().encode(body)
        do {
            let (data, response) = try await session.data(for: request)
            guard let httpResponse = response as? HTTPURLResponse,
                  (200...299).contains(httpResponse.statusCode) else {
                return nil
            }
            let decoder = JSONDecoder()
            decoder.keyDecodingStrategy = .convertFromSnakeCase
            return try decoder.decode(T.self, from: data)
        } catch {
            print("[OpenWhaleClient] POST \(path) error: \(error)")
            return nil
        }
    }

    /// POST with raw dictionary body (for dynamic keys)
    private func postRaw(_ path: String, body: [String: Any]) async -> Bool {
        guard let url = URL(string: "\(baseURL)\(path)"),
              let jsonData = try? JSONSerialization.data(withJSONObject: body) else { return false }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = jsonData
        do {
            let (_, response) = try await session.data(for: request)
            guard let httpResponse = response as? HTTPURLResponse,
                  (200...299).contains(httpResponse.statusCode) else { return false }
            return true
        } catch {
            return false
        }
    }

    private func delete(_ path: String) async -> Bool {
        guard let url = URL(string: "\(baseURL)\(path)") else { return false }
        var request = URLRequest(url: url)
        request.httpMethod = "DELETE"
        do {
            let (_, response) = try await session.data(for: request)
            guard let httpResponse = response as? HTTPURLResponse,
                  (200...299).contains(httpResponse.statusCode) else { return false }
            return true
        } catch {
            return false
        }
    }
}
