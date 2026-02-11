import SwiftUI

struct InstallerView: View {
    @EnvironmentObject var state: InstallerState

    let stepNames = [
        "Welcome", "Prerequisites", "Clone Repo", "Install Deps",
        "Start Server", "AI Providers", "Channels", "Skills", "Complete"
    ]

    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack(spacing: 10) {
                Text("🐋")
                    .font(.system(size: 28))
                Text("OpenWhale Installer")
                    .font(.owTitle)
                    .foregroundColor(.owTextPrimary)
                Text("—")
                    .foregroundColor(.owTextTertiary)
                Text("Set up your personal AI assistant")
                    .font(.owBody)
                    .foregroundColor(.owTextSecondary)
            }
            .padding(.vertical, 12)

            // Step indicator
            stepIndicator
                .padding(.horizontal, 40)
                .padding(.bottom, 12)

            Divider().background(Color.owBorder)

            // Content — no scroll, everything fits
            stepContent
                .padding(24)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .background(Color.owBackground)
    }

    // MARK: - Step Indicator

    private var stepIndicator: some View {
        HStack(spacing: 0) {
            ForEach(0..<stepNames.count, id: \.self) { i in
                if i > 0 {
                    Rectangle()
                        .fill(i <= state.currentStep ? Color.owPrimary : Color.owBorderLight)
                        .frame(height: 2)
                }
                ZStack {
                    Circle()
                        .fill(i < state.currentStep ? Color.owGreen : i == state.currentStep ? Color.owPrimary : Color.owSurfaceRaised)
                        .frame(width: 24, height: 24)
                        .overlay(
                            Circle().stroke(i <= state.currentStep ? Color.clear : Color.owBorderLight, lineWidth: 1)
                        )
                    if i < state.currentStep {
                        Image(systemName: "checkmark")
                            .font(.system(size: 10, weight: .bold))
                            .foregroundColor(.white)
                    } else {
                        Text("\(i + 1)")
                            .font(.system(size: 10, weight: .bold))
                            .foregroundColor(i == state.currentStep ? .white : .owTextTertiary)
                    }
                }
            }
        }
    }

    // MARK: - Content Router

    @ViewBuilder
    private var stepContent: some View {
        switch state.currentStep {
        case 0: welcomeStep
        case 1: prerequisitesStep
        case 2: cloneStep
        case 3: npmInstallStep
        case 4: startServerStep
        case 5: providersStep
        case 6: channelsStep
        case 7: skillsStep
        case 8: completeStep
        default: welcomeStep
        }
    }

    // MARK: - Step 0: Welcome

    private var welcomeStep: some View {
        VStack(alignment: .leading, spacing: 20) {
            sectionTitle("Welcome to OpenWhale!")
            sectionDesc("OpenWhale is your personal AI assistant that can control your computer, manage your calendar, send messages, and much more — all through a simple chat interface.")

            VStack(alignment: .leading, spacing: 12) {
                Text("What we'll set up:")
                    .font(.owBodyMedium)
                    .foregroundColor(.owTextPrimary)

                ForEach([
                    "Check and install required software",
                    "Clone and install OpenWhale on your Mac",
                    "Configure AI providers (OpenAI, Anthropic, etc.)",
                    "Set up messaging channels (WhatsApp, Telegram, Discord)",
                    "Connect external services (GitHub, Spotify, etc.)"
                ], id: \.self) { item in
                    HStack(spacing: 8) {
                        Circle()
                            .fill(Color.owPrimary.opacity(0.3))
                            .frame(width: 6, height: 6)
                        Text(item)
                            .font(.owBody)
                            .foregroundColor(.owTextSecondary)
                    }
                }
            }
            .padding(16)
            .background(Color.owSurface)
            .clipShape(RoundedRectangle(cornerRadius: 12))

            Spacer()
            navButtons(backAction: nil, nextAction: { state.currentStep = 1 }, nextLabel: "Get Started →")
        }
    }

    // MARK: - Step 1: Prerequisites

    private var prerequisitesStep: some View {
        VStack(alignment: .leading, spacing: 16) {
            sectionTitle("System Check")
            sectionDesc("Checking your system for required and optional tools.")

            // Core requirements
            prereqGroup("Core Requirements", prereqs: state.prerequisites.filter { ["git", "node", "npm"].contains($0.id) })

            // Recommended
            prereqGroup("Recommended", prereqs: state.prerequisites.filter { ["homebrew", "python", "ffmpeg"].contains($0.id) })

            // Optional
            prereqGroup("Optional", prereqs: state.prerequisites.filter { ["docker", "imagesnap"].contains($0.id) })

            HStack {
                Button {
                    state.checkPrerequisites()
                } label: {
                    HStack(spacing: 5) {
                        Image(systemName: "arrow.clockwise")
                            .font(.system(size: 11))
                        Text("Re-check")
                            .font(.owCaption)
                    }
                    .foregroundColor(.owPrimary)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 6)
                    .background(Color.owPrimary.opacity(0.1))
                    .clipShape(Capsule())
                }
                .buttonStyle(.plain)
                Spacer()
            }

            if !state.errorMessage.isEmpty {
                errorBar(state.errorMessage)
            }

            navButtons(backAction: { state.currentStep = 0 }, nextAction: { state.currentStep = 2 })
        }
    }

    private func prereqGroup(_ title: String, prereqs: [Prerequisite]) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.system(size: 11, weight: .semibold))
                .foregroundColor(.owTextTertiary)
                .textCase(.uppercase)
                .tracking(0.8)

            ForEach(prereqs) { prereq in
                HStack(spacing: 12) {
                    Image(systemName: prereq.installed ? "checkmark.circle.fill" : "xmark.circle")
                        .font(.system(size: 14))
                        .foregroundColor(prereq.installed ? .owGreen : .owRed)

                    VStack(alignment: .leading, spacing: 1) {
                        Text(prereq.name)
                            .font(.owBodyMedium)
                            .foregroundColor(.owTextPrimary)
                        Text(prereq.desc)
                            .font(.owCaption)
                            .foregroundColor(.owTextTertiary)
                    }

                    Spacer()

                    if prereq.installed {
                        if !prereq.version.isEmpty {
                            Text(prereq.version)
                                .font(.owCaption)
                                .foregroundColor(.owGreen)
                        } else {
                            Text("Installed")
                                .font(.owCaption)
                                .foregroundColor(.owGreen)
                        }
                    } else if prereq.isInstalling {
                        ProgressView()
                            .scaleEffect(0.6)
                    } else if prereq.installCommand != nil {
                        Button("Install") {
                            state.installPrerequisite(prereq.id)
                        }
                        .font(.owCaption)
                        .foregroundColor(.white)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 4)
                        .background(Color.owPrimary)
                        .clipShape(Capsule())
                        .buttonStyle(.plain)
                    } else {
                        Text("Not found")
                            .font(.owCaption)
                            .foregroundColor(.owRed)
                    }
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(Color.owSurface)
                .clipShape(RoundedRectangle(cornerRadius: 8))
            }
        }
    }

    // MARK: - Step 2: Clone Repo

    private var cloneStep: some View {
        VStack(alignment: .leading, spacing: 16) {
            sectionTitle("Clone Repository")
            sectionDesc("We'll download OpenWhale to your computer.")

            VStack(alignment: .leading, spacing: 12) {
                Text("Install Location")
                    .font(.owBodyMedium)
                    .foregroundColor(.owTextPrimary)

                HStack {
                    TextField("Install path", text: $state.installPath)
                        .textFieldStyle(.plain)
                        .font(.owBody)
                        .foregroundColor(.owTextPrimary)
                        .padding(10)
                        .background(Color.owSurfaceRaised)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                        .overlay(
                            RoundedRectangle(cornerRadius: 8)
                                .stroke(Color.owBorderLight, lineWidth: 1)
                        )

                    Button {
                        let panel = NSOpenPanel()
                        panel.canChooseFiles = false
                        panel.canChooseDirectories = true
                        panel.allowsMultipleSelection = false
                        panel.canCreateDirectories = true
                        if panel.runModal() == .OK, let url = panel.url {
                            state.installPath = url.path + "/openwhale"
                        }
                    } label: {
                        Image(systemName: "folder")
                            .font(.system(size: 14))
                            .foregroundColor(.owTextSecondary)
                            .frame(width: 36, height: 36)
                            .background(Color.owSurfaceRaised)
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                    }
                    .buttonStyle(.plain)
                }

                Text("Repository: \(state.repoURL)")
                    .font(.owCaption)
                    .foregroundColor(.owTextTertiary)
            }
            .padding(16)
            .background(Color.owSurface)
            .clipShape(RoundedRectangle(cornerRadius: 12))

            if state.repoExists {
                statusPill("✅ Repository already cloned", color: .owGreen)
            }

            if !state.cloneProgress.isEmpty {
                Text(state.cloneProgress)
                    .font(.system(size: 12, design: .monospaced))
                    .foregroundColor(.owTextSecondary)
                    .padding(10)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color.owSurface)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
            }

            if state.isProcessing {
                HStack(spacing: 8) {
                    ProgressView().scaleEffect(0.7)
                    Text("Cloning repository...")
                        .font(.owBody)
                        .foregroundColor(.owTextSecondary)
                }
            }

            if !state.errorMessage.isEmpty { errorBar(state.errorMessage) }

            Spacer()
            navButtons(
                backAction: { state.currentStep = 1 },
                nextAction: {
                    if state.repoExists {
                        state.currentStep = 3
                    } else {
                        Task { await state.cloneRepo(); if state.repoExists { state.currentStep = 3 } }
                    }
                },
                nextLabel: state.repoExists ? "Continue →" : "Clone & Continue →",
                nextDisabled: state.isProcessing
            )
        }
        .onAppear { state.checkRepoExists() }
    }

    // MARK: - Step 3: npm install

    private var npmInstallStep: some View {
        VStack(alignment: .leading, spacing: 16) {
            sectionTitle("Install Dependencies")
            sectionDesc("Installing Node.js packages required by OpenWhale.")

            if !state.npmProgress.isEmpty {
                Text(state.npmProgress)
                    .font(.system(size: 12, design: .monospaced))
                    .foregroundColor(.owTextSecondary)
                    .lineLimit(1)
                    .truncationMode(.middle)
            }

            if !state.logOutput.isEmpty {
                ScrollView {
                    Text(state.logOutput.suffix(2000))
                        .font(.system(size: 11, design: .monospaced))
                        .foregroundColor(.owTextTertiary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .textSelection(.enabled)
                }
                .frame(maxHeight: 200)
                .padding(10)
                .background(Color.owSurface)
                .clipShape(RoundedRectangle(cornerRadius: 8))
            }

            if state.isProcessing {
                HStack(spacing: 8) {
                    ProgressView().scaleEffect(0.7)
                    Text("Installing packages…")
                        .font(.owBody)
                        .foregroundColor(.owTextSecondary)
                }
            }

            if !state.errorMessage.isEmpty { errorBar(state.errorMessage) }

            Spacer()
            navButtons(
                backAction: { state.currentStep = 2 },
                nextAction: {
                    Task {
                        await state.npmInstall()
                        if state.errorMessage.isEmpty { await MainActor.run { state.currentStep = 4 } }
                    }
                },
                nextLabel: "Install & Continue →",
                nextDisabled: state.isProcessing
            )
        }
    }

    // MARK: - Step 4: Start Server

    private var startServerStep: some View {
        VStack(alignment: .leading, spacing: 16) {
            sectionTitle("Start OpenWhale Server")
            sectionDesc("Starting the server so we can configure your AI providers and channels.")

            if state.serverRunning {
                statusPill("✅ Server is running on localhost:7777", color: .owGreen)
            } else if state.isProcessing {
                VStack(spacing: 12) {
                    ProgressView()
                        .scaleEffect(0.8)
                    Text("Starting server (\(state.serverCheckAttempts)/30)...")
                        .font(.owBody)
                        .foregroundColor(.owTextSecondary)
                    Text("This may take up to 60 seconds on first run")
                        .font(.owCaption)
                        .foregroundColor(.owTextTertiary)
                }
                .frame(maxWidth: .infinity)
                .padding(20)
                .background(Color.owSurface)
                .clipShape(RoundedRectangle(cornerRadius: 12))
            }

            // Live server log output
            if !state.serverLog.isEmpty {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Server Output")
                        .font(.owCaption)
                        .foregroundColor(.owTextTertiary)
                    ScrollView {
                        Text(state.serverLog.suffix(1500))
                            .font(.system(size: 10, design: .monospaced))
                            .foregroundColor(.owTextTertiary)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .textSelection(.enabled)
                    }
                    .frame(maxHeight: 120)
                }
                .padding(10)
                .background(Color.owSurface)
                .clipShape(RoundedRectangle(cornerRadius: 8))
            }

            if !state.errorMessage.isEmpty { errorBar(state.errorMessage) }

            Spacer()
            navButtons(
                backAction: { state.currentStep = 3 },
                nextAction: {
                    if state.serverRunning {
                        state.currentStep = 5
                    } else {
                        Task {
                            await state.startServer()
                            if state.serverRunning { await MainActor.run { state.currentStep = 5 } }
                        }
                    }
                },
                nextLabel: state.serverRunning ? "Continue →" : "Start Server →",
                nextDisabled: state.isProcessing
            )
        }
    }

    // MARK: - Step 5: AI Providers

    private var providersStep: some View {
        VStack(alignment: .leading, spacing: 16) {
            sectionTitle("AI Providers")
            sectionDesc("Configure at least one AI provider to use OpenWhale.")

            ScrollView {
                VStack(spacing: 12) {
                    providerField("Anthropic API Key (Recommended)", placeholder: "sk-ant-...", text: $state.anthropicKey, hint: "console.anthropic.com")
                    providerField("OpenAI API Key", placeholder: "sk-...", text: $state.openaiKey, hint: "platform.openai.com/api-keys")
                    providerField("Google AI API Key", placeholder: "AIza...", text: $state.googleKey, hint: "aistudio.google.com/apikey")
                    providerField("DeepSeek API Key", placeholder: "sk-...", text: $state.deepseekKey, hint: "platform.deepseek.com")
                    providerField("Ollama (Local)", placeholder: "http://localhost:11434", text: $state.ollamaUrl, hint: "Run models locally — no API key needed", isPassword: false)
                }
            }

            // Test connection
            HStack(spacing: 12) {
                Button {
                    Task { await state.testAIConnection() }
                } label: {
                    HStack(spacing: 5) {
                        Text("🧪")
                        Text("Test AI Connection")
                            .font(.owCaption)
                    }
                    .foregroundColor(.owTextPrimary)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 8)
                    .background(Color.owSurfaceRaised)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                    .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color.owBorderLight, lineWidth: 1))
                }
                .buttonStyle(.plain)

                if !state.testAIStatus.isEmpty {
                    Text(state.testAIStatus)
                        .font(.owCaption)
                        .foregroundColor(.owTextSecondary)
                }
            }

            if !state.errorMessage.isEmpty { errorBar(state.errorMessage) }

            navButtons(
                backAction: { state.currentStep = 4 },
                nextAction: {
                    Task {
                        await state.saveProviders()
                        if state.errorMessage.isEmpty { await MainActor.run { state.currentStep = 6 } }
                    }
                },
                nextDisabled: state.isProcessing
            )
        }
    }

    private func providerField(_ label: String, placeholder: String, text: Binding<String>, hint: String, isPassword: Bool = true) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label)
                .font(.owBodyMedium)
                .foregroundColor(.owTextPrimary)

            if isPassword {
                SecureField(placeholder, text: text)
                    .textFieldStyle(.plain)
                    .font(.owBody)
                    .foregroundColor(.owTextPrimary)
                    .padding(10)
                    .background(Color.owSurfaceRaised)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                    .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color.owBorderLight, lineWidth: 1))
            } else {
                TextField(placeholder, text: text)
                    .textFieldStyle(.plain)
                    .font(.owBody)
                    .foregroundColor(.owTextPrimary)
                    .padding(10)
                    .background(Color.owSurfaceRaised)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                    .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color.owBorderLight, lineWidth: 1))
            }

            Text(hint)
                .font(.system(size: 11))
                .foregroundColor(.owTextTertiary)
        }
    }

    // MARK: - Step 6: Channels

    private var channelsStep: some View {
        VStack(alignment: .leading, spacing: 16) {
            sectionTitle("Communication Channels")
            sectionDesc("Choose how you want to interact with OpenWhale.")

            // WhatsApp
            channelCard(
                icon: "💬", name: "WhatsApp", desc: "Chat with OpenWhale via WhatsApp",
                enabled: $state.whatsappEnabled
            ) {
                if state.whatsappConnected {
                    statusPill("✅ Connected", color: .owGreen)
                } else if !state.whatsappQR.isEmpty {
                    VStack(spacing: 8) {
                        Text("📱 Scan with WhatsApp:")
                            .font(.owCaption)
                            .foregroundColor(.owTextSecondary)
                        // QR code would be shown; for now show the data URL
                        AsyncImage(url: URL(string: state.whatsappQR)) { image in
                            image.resizable().frame(width: 180, height: 180)
                                .clipShape(RoundedRectangle(cornerRadius: 8))
                        } placeholder: {
                            ProgressView()
                        }
                        Text("WhatsApp → Settings → Linked Devices → Link")
                            .font(.system(size: 10))
                            .foregroundColor(.owTextTertiary)
                    }
                } else if state.whatsappConnecting {
                    HStack(spacing: 8) {
                        ProgressView().scaleEffect(0.6)
                        Text("Generating QR code...")
                            .font(.owCaption)
                            .foregroundColor(.owTextTertiary)
                    }
                } else {
                    Button("📲 Connect WhatsApp") {
                        Task { await state.connectWhatsApp() }
                    }
                    .font(.owCaption)
                    .foregroundColor(.white)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 8)
                    .frame(maxWidth: .infinity)
                    .background(Color.owPrimary)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                    .buttonStyle(.plain)
                }
            }

            // Telegram
            channelCard(icon: "📱", name: "Telegram", desc: "Chat via Telegram bot", enabled: $state.telegramEnabled) {
                VStack(alignment: .leading, spacing: 6) {
                    Text("Enter your Bot Token from @BotFather:")
                        .font(.owCaption)
                        .foregroundColor(.owTextSecondary)
                    HStack {
                        SecureField("Bot Token", text: $state.telegramToken)
                            .textFieldStyle(.plain)
                            .font(.owBody)
                            .foregroundColor(.owTextPrimary)
                            .padding(8)
                            .background(Color.owSurfaceRaised)
                            .clipShape(RoundedRectangle(cornerRadius: 6))
                        Button("Connect") {
                            Task { await state.connectTelegram() }
                        }
                        .font(.owCaption)
                        .foregroundColor(.white)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 6)
                        .background(Color.owPrimary)
                        .clipShape(RoundedRectangle(cornerRadius: 6))
                        .buttonStyle(.plain)
                    }
                }
            }

            // Discord
            channelCard(icon: "🎮", name: "Discord", desc: "Chat via Discord bot", enabled: $state.discordEnabled) {
                VStack(alignment: .leading, spacing: 6) {
                    Text("Enter your Discord Bot Token:")
                        .font(.owCaption)
                        .foregroundColor(.owTextSecondary)
                    HStack {
                        SecureField("Bot Token", text: $state.discordToken)
                            .textFieldStyle(.plain)
                            .font(.owBody)
                            .foregroundColor(.owTextPrimary)
                            .padding(8)
                            .background(Color.owSurfaceRaised)
                            .clipShape(RoundedRectangle(cornerRadius: 6))
                        Button("Connect") {
                            Task { await state.connectDiscord() }
                        }
                        .font(.owCaption)
                        .foregroundColor(.white)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 6)
                        .background(Color.owPrimary)
                        .clipShape(RoundedRectangle(cornerRadius: 6))
                        .buttonStyle(.plain)
                    }
                }
            }

            // Dashboard (always on)
            HStack(spacing: 12) {
                Text("🌐").font(.system(size: 20))
                VStack(alignment: .leading) {
                    Text("Web Dashboard").font(.owBodyMedium).foregroundColor(.owTextPrimary)
                    Text("Always enabled").font(.owCaption).foregroundColor(.owTextTertiary)
                }
                Spacer()
                Text("✅").foregroundColor(.owGreen)
            }
            .padding(12)
            .background(Color.owSurface)
            .clipShape(RoundedRectangle(cornerRadius: 10))

            if !state.errorMessage.isEmpty { errorBar(state.errorMessage) }

            navButtons(
                backAction: { state.currentStep = 5 },
                nextAction: {
                    Task {
                        await state.saveChannels()
                        if state.errorMessage.isEmpty { await MainActor.run { state.currentStep = 7 } }
                    }
                },
                nextDisabled: state.isProcessing
            )
        }
    }

    private func channelCard<Content: View>(icon: String, name: String, desc: String, enabled: Binding<Bool>, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 12) {
                Text(icon).font(.system(size: 20))
                VStack(alignment: .leading) {
                    Text(name).font(.owBodyMedium).foregroundColor(.owTextPrimary)
                    Text(desc).font(.owCaption).foregroundColor(.owTextTertiary)
                }
                Spacer()
                Toggle("", isOn: enabled)
                    .toggleStyle(.switch)
                    .scaleEffect(0.7)
            }

            if enabled.wrappedValue {
                Divider().background(Color.owBorderLight).padding(.vertical, 8)
                content()
            }
        }
        .padding(12)
        .background(Color.owSurface)
        .clipShape(RoundedRectangle(cornerRadius: 10))
        .overlay(RoundedRectangle(cornerRadius: 10).stroke(Color.owBorderLight, lineWidth: 0.5))
    }

    // MARK: - Step 7: Skills

    private var skillsStep: some View {
        VStack(alignment: .leading, spacing: 16) {
            sectionTitle("Skills & Integrations")
            sectionDesc("Connect external services. All optional — configure later in Settings.")

            // Google Services
            VStack(alignment: .leading, spacing: 8) {
                HStack(spacing: 8) {
                    Text("🌐").font(.system(size: 20))
                    VStack(alignment: .leading) {
                        Text("Google Services").font(.owBodyMedium).foregroundColor(.owTextPrimary)
                        Text("Gmail, Calendar, Drive, Tasks").font(.owCaption).foregroundColor(.owTextTertiary)
                    }
                }

                SecureField("Paste Google API credentials JSON...", text: $state.googleCredsJSON)
                    .textFieldStyle(.plain)
                    .font(.owBody)
                    .foregroundColor(.owTextPrimary)
                    .padding(10)
                    .background(Color.owSurfaceRaised)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                    .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color.owBorderLight, lineWidth: 1))

                Text("Google Cloud Console → OAuth 2.0 → Download credentials.json → Paste above")
                    .font(.system(size: 10))
                    .foregroundColor(.owTextTertiary)
            }
            .padding(14)
            .background(Color.owSurface)
            .clipShape(RoundedRectangle(cornerRadius: 10))

            providerField("🐙 GitHub Token", placeholder: "ghp_...", text: $state.githubToken, hint: "github.com/settings/tokens — enables repo access, issues, PRs")
            providerField("🌤️ OpenWeatherMap API Key", placeholder: "...", text: $state.weatherKey, hint: "Free at openweathermap.org — 1000 calls/day")
            providerField("📝 Notion API Key", placeholder: "secret_...", text: $state.notionKey, hint: "notion.so/profile/integrations → Create → Copy secret")

            if !state.errorMessage.isEmpty { errorBar(state.errorMessage) }

            navButtons(
                backAction: { state.currentStep = 6 },
                nextAction: {
                    Task {
                        await state.saveSkills()
                        if state.errorMessage.isEmpty {
                            await state.completeSetup()
                            await MainActor.run { state.currentStep = 8 }
                        }
                    }
                },
                nextDisabled: state.isProcessing
            )
        }
    }

    // MARK: - Step 8: Complete

    private var completeStep: some View {
        VStack(spacing: 20) {
            Spacer()

            Text("🎉").font(.system(size: 64))

            Text("Setup Complete!")
                .font(.owLargeTitle)
                .foregroundColor(.owTextPrimary)

            Text("OpenWhale is ready to use. Start chatting or open the dashboard.")
                .font(.owBody)
                .foregroundColor(.owTextSecondary)
                .multilineTextAlignment(.center)

            HStack(spacing: 12) {
                Button {
                    state.openApp()
                } label: {
                    HStack(spacing: 6) {
                        Text("💬")
                        Text("Open OpenWhale")
                            .font(.owBodyMedium)
                    }
                    .foregroundColor(.white)
                    .padding(.horizontal, 20)
                    .padding(.vertical, 10)
                    .background(Color.owPrimary)
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                }
                .buttonStyle(.plain)

                Button {
                    if let url = URL(string: "http://localhost:7777/dashboard") {
                        NSWorkspace.shared.open(url)
                    }
                } label: {
                    HStack(spacing: 6) {
                        Text("🌐")
                        Text("Open Dashboard")
                            .font(.owBodyMedium)
                    }
                    .foregroundColor(.owTextPrimary)
                    .padding(.horizontal, 20)
                    .padding(.vertical, 10)
                    .background(Color.owSurfaceRaised)
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                    .overlay(RoundedRectangle(cornerRadius: 10).stroke(Color.owBorderLight, lineWidth: 1))
                }
                .buttonStyle(.plain)
            }
            .padding(.top, 10)

            Spacer()
        }
        .frame(maxWidth: .infinity)
    }

    // MARK: - Shared Components

    private func sectionTitle(_ text: String) -> some View {
        Text(text)
            .font(.owTitle)
            .foregroundColor(.owTextPrimary)
    }

    private func sectionDesc(_ text: String) -> some View {
        Text(text)
            .font(.owBody)
            .foregroundColor(.owTextSecondary)
    }

    private func errorBar(_ message: String) -> some View {
        HStack(spacing: 8) {
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.system(size: 12))
                .foregroundColor(.owRed)
            Text(message)
                .font(.owCaption)
                .foregroundColor(.owRed)
        }
        .padding(10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.owRed.opacity(0.08))
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color.owRed.opacity(0.2), lineWidth: 1))
    }

    private func statusPill(_ text: String, color: Color) -> some View {
        Text(text)
            .font(.owBodyMedium)
            .foregroundColor(color)
            .padding(.horizontal, 14)
            .padding(.vertical, 8)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(color.opacity(0.08))
            .clipShape(RoundedRectangle(cornerRadius: 8))
    }

    private func navButtons(backAction: (() -> Void)?, nextAction: @escaping () -> Void, nextLabel: String = "Continue →", nextDisabled: Bool = false) -> some View {
        HStack {
            if let back = backAction {
                Button("← Back") { back() }
                    .font(.owBodyMedium)
                    .foregroundColor(.owTextSecondary)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 8)
                    .background(Color.owSurfaceRaised)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                    .buttonStyle(.plain)
            }

            Spacer()

            Button(nextLabel) { nextAction() }
                .font(.owBodyMedium)
                .foregroundColor(.white)
                .padding(.horizontal, 20)
                .padding(.vertical, 10)
                .background(nextDisabled ? Color.owSurfaceHover : Color.owPrimary)
                .clipShape(RoundedRectangle(cornerRadius: 10))
                .buttonStyle(.plain)
                .disabled(nextDisabled)
        }
        .padding(.top, 8)
    }
}
