import SwiftUI

struct ChatPage: View {
    @EnvironmentObject var appState: AppState

    var body: some View {
        VStack(spacing: 0) {
            chatHeader
            Divider().background(Color.owBorder)
            
            if appState.chatMessages.isEmpty && appState.activePlan == nil {
                emptyState
            } else {
                messageList
            }

            // Agent working bar — exactly matches dashboard's bottom indicator
            if appState.isSending && !appState.workingLabel.isEmpty {
                agentWorkingBar
            }

            Divider().background(Color.owBorder)
            chatInput
        }
        .background(Color.owBackground)
    }

    // MARK: - Header
    private var chatHeader: some View {
        HStack {
            Text("AI Assistant")
                .font(.owTitle)
                .foregroundColor(.owTextPrimary)
            Spacer()
            Button {
                Task { await appState.clearChatHistory() }
            } label: {
                HStack(spacing: 5) {
                    Image(systemName: "trash")
                        .font(.system(size: 12))
                    Text("Clear Chat")
                        .font(.owCaption)
                }
                .foregroundColor(.owTextSecondary)
                .padding(.horizontal, 10)
                .padding(.vertical, 5)
                .background(Color.owSurfaceRaised)
                .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 12)
    }

    // MARK: - Empty State
    private var emptyState: some View {
        VStack(spacing: 16) {
            Spacer()
            Text("🐋")
                .font(.system(size: 64))
            Text("How can I help you today?")
                .font(.owTitle)
                .foregroundColor(.owTextPrimary)
            Text("I can help you manage your channels, write code, or just chat.")
                .font(.owBody)
                .foregroundColor(.owTextSecondary)
            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // MARK: - Message List
    private var messageList: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 0) {
                    ForEach(groupedItems) { item in
                        switch item.kind {
                        case .userMessage(let msg):
                            userBubble(msg)
                                .id(item.id)
                        case .assistantMessage(let msg):
                            assistantBubble(msg)
                                .id(item.id)
                        case .toolGroup(let tools):
                            toolGroupView(tools: tools)
                                .id(item.id)
                        case .thinkingMessage(let msg):
                            thinkingBubble(msg)
                                .id(item.id)
                        case .errorMessage(let msg):
                            errorBubble(msg)
                                .id(item.id)
                        case .planWidget:
                            if let plan = appState.activePlan {
                                planWidget(plan: plan)
                                    .id(item.id)
                            }
                        }
                    }
                }
                .padding(.vertical, 16)
            }
            .onChange(of: appState.chatMessages.count) { _ in
                scrollToEnd(proxy: proxy)
            }
            .onChange(of: appState.isSending) { _ in
                scrollToEnd(proxy: proxy)
            }
        }
    }

    private func scrollToEnd(proxy: ScrollViewProxy) {
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
            if let last = groupedItems.last {
                withAnimation(.easeOut(duration: 0.2)) {
                    proxy.scrollTo(last.id, anchor: .bottom)
                }
            }
        }
    }

    // MARK: - Smart grouping: mirrors dashboard's approach
    // Dashboard groups ALL tool calls into one section, skipping thinking in between
    // Plan tool calls ("plan" tool) are filtered out — plan widget handles them
    private var groupedItems: [ChatItem] {
        var items: [ChatItem] = []
        var toolBatch: [AppState.ChatMessage] = []
        
        // Filter out plan tool calls and collect groupable items
        let messages = appState.chatMessages.filter { msg in
            // Skip "plan" tool calls — they're handled by the plan widget
            if (msg.kind == .toolStart || msg.kind == .toolEnd),
               msg.toolName == "plan" {
                return false
            }
            return true
        }

        func flushTools() {
            if !toolBatch.isEmpty {
                items.append(ChatItem(kind: .toolGroup(toolBatch)))
                toolBatch = []
            }
        }

        var i = 0
        while i < messages.count {
            let msg = messages[i]
            
            if msg.kind == .toolStart || msg.kind == .toolEnd {
                toolBatch.append(msg)
                i += 1
            } else if msg.kind == .thinking {
                // If tools come AFTER this thinking message, skip it (don't break the group)
                // Look ahead to see if the next non-thinking message is also a tool
                var nextNonThinking = i + 1
                while nextNonThinking < messages.count && messages[nextNonThinking].kind == .thinking {
                    nextNonThinking += 1
                }
                if nextNonThinking < messages.count &&
                   (messages[nextNonThinking].kind == .toolStart || messages[nextNonThinking].kind == .toolEnd) &&
                   !toolBatch.isEmpty {
                    // Skip this thinking — it's between tool calls
                    i += 1
                } else {
                    // No tools following — show it as a thinking bubble
                    flushTools()
                    items.append(ChatItem(kind: .thinkingMessage(msg)))
                    i += 1
                }
            } else if msg.kind == .user {
                flushTools()
                items.append(ChatItem(kind: .userMessage(msg)))
                i += 1
            } else if msg.kind == .assistant {
                flushTools()
                items.append(ChatItem(kind: .assistantMessage(msg)))
                i += 1
            } else if msg.kind == .error {
                flushTools()
                items.append(ChatItem(kind: .errorMessage(msg)))
                i += 1
            } else {
                flushTools()
                i += 1
            }
        }
        flushTools()
        
        // Insert plan widget after the LAST user message (which triggered the plan)
        if appState.activePlan != nil {
            var insertIdx = 0
            for (idx, item) in items.enumerated() {
                if case .userMessage(_) = item.kind {
                    insertIdx = idx + 1
                }
            }
            // Insert right after last user message — tool groups and results go below
            items.insert(ChatItem(kind: .planWidget), at: insertIdx)
        }
        
        return items
    }

    // MARK: - Agent Working Bar (matches dashboard exactly)
    private var agentWorkingBar: some View {
        HStack(spacing: 10) {
            Circle()
                .fill(Color.owPrimary)
                .frame(width: 6, height: 6)

            Text(appState.workingLabel)
                .font(.system(size: 12, weight: .medium))
                .foregroundColor(.owTextSecondary)
                .lineLimit(1)

            Spacer()

            ProgressView()
                .scaleEffect(0.5)
                .frame(width: 14, height: 14)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(Color.owSurface)
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .stroke(Color.owBorderLight, lineWidth: 0.5)
        )
        .padding(.horizontal, 20)
        .padding(.vertical, 4)
    }

    // MARK: - Chat Input
    private var chatInput: some View {
        HStack(spacing: 10) {
            ZStack(alignment: .leading) {
                if appState.chatInput.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    Text("Type your message...")
                        .font(.owBody)
                        .foregroundColor(.white.opacity(0.65))
                        .padding(.leading, 4)
                }
                TextField("", text: $appState.chatInput, axis: .vertical)
                    .textFieldStyle(.plain)
                    .font(.owBody)
                    .foregroundColor(.white)
                    .lineLimit(1...5)
                    .onSubmit {
                        appState.currentSendTask = Task { await appState.sendMessage() }
                    }
            }

            if appState.isSending {
                // Stop button
                Button {
                    appState.stopChat()
                } label: {
                    Image(systemName: "stop.fill")
                        .font(.system(size: 14))
                        .foregroundColor(.red)
                        .frame(width: 28, height: 28)
                        .background(Color.red.opacity(0.15))
                        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                }
                .buttonStyle(.plain)
                .help("Stop generating")
            } else {
                Button {
                    appState.currentSendTask = Task { await appState.sendMessage() }
                } label: {
                    Image(systemName: "arrow.up.circle.fill")
                        .font(.system(size: 24))
                        .foregroundColor(appState.chatInput.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? .owTextTertiary : .owPrimary)
                }
                .buttonStyle(.plain)
                .disabled(appState.chatInput.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }
        }
        .padding(14)
        .background(Color.owSurface)
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .stroke(Color.owBorderLight, lineWidth: 1)
        )
        .padding(.horizontal, 20)
        .padding(.vertical, 12)
    }

    // MARK: - User Bubble
    private func userBubble(_ msg: AppState.ChatMessage) -> some View {
        HStack {
            Spacer(minLength: 60)
            VStack(alignment: .trailing, spacing: 4) {
                Text(msg.content)
                    .font(.owBody)
                    .foregroundColor(.white)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 10)
                    .background(Color.owPrimary)
                    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))

                Text(timeString(msg.timestamp))
                    .font(.system(size: 10))
                    .foregroundColor(.owTextTertiary)
            }
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 4)
    }

    // MARK: - Assistant Bubble
    private func assistantBubble(_ msg: AppState.ChatMessage) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Text("🐋")
                .font(.system(size: 18))
                .frame(width: 32, height: 32)
                .background(Color.owSurfaceRaised)
                .clipShape(Circle())

            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 8) {
                    Text("OpenWhale")
                        .font(.owBodyMedium)
                        .foregroundColor(.owTextPrimary)
                    Text(timeString(msg.timestamp))
                        .font(.system(size: 10))
                        .foregroundColor(.owTextTertiary)
                }

                MarkdownText(msg.content)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 10)
                    .background(Color.owSurface)
                    .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: 14, style: .continuous)
                            .stroke(Color.owBorderLight, lineWidth: 0.5)
                    )
            }

            Spacer(minLength: 40)
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 4)
    }

    // MARK: - Thinking Bubble
    private func thinkingBubble(_ msg: AppState.ChatMessage) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Text("🐋")
                .font(.system(size: 18))
                .frame(width: 32, height: 32)
                .background(Color.owSurfaceRaised)
                .clipShape(Circle())

            HStack(spacing: 6) {
                ProgressView()
                    .scaleEffect(0.5)
                    .frame(width: 14, height: 14)
                Text("Thinking...")
                    .font(.owCaption)
                    .foregroundColor(.owTextSecondary)
                    .italic()
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(Color.owSurface)
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))

            Spacer()
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 2)
    }

    // MARK: - Error Bubble
    private func errorBubble(_ msg: AppState.ChatMessage) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.system(size: 16))
                .foregroundColor(.owRed)
                .frame(width: 32, height: 32)
                .background(Color.owRed.opacity(0.1))
                .clipShape(Circle())

            Text(msg.content)
                .font(.owBody)
                .foregroundColor(.owRed)
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .background(Color.owRed.opacity(0.08))
                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .stroke(Color.owRed.opacity(0.2), lineWidth: 1)
                )

            Spacer(minLength: 40)
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 4)
    }

    // MARK: - Tool Group (matches dashboard's collapsible group)
    @ViewBuilder
    private func toolGroupView(tools: [AppState.ChatMessage]) -> some View {
        ToolGroupSection(tools: tools)
            .padding(.horizontal, 20)
            .padding(.leading, 42) // Align with assistant content
            .padding(.vertical, 2)
    }
    
    // MARK: - Plan Widget
    @ViewBuilder
    private func planWidget(plan: AppState.ActivePlan) -> some View {
        PlanWidgetView(plan: plan, toggleStep: { stepId in
            if var p = appState.activePlan,
               let idx = p.steps.firstIndex(where: { $0.id == stepId }) {
                p.steps[idx].expanded.toggle()
                appState.activePlan = p
            }
        })
        .padding(.horizontal, 20)
        .padding(.leading, 42)
        .padding(.vertical, 6)
    }

    private func timeString(_ date: Date) -> String {
        let fmt = DateFormatter()
        fmt.dateFormat = "MMM d, h:mm a"
        return fmt.string(from: date)
    }
}

