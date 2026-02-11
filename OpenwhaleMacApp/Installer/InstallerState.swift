import SwiftUI
import Foundation

// MARK: - Prerequisite model
struct Prerequisite: Identifiable {
    let id: String
    let name: String
    let desc: String
    let installCommand: String?      // nil = can't auto-install
    var installed: Bool = false
    var version: String = ""
    var isInstalling: Bool = false
}

// MARK: - Installer State

class InstallerState: ObservableObject {
    @Published var currentStep: Int = 0
    @Published var isProcessing: Bool = false
    @Published var errorMessage: String = ""
    @Published var logOutput: String = ""

    // Step 1: Prerequisites
    @Published var prerequisites: [Prerequisite] = []

    // Step 2: Clone
    @Published var installPath: String = ""
    @Published var repoExists: Bool = false
    @Published var cloneProgress: String = ""

    // Step 3: npm install
    @Published var npmProgress: String = ""

    // Step 4: Server
    @Published var serverRunning: Bool = false
    @Published var serverCheckAttempts: Int = 0

    // Step 5: AI Providers
    @Published var anthropicKey: String = ""
    @Published var openaiKey: String = ""
    @Published var googleKey: String = ""
    @Published var deepseekKey: String = ""
    @Published var ollamaUrl: String = ""
    @Published var testAIStatus: String = ""

    // Step 6: Channels  
    @Published var whatsappEnabled: Bool = true
    @Published var whatsappQR: String = ""
    @Published var whatsappConnected: Bool = false
    @Published var whatsappConnecting: Bool = false
    @Published var telegramEnabled: Bool = false
    @Published var telegramToken: String = ""
    @Published var discordEnabled: Bool = false
    @Published var discordToken: String = ""

    // Step 7: Skills
    @Published var githubToken: String = ""
    @Published var weatherKey: String = ""
    @Published var notionKey: String = ""
    @Published var googleCredsJSON: String = ""

    let totalSteps = 9
    let repoURL = "https://github.com/viralcode/openwhale.git"

    init() {
        let home = FileManager.default.homeDirectoryForCurrentUser.path
        installPath = "\(home)/openwhale"
        checkPrerequisites()
    }

    var serverBaseURL: String { "http://localhost:7777/dashboard" }
    var apiBase: String { "http://localhost:7777/dashboard/api" }

    // MARK: - Shell Helpers

    /// Wraps a command to source the user's shell profile first, ensuring npm/node/brew are on PATH.
    private func profiledCommand(_ command: String) -> String {
        return "source ~/.zprofile 2>/dev/null; source ~/.zshrc 2>/dev/null; \(command)"
    }

    @discardableResult
    func runShell(_ command: String) -> (output: String, exitCode: Int32) {
        let task = Process()
        let pipe = Pipe()
        task.standardOutput = pipe
        task.standardError = pipe
        task.launchPath = "/bin/zsh"
        task.arguments = ["-l", "-c", command]
        task.launch()
        task.waitUntilExit()
        let data = pipe.fileHandleForReading.readDataToEndOfFile()
        let output = String(data: data, encoding: .utf8) ?? ""
        return (output.trimmingCharacters(in: .whitespacesAndNewlines), task.terminationStatus)
    }

    func runShellAsync(_ command: String, onOutput: @escaping (String) -> Void) async -> Int32 {
        return await withCheckedContinuation { continuation in
            DispatchQueue.global(qos: .userInitiated).async {
                let task = Process()
                let pipe = Pipe()
                task.standardOutput = pipe
                task.standardError = pipe
                task.launchPath = "/bin/zsh"
                task.arguments = ["-l", "-c", command]

                pipe.fileHandleForReading.readabilityHandler = { handle in
                    let data = handle.availableData
                    if !data.isEmpty, let str = String(data: data, encoding: .utf8) {
                        DispatchQueue.main.async { onOutput(str) }
                    }
                }

                task.launch()
                task.waitUntilExit()
                pipe.fileHandleForReading.readabilityHandler = nil
                continuation.resume(returning: task.terminationStatus)
            }
        }
    }

    // MARK: - Step 1: Prerequisites

