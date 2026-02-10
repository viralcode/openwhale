import SwiftUI

struct SkillsPage: View {
    @EnvironmentObject var appState: AppState

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                PageHeader(title: "API Skills", subtitle: "Manage external API integrations")

                if appState.skills.isEmpty {
                    EmptyStateView(
                        icon: "wrench.and.screwdriver",
                        title: "No API Skills",
                        subtitle: "No API skills configured"
                    )
                } else {
                    VStack(spacing: 10) {
                        ForEach(appState.skills) { skill in
                            SkillCard(skill: skill)
                        }
                    }
                }
            }
            .padding(24)
        }
    }
}

struct SkillCard: View {
    @EnvironmentObject var appState: AppState
    let skill: OpenWhaleClient.SkillInfo

    @State private var apiKey = ""
    @State private var isEnabled = false
    @State private var isExpanded = false

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Header row
            Button {
                withAnimation(.easeInOut(duration: 0.2)) {
                    isExpanded.toggle()
                }
            } label: {
                HStack(spacing: 12) {
                    Image(systemName: skillIcon(skill.name ?? ""))
                        .font(.system(size: 15, weight: .medium))
                        .foregroundColor(.owPrimary)
                        .frame(width: 32, height: 32)
                        .background(Color.owPrimary.opacity(0.1))
                        .clipShape(RoundedRectangle(cornerRadius: 7, style: .continuous))

                    VStack(alignment: .leading, spacing: 2) {
                        Text(skill.name ?? skill.id)
                            .font(.owHeadline)
                            .foregroundColor(.owTextPrimary)
                        if let desc = skill.description, !desc.isEmpty {
                            Text(desc)
                                .font(.owCaption)
                                .foregroundColor(.owTextTertiary)
                                .lineLimit(1)
                        }
                    }

                    Spacer()

                    HStack(spacing: 6) {
                        if !(skill.noCreds ?? false) {
                            if skill.hasKey ?? false {
                                Text("Key ✓")
                                    .pillBadge(color: .owGreen)
                            } else {
                                Text("Key Required")
                                    .pillBadge(color: .owYellow)
                            }
                        }
                        StatusBadge(text: (skill.enabled ?? false) ? "On" : "Off", isActive: skill.enabled ?? false)
                    }

                    Image(systemName: "chevron.right")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundColor(.owTextTertiary)
                        .rotationEffect(.degrees(isExpanded ? 90 : 0))
                }
            }
            .buttonStyle(.plain)

            // Expanded section
            if isExpanded {
                VStack(alignment: .leading, spacing: 12) {
                    Divider().background(Color.owBorder).padding(.vertical, 4)

                    if !(skill.noCreds ?? false) {
                        VStack(alignment: .leading, spacing: 6) {
                            Text("API KEY")
                                .sectionHeader()
                            ModernSecureField(placeholder: "Enter API key...", text: $apiKey)
                        }
                    }

                    ModernToggleRow(label: "Enabled", isOn: $isEnabled, icon: "power")

                    HStack {
                        Spacer()
                        ActionButton(title: "Save", icon: "checkmark") {
                            Task {
                                await appState.saveSkillConfig(
                                    id: skill.id,
                                    apiKey: apiKey.isEmpty ? nil : apiKey,
                                    enabled: isEnabled
                                )
                            }
                        }
                    }
                }
            }
        }
        .cardStyle()
        .onAppear {
            isEnabled = skill.enabled ?? false
        }
    }

    private func skillIcon(_ name: String) -> String {
        let lower = name.lowercased()
        if lower.contains("github") { return "chevron.left.forwardslash.chevron.right" }
        if lower.contains("weather") { return "cloud.sun" }
        if lower.contains("notion") { return "doc.richtext" }
        if lower.contains("google") { return "globe" }
        if lower.contains("1password") || lower.contains("onepassword") { return "lock.shield" }
        if lower.contains("twitter") { return "at" }
        if lower.contains("elevenlabs") { return "waveform" }
        if lower.contains("twilio") { return "phone.arrow.up.right" }
        return "puzzlepiece.extension"
    }
}