// MARK: - Chat Item (for grouping)

struct ChatItem: Identifiable {
    let id = UUID()
    let kind: Kind

    enum Kind {
        case userMessage(AppState.ChatMessage)
        case assistantMessage(AppState.ChatMessage)
        case toolGroup([AppState.ChatMessage])
        case thinkingMessage(AppState.ChatMessage)
        case errorMessage(AppState.ChatMessage)
        case planWidget
    }
}

// MARK: - Tool Group Section (dashboard: "5 tool calls, 3 completed")

struct ToolGroupSection: View {
    let tools: [AppState.ChatMessage]
    @State private var isExpanded = true

    private var completedCount: Int { tools.filter { $0.kind == .toolEnd }.count }
    private var runningCount: Int { tools.filter { $0.kind == .toolStart }.count }
    private var uniqueTools: [AppState.ChatMessage] {
        // Show only the latest state for each tool (toolEnd replaces toolStart)
        var seen = Set<String>()
        var result: [AppState.ChatMessage] = []
        for tool in tools.reversed() {
            let key = tool.toolName ?? tool.id.uuidString
            if !seen.contains(key) {
                seen.insert(key)
                result.insert(tool, at: 0)
            }
        }
        return result
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Summary header (always show for 1+ tools, matches dashboard)
            Button {
                withAnimation(.easeInOut(duration: 0.2)) { isExpanded.toggle() }
            } label: {
                HStack(spacing: 8) {
                    Image(systemName: "wrench.and.screwdriver")
                        .font(.system(size: 11))
                        .foregroundColor(.owTextTertiary)
                    
                    Text("\(uniqueTools.count) tool call\(uniqueTools.count == 1 ? "" : "s")")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundColor(.owTextPrimary)

                    Text(statusSummary)
                        .font(.system(size: 11))
                        .foregroundColor(.owTextTertiary)

                    Spacer()

                    Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                        .font(.system(size: 9, weight: .semibold))
                        .foregroundColor(.owTextTertiary)
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(Color.owSurfaceRaised)
                .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .stroke(Color.owBorderLight, lineWidth: 0.5)
                )
            }
            .buttonStyle(.plain)

            if isExpanded {
                VStack(alignment: .leading, spacing: 3) {
                    ForEach(uniqueTools) { tool in
                        ToolChipRow(message: tool)
                    }
                }
                .padding(.top, 4)
            }
        }
    }

    private var statusSummary: String {
        var parts: [String] = []
        if runningCount > 0 { parts.append("\(runningCount) running") }
        if completedCount > 0 { parts.append("\(completedCount) completed") }
        return parts.joined(separator: ", ")
    }
}