    func checkPrerequisites() {
        var prereqs: [Prerequisite] = []

        // Git
        let git = runShell("git --version 2>/dev/null")
        prereqs.append(Prerequisite(
            id: "git", name: "Git", desc: "Version control (required)",
            installCommand: nil,
            installed: git.exitCode == 0,
            version: git.output.replacingOccurrences(of: "git version ", with: "")
        ))

        // Node.js
        let node = runShell("node --version 2>/dev/null")
        prereqs.append(Prerequisite(
            id: "node", name: "Node.js", desc: "JavaScript runtime (required)",
            installCommand: "brew install node",
            installed: node.exitCode == 0,
            version: node.output
        ))

        // npm
        let npm = runShell("npm --version 2>/dev/null")
        prereqs.append(Prerequisite(
            id: "npm", name: "npm", desc: "Package manager (comes with Node)",
            installCommand: nil,
            installed: npm.exitCode == 0,
            version: npm.exitCode == 0 ? "v\(npm.output)" : ""
        ))

        // Homebrew
        let brew = runShell("which brew 2>/dev/null")
        prereqs.append(Prerequisite(
            id: "homebrew", name: "Homebrew", desc: "Package manager for macOS",
            installCommand: "/bin/bash -c \"$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\"",
            installed: brew.exitCode == 0
        ))

        // Python 3
        let python = runShell("python3 --version 2>/dev/null")
        prereqs.append(Prerequisite(
            id: "python", name: "Python 3", desc: "Code execution tool",
            installCommand: "brew install python3",
            installed: python.exitCode == 0,
            version: python.output
        ))

        // FFmpeg
        let ffmpeg = runShell("which ffmpeg 2>/dev/null")
        prereqs.append(Prerequisite(
            id: "ffmpeg", name: "FFmpeg", desc: "Screen recording & audio/video",
            installCommand: "brew install ffmpeg",
            installed: ffmpeg.exitCode == 0
        ))

        // Docker
        let docker = runShell("docker --version 2>/dev/null")
        prereqs.append(Prerequisite(
            id: "docker", name: "Docker", desc: "Container management (optional)",
            installCommand: nil,
            installed: docker.exitCode == 0,
            version: docker.exitCode == 0 ? docker.output.replacingOccurrences(of: "Docker version ", with: "").components(separatedBy: ",").first ?? "" : ""
        ))

        // ImageSnap
        let imagesnap = runShell("which imagesnap 2>/dev/null")
        prereqs.append(Prerequisite(
            id: "imagesnap", name: "ImageSnap", desc: "Camera capture (macOS)",
            installCommand: "brew install imagesnap",
            installed: imagesnap.exitCode == 0
        ))

        DispatchQueue.main.async {
            self.prerequisites = prereqs
        }
    }

    func installPrerequisite(_ id: String) {
        guard let idx = prerequisites.firstIndex(where: { $0.id == id }),
              let cmd = prerequisites[idx].installCommand else { return }

        prerequisites[idx].isInstalling = true

        Task {
            let code = await runShellAsync(cmd) { line in
                self.logOutput += line
            }
            await MainActor.run {
                self.prerequisites[idx].isInstalling = false
                if code == 0 {
                    self.prerequisites[idx].installed = true
                }
                self.checkPrerequisites()
            }
        }
    }

    // MARK: - Step 2: Clone Repo

    func checkRepoExists() {
        repoExists = FileManager.default.fileExists(atPath: "\(installPath)/package.json")
    }

    func cloneRepo() async {
        await MainActor.run {
            isProcessing = true
            cloneProgress = "Cloning repository..."
            errorMessage = ""
        }

        // Check if already cloned
        if FileManager.default.fileExists(atPath: "\(installPath)/package.json") {
            await MainActor.run {
                repoExists = true
                isProcessing = false
                cloneProgress = "Repository already exists!"
            }
            return
        }

        // Remove partial clone if exists
        if FileManager.default.fileExists(atPath: installPath) {
            let _ = runShell("rm -rf \"\(installPath)\"")
        }

        let code = await runShellAsync("git clone \"\(repoURL)\" \"\(installPath)\" 2>&1") { line in
            self.cloneProgress = line.trimmingCharacters(in: .whitespacesAndNewlines)
        }

        await MainActor.run {
            isProcessing = false
            if code == 0 {
                repoExists = true
                cloneProgress = "✅ Repository cloned successfully!"
            } else {
                errorMessage = "Failed to clone repository. Check your internet connection."
                cloneProgress = ""
            }
        }
    }

    // MARK: - Step 3: npm install