// MARK: - Individual Tool Chip Row (inside group)

struct ToolChipRow: View {
    let message: AppState.ChatMessage
    @State private var isExpanded = false

    private var isRunning: Bool { message.kind == .toolStart }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Button {
                withAnimation(.easeInOut(duration: 0.2)) { isExpanded.toggle() }
            } label: {
                HStack(spacing: 6) {
                    // Status icon — green check or spinner
                    if isRunning {
                        ProgressView()
                            .scaleEffect(0.45)
                            .frame(width: 12, height: 12)
                    } else {
                        Image(systemName: "checkmark.circle.fill")
                            .font(.system(size: 11))
                            .foregroundColor(.owGreen)
                    }

                    Text(toolLabel)
                        .font(.system(size: 11.5, weight: .medium))
                        .foregroundColor(.owTextPrimary)
                        .lineLimit(1)

                    Spacer()

                    if !isRunning {
                        Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                            .font(.system(size: 8, weight: .semibold))
                            .foregroundColor(.owTextTertiary)
                    }
                }
                .padding(.horizontal, 10)
                .padding(.vertical, 6)
                .background(Color.owSurfaceRaised.opacity(0.5))
                .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
            }
            .buttonStyle(.plain)

            if isExpanded {
                VStack(alignment: .leading, spacing: 6) {
                    if let args = message.toolArgs, !args.isEmpty {
                        Text("Arguments")
                            .font(.system(size: 9.5, weight: .semibold))
                            .foregroundColor(.owTextTertiary)
                            .textCase(.uppercase)
                        Text(prettyJSON(args))
                            .font(.owMono)
                            .foregroundColor(.owTextSecondary)
                            .lineLimit(8)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    if let result = message.toolStatus, !result.isEmpty {
                        Text("Result")
                            .font(.system(size: 9.5, weight: .semibold))
                            .foregroundColor(.owTextTertiary)
                            .textCase(.uppercase)
                        Text(result.prefix(300))
                            .font(.owMono)
                            .foregroundColor(.owTextSecondary)
                            .lineLimit(6)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                }
                .padding(8)
                .background(Color.owBackground)
                .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
                .padding(.top, 2)
            }

            // File creation chip
            if let filePath = extractFilePath(), message.kind == .toolEnd {
                fileChip(path: filePath)
                    .padding(.top, 4)
            }
        }
    }