    func npmInstall() async {
        await MainActor.run {
            isProcessing = true
            npmProgress = "Installing dependencies..."
            logOutput = ""
            errorMessage = ""
        }

        let code = await runShellAsync("cd \"\(installPath)\" && npm install 2>&1") { line in
            self.npmProgress = line.trimmingCharacters(in: .whitespacesAndNewlines)
            self.logOutput += line
        }

        await MainActor.run {
            isProcessing = false
            if code == 0 {
                // Create .env from .env.example if it doesn't exist
                let envPath = "\(installPath)/.env"
                if !FileManager.default.fileExists(atPath: envPath) {
                    let examplePath = "\(installPath)/.env.example"
                    if FileManager.default.fileExists(atPath: examplePath) {
                        // Generate a random JWT secret
                        let chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
                        let jwtSecret = String((0..<40).map { _ in chars.randomElement()! })
                        let _ = runShell("cp \"\(examplePath)\" \"\(envPath)\" && sed -i '' 's/change-me-to-something-random-at-least-32-chars/\(jwtSecret)/' \"\(envPath)\"")
                    }
                }
                npmProgress = "✅ Dependencies installed!"
            } else {
                errorMessage = "npm install failed. Check the log output."
            }
        }
    }

    // MARK: - Step 4: Start Server

    @Published var serverLog: String = ""

    func startServer() async {
        await MainActor.run {
            isProcessing = true
            errorMessage = ""
            serverCheckAttempts = 0
            serverRunning = false
            serverLog = ""
        }

        // Kill any stale server process from a previous run
        let _ = runShell("lsof -ti :7777 | xargs kill -9 2>/dev/null; pkill -f 'npm run dev' 2>/dev/null")
        try? await Task.sleep(nanoseconds: 1_000_000_000)

        // Make sure .env exists
        let envPath = "\(installPath)/.env"
        if !FileManager.default.fileExists(atPath: envPath) {
            let examplePath = "\(installPath)/.env.example"
            if FileManager.default.fileExists(atPath: examplePath) {
                let chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
                let jwtSecret = String((0..<40).map { _ in chars.randomElement()! })
                let _ = runShell("cp \"\(examplePath)\" \"\(envPath)\" && sed -i '' 's/change-me-to-something-random-at-least-32-chars/\(jwtSecret)/' \"\(envPath)\"")
            }
        }

        // Start server in background with full shell environment, capturing output
        let installDir = self.installPath
        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            let task = Process()
            let pipe = Pipe()
            task.launchPath = "/bin/zsh"
            // Use npx tsx directly (not npm run dev which uses tsx watch and silently restarts crashes)
            task.arguments = ["-l", "-c", "cd \"\(installDir)\" && npx tsx src/index.ts 2>&1"]
            task.standardOutput = pipe
            task.standardError = pipe

            pipe.fileHandleForReading.readabilityHandler = { handle in
                let data = handle.availableData
                if !data.isEmpty, let str = String(data: data, encoding: .utf8) {
                    DispatchQueue.main.async {
                        guard let self = self else { return }
                        // Keep last 2000 chars of server log
                        self.serverLog += str
                        if self.serverLog.count > 2000 {
                            self.serverLog = String(self.serverLog.suffix(2000))
                        }
                    }
                }
            }

            do {
                try task.run()
            } catch {
                DispatchQueue.main.async {
                    self?.errorMessage = "Failed to launch server process: \(error.localizedDescription)"
                    self?.isProcessing = false
                }
            }
        }

        // Poll until server actually responds to HTTP requests
        for attempt in 1...30 {
            await MainActor.run { serverCheckAttempts = attempt }
            try? await Task.sleep(nanoseconds: 2_000_000_000) // 2 seconds
            if await isServerRunning() {
                // Ensure the DB has the admin user and required columns
                await ensureDashboardAdmin()
                await MainActor.run {
                    serverRunning = true
                    isProcessing = false
                }
                return
            }
        }