    private func fileChip(path: String) -> some View {
        let fileName = URL(fileURLWithPath: path).lastPathComponent
        let ext = URL(fileURLWithPath: path).pathExtension.lowercased()
        let iconName: String = {
            switch ext {
            case "pdf": return "doc.richtext"
            case "png", "jpg", "jpeg", "gif", "webp": return "photo"
            case "swift", "js", "ts", "py", "html", "css": return "doc.text"
            case "json", "xml", "yaml", "yml": return "doc.badge.gearshape"
            default: return "doc.fill"
            }
        }()

        return HStack(spacing: 8) {
            Image(systemName: iconName)
                .font(.system(size: 13))
                .foregroundColor(.owPrimary)
            VStack(alignment: .leading, spacing: 1) {
                Text(fileName)
                    .font(.system(size: 11.5, weight: .medium))
                    .foregroundColor(.owTextPrimary)
                    .lineLimit(1)
                Text(path)
                    .font(.system(size: 9.5))
                    .foregroundColor(.owTextTertiary)
                    .lineLimit(1)
                    .truncationMode(.middle)
            }
            Spacer()
            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 13))
                .foregroundColor(.owGreen)
        }
        .padding(8)
        .background(
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .fill(Color.owGreen.opacity(0.08))
                .overlay(
                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                        .stroke(Color.owGreen.opacity(0.25), lineWidth: 1)
                )
        )
    }

    private var toolLabel: String {
        let name = message.toolName ?? "unknown"
        let args = parseArgs()
        switch name {
        case "file":
            let action = args["action"] as? String ?? "file"
            let path = (args["path"] as? String ?? "").components(separatedBy: "/").last ?? ""
            switch action {
            case "write": return "Writing file: \(path)"
            case "read": return "Reading file: \(path)"
            case "list": return "Listing directory: \(path)"
            case "mkdir": return "Creating directory: \(path)"
            case "delete": return "Deleting: \(path)"
            default: return "File: \(action)"
            }
        case "exec":
            let cmd = (args["command"] as? String ?? "").prefix(50)
            return "Running: \(cmd)"
        case "web_fetch":
            let url = (args["url"] as? String ?? "").prefix(40)
            return "Fetching: \(url)"
        case "browser":
            return "Browser: \(args["action"] as? String ?? "navigate")"
        case "pdf":
            let action = args["action"] as? String ?? "pdf"
            let output = (args["outputPath"] as? String ?? "").components(separatedBy: "/").last ?? ""
            return output.isEmpty ? "PDF: \(action)" : "PDF: \(action) → \(output)"
        case "slides":
            let action = args["action"] as? String ?? "create"
            let output = (args["outputPath"] as? String ?? "").components(separatedBy: "/").last ?? ""
            return output.isEmpty ? "Slides: \(action)" : "Slides: \(action) → \(output)"
        case "plan": return "Plan: \(args["action"] as? String ?? "create")"
        case "image": return "Generating image"
        case "screenshot": return "Taking screenshot"
        case "memory": return "Memory: \(args["action"] as? String ?? "recall")"
        case "code_exec": return "Executing code"
        case "tts": return "Text to speech"
        default:
            let action = args["action"] as? String
            return action != nil ? "\(name): \(action!)" : name
        }
    }

    private func parseArgs() -> [String: Any] {
        guard let argsStr = message.toolArgs,
              let data = argsStr.data(using: .utf8),
              let dict = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return [:] }
        return dict
    }

    private func extractFilePath() -> String? {
        let args = parseArgs()
        guard let action = args["action"] as? String,
              let path = args["path"] as? String,
              (action == "write" || action == "mkdir") else { return nil }
        return path
    }

    private func prettyJSON(_ jsonStr: String) -> String {
        guard let data = jsonStr.data(using: .utf8),
              let obj = try? JSONSerialization.jsonObject(with: data),
              let pretty = try? JSONSerialization.data(withJSONObject: obj, options: .prettyPrinted),
              let str = String(data: pretty, encoding: .utf8) else { return jsonStr }
        return str
    }
}