        await MainActor.run {
            isProcessing = false
            errorMessage = "Server failed to start within 60 seconds. Check the log below."
        }
    }

    func isServerRunning() async -> Bool {
        guard let url = URL(string: "\(apiBase)/setup/status") else { return false }
        // Use a short timeout to avoid hanging
        var request = URLRequest(url: url)
        request.timeoutInterval = 3
        do {
            let (_, response) = try await URLSession.shared.data(for: request)
            return (response as? HTTPURLResponse)?.statusCode == 200
        } catch {
            return false
        }
    }

    /// Ensure the dashboard_users table has the last_login_at column and a default admin user.
    /// This covers the case where the server's own ensureDefaultAdmin() fails due to schema mismatch.
    func ensureDashboardAdmin() async {
        let dbPath = "\(installPath)/data/openwhale.db"
        guard FileManager.default.fileExists(atPath: dbPath) else { return }

        // Add last_login_at column if missing (ALTER TABLE is a no-op error if it already exists)
        let _ = runShell("sqlite3 \"\(dbPath)\" \"ALTER TABLE dashboard_users ADD COLUMN last_login_at INTEGER;\" 2>/dev/null")

        // Check if any users exist
        let check = runShell("sqlite3 \"\(dbPath)\" \"SELECT COUNT(*) FROM dashboard_users;\" 2>/dev/null")
        let count = Int(check.output) ?? 0

        if count == 0 {
            // Insert default admin user: admin/admin (SHA-256 hash of "admin")
            let hash = runShell("echo -n 'admin' | shasum -a 256 | awk '{print $1}'")
            let uuid = UUID().uuidString
            let timestamp = Int(Date().timeIntervalSince1970)
            let _ = runShell("sqlite3 \"\(dbPath)\" \"INSERT INTO dashboard_users (id, username, password_hash, role, created_at) VALUES ('\(uuid)', 'admin', '\(hash.output)', 'admin', \(timestamp));\"")
        }
    }

    func saveProviders() async {
        await MainActor.run { isProcessing = true; errorMessage = "" }

        var providers: [String: [String: Any]] = [:]
        if !anthropicKey.isEmpty { providers["anthropic"] = ["apiKey": anthropicKey, "enabled": true] }
        if !openaiKey.isEmpty { providers["openai"] = ["apiKey": openaiKey, "enabled": true] }
        if !googleKey.isEmpty { providers["google"] = ["apiKey": googleKey, "enabled": true] }
        if !deepseekKey.isEmpty { providers["deepseek"] = ["apiKey": deepseekKey, "enabled": true] }
        if !ollamaUrl.isEmpty { providers["ollama"] = ["baseUrl": ollamaUrl, "enabled": true] }

        let body: [String: Any] = ["providers": providers]

        do {
            try await apiPost("/setup/step/2", body: body)
            await MainActor.run { isProcessing = false }
        } catch {
            await MainActor.run {
                isProcessing = false
                errorMessage = "Failed to save providers: \(error.localizedDescription)"
            }
        }
    }

    func testAIConnection() async {
        await MainActor.run { testAIStatus = "Testing..." }

        // Find first configured provider
        var provider = ""
        var key = ""
        if !anthropicKey.isEmpty { provider = "anthropic"; key = anthropicKey }
        else if !openaiKey.isEmpty { provider = "openai"; key = openaiKey }
        else if !googleKey.isEmpty { provider = "google"; key = googleKey }
        else if !deepseekKey.isEmpty { provider = "deepseek"; key = deepseekKey }

        if provider.isEmpty {
            await MainActor.run { testAIStatus = "❌ No API key entered" }
            return
        }

        do {
            let result = try await apiPost("/setup/test-ai", body: ["provider": provider, "apiKey": key])
            let ok = (result["ok"] as? Bool) ?? false
            await MainActor.run {
                testAIStatus = ok ? "✅ Connection successful!" : "❌ Connection failed"
            }
        } catch {
            await MainActor.run { testAIStatus = "❌ \(error.localizedDescription)" }
        }
    }

    // MARK: - Step 6: Channels

    func connectWhatsApp() async {
        await MainActor.run { whatsappConnecting = true; errorMessage = "" }
        do {
            // Trigger connection — same as dashboard: POST /channels/whatsapp/connect
            try await apiPost("/channels/whatsapp/connect", body: [:])
            
            // Poll for QR code and connection status — same as dashboard: GET /channels/whatsapp/status
            for _ in 1...90 {
                try? await Task.sleep(nanoseconds: 2_000_000_000)
                let status = try await apiGet("/channels/whatsapp/status")
                
                if status["connected"] as? Bool == true {
                    await MainActor.run {
                        whatsappConnected = true
                        whatsappConnecting = false
                        whatsappQR = ""
                    }
                    return
                } else if let qrCode = status["qrCode"] as? String {
                    await MainActor.run {
                        whatsappQR = qrCode
                        whatsappConnecting = false
                    }
                }
            }
            // Timeout
            await MainActor.run {
                whatsappConnecting = false
                errorMessage = "WhatsApp connection timed out. Please try again."
            }
        } catch {
            await MainActor.run {
                whatsappConnecting = false
                errorMessage = "WhatsApp connection failed: \(error.localizedDescription)"
            }
        }
    }

    func connectTelegram() async {
        guard !telegramToken.isEmpty else { return }
        await MainActor.run { isProcessing = true; errorMessage = "" }
        do {
            let result = try await apiPost("/channels/telegram/connect", body: ["telegramBotToken": telegramToken])
            let ok = result["ok"] as? Bool ?? false
            await MainActor.run {
                isProcessing = false
                if !ok { errorMessage = "Telegram connection failed" }
            }
        } catch {
            await MainActor.run {
                isProcessing = false
                errorMessage = "Telegram: \(error.localizedDescription)"
            }
        }
    }

    func connectDiscord() async {
        guard !discordToken.isEmpty else { return }
        await MainActor.run { isProcessing = true; errorMessage = "" }
        do {
            let result = try await apiPost("/channels/discord/connect", body: ["discordBotToken": discordToken])
            let ok = result["ok"] as? Bool ?? false
            await MainActor.run {
                isProcessing = false
                if !ok { errorMessage = "Discord connection failed" }
            }
        } catch {
            await MainActor.run {
                isProcessing = false
                errorMessage = "Discord: \(error.localizedDescription)"
            }
        }
    }

    func saveChannels() async {
        await MainActor.run { isProcessing = true; errorMessage = "" }
        let channels: [String: Bool] = [
            "whatsapp": whatsappEnabled,
            "telegram": telegramEnabled,
            "discord": discordEnabled,
            "dashboard": true
        ]
        do {
            try await apiPost("/setup/step/3", body: ["channels": channels])
            await MainActor.run { isProcessing = false }
        } catch {
            await MainActor.run {
                isProcessing = false
                errorMessage = "Failed to save channels"
            }
        }
    }

    // MARK: - Step 7: Skills

    func saveSkills() async {
        await MainActor.run { isProcessing = true; errorMessage = "" }
        var skills: [String: [String: Any]] = [:]
        if !githubToken.isEmpty { skills["github"] = ["apiKey": githubToken, "enabled": true] }
        if !weatherKey.isEmpty { skills["weather"] = ["apiKey": weatherKey, "enabled": true] }
        if !notionKey.isEmpty { skills["notion"] = ["apiKey": notionKey, "enabled": true] }

        do {
            try await apiPost("/setup/step/4", body: ["skills": skills])
            
            // Google creds use a separate API — same as dashboard: POST /skills/google/config
            if !googleCredsJSON.isEmpty {
                try await apiPost("/skills/google/config", body: ["apiKey": googleCredsJSON, "enabled": true])
            }
            
            await MainActor.run { isProcessing = false }
        } catch {
            await MainActor.run {
                isProcessing = false
                errorMessage = "Failed to save skills"
            }
        }
    }

    // MARK: - Step 8: Complete

    func completeSetup() async {
        do {
            try await apiPost("/setup/step/5", body: ["completed": true])
        } catch {
            // Non-critical
        }
    }

    func openApp() {
        // Build and launch the main OpenWhale Mac app
        let appPath = "\(installPath)/OpenwhaleMacApp/.build/OpenWhale.app"
        if FileManager.default.fileExists(atPath: appPath) {
            NSWorkspace.shared.open(URL(fileURLWithPath: appPath))
        } else {
            // Open dashboard in browser
            if let url = URL(string: "http://localhost:7777/dashboard") {
                NSWorkspace.shared.open(url)
            }
        }
    }

    // MARK: - API Helpers

    @discardableResult
    func apiPost(_ path: String, body: [String: Any]) async throws -> [String: Any] {
        guard let url = URL(string: "\(apiBase)\(path)") else {
            throw URLError(.badURL)
        }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, _) = try await URLSession.shared.data(for: request)
        return (try? JSONSerialization.jsonObject(with: data) as? [String: Any]) ?? [:]
    }

    func apiGet(_ path: String) async throws -> [String: Any] {
        guard let url = URL(string: "\(apiBase)\(path)") else {
            throw URLError(.badURL)
        }
        let (data, _) = try await URLSession.shared.data(from: url)
        return (try? JSONSerialization.jsonObject(with: data) as? [String: Any]) ?? [:]
    }
}