// MARK: - Plan Widget (matches dashboard ⚡ PLAN card exactly)

struct PlanWidgetView: View {
    let plan: AppState.ActivePlan
    let toggleStep: (Int) -> Void

    private var completedCount: Int { plan.steps.filter { $0.status == "completed" }.count }
    private var progressPct: CGFloat {
        plan.steps.isEmpty ? 0 : CGFloat(completedCount) / CGFloat(plan.steps.count)
    }
    private var isAllDone: Bool { plan.completed || completedCount == plan.steps.count }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Header
            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    HStack(spacing: 5) {
                        Text(isAllDone ? "✨" : "⚡")
                            .font(.system(size: 13))
                        Text("Plan")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundColor(.owPrimary)
                    }
                    Spacer()
                    Text(isAllDone ? "Completed" : "\(completedCount) of \(plan.steps.count)")
                        .font(.system(size: 10.5, weight: .medium))
                        .foregroundColor(isAllDone ? .owGreen : .owTextSecondary)
                        .padding(.horizontal, 7)
                        .padding(.vertical, 2)
                        .background(
                            RoundedRectangle(cornerRadius: 5, style: .continuous)
                                .fill(isAllDone ? Color.owGreen.opacity(0.15) : Color.owSurfaceRaised)
                        )
                }

                Text(plan.title)
                    .font(.system(size: 13, weight: .bold))
                    .foregroundColor(.owTextPrimary)

                // Progress bar
                GeometryReader { geo in
                    ZStack(alignment: .leading) {
                        RoundedRectangle(cornerRadius: 2)
                            .fill(Color.owBorderLight)
                            .frame(height: 2.5)
                        RoundedRectangle(cornerRadius: 2)
                            .fill(isAllDone ? Color.owGreen : Color.owPrimary)
                            .frame(width: geo.size.width * progressPct, height: 2.5)
                            .animation(.easeInOut(duration: 0.3), value: progressPct)
                    }
                }
                .frame(height: 2.5)
            }
            .padding(12)

            Divider().background(Color.owBorderLight)

            // Timeline steps
            VStack(alignment: .leading, spacing: 0) {
                ForEach(Array(plan.steps.enumerated()), id: \.element.id) { idx, step in
                    planStepRow(step: step, index: idx, isLast: idx == plan.steps.count - 1)
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)

            if isAllDone {
                HStack(spacing: 5) {
                    Text("🎉")
                        .font(.system(size: 12))
                    Text("All steps completed successfully")
                        .font(.system(size: 11, weight: .medium))
                        .foregroundColor(.owGreen)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 8)
                .background(Color.owGreen.opacity(0.06))
            }
        }
        .background(Color.owSurface)
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(Color.owBorderLight, lineWidth: 0.5)
        )
    }

    private func planStepRow(step: AppState.PlanStep, index: Int, isLast: Bool) -> some View {
        HStack(alignment: .top, spacing: 8) {
            VStack(spacing: 0) {
                stepCircle(step: step, index: index)
                if !isLast {
                    Rectangle()
                        .fill(step.status == "completed" ? Color.owGreen.opacity(0.4) : Color.owBorderLight)
                        .frame(width: 1.5)
                        .frame(minHeight: 16)
                }
            }
            .frame(width: 20)

            VStack(alignment: .leading, spacing: 3) {
                Button { toggleStep(step.id) } label: {
                    HStack {
                        Text(step.title)
                            .font(.system(size: 11.5, weight: .medium))
                            .foregroundColor(step.status == "completed" || step.status == "in_progress" ? .owTextPrimary : .owTextTertiary)
                            .multilineTextAlignment(.leading)
                        Spacer()
                        if step.notes != nil || !step.toolCalls.isEmpty {
                            Image(systemName: step.expanded ? "chevron.up" : "chevron.down")
                                .font(.system(size: 8))
                                .foregroundColor(.owTextTertiary)
                        }
                    }
                }
                .buttonStyle(.plain)

                if step.expanded {
                    VStack(alignment: .leading, spacing: 3) {
                        if let notes = step.notes {
                            HStack(spacing: 3) {
                                Image(systemName: "info.circle")
                                    .font(.system(size: 9))
                                    .foregroundColor(.owTextTertiary)
                                Text(notes)
                                    .font(.system(size: 10))
                                    .foregroundColor(.owTextSecondary)
                            }
                        }
                        ForEach(step.toolCalls) { tc in
                            HStack(spacing: 3) {
                                Image(systemName: tc.kind == .toolEnd ? "checkmark.circle.fill" : "arrow.clockwise")
                                    .font(.system(size: 9))
                                    .foregroundColor(tc.kind == .toolEnd ? .owGreen : .owTextTertiary)
                                Text(tc.content)
                                    .font(.system(size: 10))
                                    .foregroundColor(.owTextSecondary)
                                    .lineLimit(1)
                            }
                        }
                    }
                    .padding(.bottom, 3)
                }
            }
            .padding(.bottom, isLast ? 0 : 6)
        }
    }

    private func stepCircle(step: AppState.PlanStep, index: Int) -> some View {
        ZStack {
            if step.status == "completed" {
                Image(systemName: "checkmark.circle.fill")
                    .font(.system(size: 16))
                    .foregroundColor(.owGreen)
            } else if step.status == "in_progress" {
                ProgressView()
                    .scaleEffect(0.55)
                    .frame(width: 18, height: 18)
            } else {
                Text("\(index + 1)")
                    .font(.system(size: 10, weight: .medium))
                    .foregroundColor(.owTextTertiary)
                    .frame(width: 18, height: 18)
                    .background(Circle().stroke(Color.owBorderLight, lineWidth: 1.5))
            }
        }
        .frame(width: 20, height: 20)
    }
}

// MARK: - Enhanced Markdown Text View

struct MarkdownText: View {
    let text: String

    init(_ text: String) {
        self.text = text
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            ForEach(Array(blocks.enumerated()), id: \.offset) { _, block in
                switch block {
                case .codeBlock(let lang, let code):
                    codeBlockView(language: lang, code: code)
                case .heading(let level, let text):
                    headingView(level: level, text: text)
                case .bulletList(let items):
                    bulletListView(items: items)
                case .paragraph(let text):
                    richText(text)
                        .textSelection(.enabled)
                }
            }
        }
    }

    enum Block {
        case codeBlock(language: String, code: String)
        case heading(level: Int, text: String)
        case bulletList(items: [String])
        case paragraph(text: String)
    }

    var blocks: [Block] {
        var result: [Block] = []
        let lines = text.components(separatedBy: "\n")
        var i = 0

        while i < lines.count {
            let line = lines[i]

            if line.hasPrefix("```") {
                let lang = String(line.dropFirst(3)).trimmingCharacters(in: .whitespaces)
                var codeLines: [String] = []
                i += 1
                while i < lines.count && !lines[i].hasPrefix("```") {
                    codeLines.append(lines[i])
                    i += 1
                }
                if i < lines.count { i += 1 }
                result.append(.codeBlock(language: lang, code: codeLines.joined(separator: "\n")))
                continue
            }

            if line.hasPrefix("#### ") { result.append(.heading(level: 4, text: String(line.dropFirst(5)))); i += 1; continue }
            if line.hasPrefix("### ") { result.append(.heading(level: 3, text: String(line.dropFirst(4)))); i += 1; continue }
            if line.hasPrefix("## ") { result.append(.heading(level: 2, text: String(line.dropFirst(3)))); i += 1; continue }
            if line.hasPrefix("# ") { result.append(.heading(level: 1, text: String(line.dropFirst(2)))); i += 1; continue }

            // Bullet lists
            let trimmed = line.trimmingCharacters(in: .whitespaces)
            if trimmed.hasPrefix("- ") || trimmed.hasPrefix("* ") || trimmed.hasPrefix("• ") {
                var items: [String] = []
                while i < lines.count {
                    let l = lines[i].trimmingCharacters(in: .whitespaces)
                    if l.hasPrefix("- ") || l.hasPrefix("* ") || l.hasPrefix("• ") {
                        items.append(String(l.dropFirst(2)))
                        i += 1
                    } else { break }
                }
                result.append(.bulletList(items: items))
                continue
            }

            // Numbered lists
            if let dotIdx = trimmed.firstIndex(of: "."),
               trimmed.startIndex < dotIdx,
               trimmed[trimmed.startIndex..<dotIdx].allSatisfy({ $0.isNumber }),
               trimmed.index(after: dotIdx) < trimmed.endIndex,
               trimmed[trimmed.index(after: dotIdx)] == " " {
                var items: [String] = []
                while i < lines.count {
                    let l = lines[i].trimmingCharacters(in: .whitespaces)
                    if let d = l.firstIndex(of: "."),
                       l.startIndex < d,
                       l[l.startIndex..<d].allSatisfy({ $0.isNumber }),
                       l.index(after: d) < l.endIndex,
                       l[l.index(after: d)] == " " {
                        items.append(String(l[l.index(l.index(after: d), offsetBy: 1)...]))
                        i += 1
                    } else { break }
                }
                result.append(.bulletList(items: items))
                continue
            }

            // Paragraph
            var paraLines: [String] = []
            while i < lines.count && !lines[i].hasPrefix("```") && !lines[i].hasPrefix("#") {
                let l = lines[i]
                let lt = l.trimmingCharacters(in: .whitespaces)
                if lt.hasPrefix("- ") || lt.hasPrefix("* ") || lt.hasPrefix("• ") { break }
                if let d2 = lt.firstIndex(of: "."), lt.startIndex < d2,
                   lt[lt.startIndex..<d2].allSatisfy({ $0.isNumber }),
                   lt.index(after: d2) < lt.endIndex, lt[lt.index(after: d2)] == " " { break }
                if l.isEmpty && !paraLines.isEmpty { break }
                paraLines.append(l)
                i += 1
            }
            if !paraLines.isEmpty {
                let text = paraLines.joined(separator: "\n")
                if !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    result.append(.paragraph(text: text))
                }
            }
            if i < lines.count && lines[i].isEmpty { i += 1 }
        }
        return result
    }

    private func richText(_ str: String) -> Text {
        var result = Text("")
        var remaining = str[str.startIndex...]

        while !remaining.isEmpty {
            if remaining.hasPrefix("`"),
               let endIdx = remaining.dropFirst().firstIndex(of: "`") {
                let code = remaining[remaining.index(after: remaining.startIndex)..<endIdx]
                result = result + Text(String(code))
                    .font(.system(size: 12, design: .monospaced))
                    .foregroundColor(.owPrimary)
                remaining = remaining[remaining.index(after: endIdx)...]
                continue
            }

            if remaining.hasPrefix("**"),
               let endRange = remaining.dropFirst(2).range(of: "**") {
                let bold = remaining[remaining.index(remaining.startIndex, offsetBy: 2)..<endRange.lowerBound]
                result = result + Text(String(bold)).bold().foregroundColor(.owTextPrimary)
                remaining = remaining[endRange.upperBound...]
                continue
            }

            let nextSpecial = remaining.dropFirst().firstIndex(where: { $0 == "`" || $0 == "*" }) ?? remaining.endIndex
            result = result + Text(String(remaining[remaining.startIndex..<nextSpecial]))
                .font(.owBody)
                .foregroundColor(.owTextPrimary)
            remaining = remaining[nextSpecial...]
        }
        return result
    }

    private func bulletListView(items: [String]) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            ForEach(Array(items.enumerated()), id: \.offset) { _, item in
                HStack(alignment: .top, spacing: 6) {
                    Text("•")
                        .font(.owBody)
                        .foregroundColor(.owTextTertiary)
                    richText(item)
                        .textSelection(.enabled)
                }
            }
        }
        .padding(.leading, 4)
    }

    private func codeBlockView(language: String, code: String) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            if !language.isEmpty {
                Text(language)
                    .font(.system(size: 10, weight: .medium, design: .monospaced))
                    .foregroundColor(.owTextTertiary)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 4)
                    .background(Color.owBackground.opacity(0.6))
            }
            ScrollView(.horizontal, showsIndicators: false) {
                Text(code)
                    .font(.system(size: 12, design: .monospaced))
                    .foregroundColor(Color.owTextPrimary)
                    .textSelection(.enabled)
                    .padding(10)
            }
        }
        .background(Color.owBackground)
        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .stroke(Color.owBorderLight, lineWidth: 0.5)
        )
    }

    private func headingView(level: Int, text: String) -> some View {
        Text(text)
            .font(level <= 1 ? .owTitle : level == 2 ? .owHeadline : .owBodyMedium)
            .foregroundColor(.owTextPrimary)
            .fontWeight(level <= 2 ? .bold : .semibold)
            .padding(.top, level <= 2 ? 6 : 3)
    }
}
