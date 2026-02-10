import SwiftUI

struct ProvidersPage: View {
    @EnvironmentObject var appState: AppState

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                PageHeader(title: "Providers", subtitle: "\(appState.providers.count) configured")

                if appState.providers.isEmpty {
                    EmptyStateView(icon: "cpu", title: "No Providers", subtitle: "No AI providers configured")
                } else {
                    VStack(spacing: 10) {
                        ForEach(appState.providers) { provider in
                            ProviderCard(provider: provider)
                        }
                    }
                }
            }
            .padding(28)
        }
    }
}

struct ProviderCard: View {
    @EnvironmentObject var appState: AppState
    let provider: OpenWhaleClient.ProvidersResponse.ProviderInfo
    @State private var isExpanded = false
    @State private var apiKey: String = ""
    @State private var selectedModel: String = ""
    @State private var isEnabled: Bool = true

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Header row — always visible
            Button {
                withAnimation(.easeInOut(duration: 0.2)) { isExpanded.toggle() }
            } label: {
                HStack(spacing: 12) {
                    Image(systemName: "cpu")
                        .font(.system(size: 14, weight: .medium))
                        .foregroundColor(.owPrimary)
                        .frame(width: 34, height: 34)
                        .background(Color.owPrimary.opacity(0.10))
                        .clipShape(RoundedRectangle(cornerRadius: 9, style: .continuous))

                    VStack(alignment: .leading, spacing: 2) {
                        Text(provider.name ?? "Unknown")
                            .font(.owHeadline)
                            .foregroundColor(.owTextPrimary)
                        if let models = provider.models, !models.isEmpty {
                            Text("\(models.count) models")
                                .font(.owCaption)
                                .foregroundColor(.owTextTertiary)
                        }
                    }
                    Spacer()

                    if provider.hasKey ?? false {
                        Text("Key ✓")
                            .pillBadge(color: .owGreen)
                    }

                    StatusBadge(text: (provider.enabled ?? false) ? "On" : "Off", isActive: provider.enabled ?? false)

                    Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                        .font(.system(size: 11, weight: .medium))
                        .foregroundColor(.owTextTertiary)
                }
            }
            .buttonStyle(.plain)

            // Expanded content
            if isExpanded {
                SubtleDivider()
                    .padding(.top, 14)

                VStack(spacing: 16) {
                    // API Key
                    VStack(alignment: .leading, spacing: 6) {
                        Text("API KEY")
                            .sectionHeader()
                        ModernSecureField(placeholder: "Enter API key...", text: $apiKey)
                    }

                    // Model selector
                    if let models = provider.models, !models.isEmpty {
                        VStack(alignment: .leading, spacing: 6) {
                            Text("MODEL")
                                .sectionHeader()
                            Picker("", selection: $selectedModel) {
                                ForEach(models, id: \.self) { model in
                                    Text(model).tag(model)
                                }
                            }
                            .labelsHidden()
                            .pickerStyle(.menu)
                            .tint(.owPrimary)
                        }
                    }

                    // Toggle + Save
                    HStack {
                        ModernToggleRow(label: "Enabled", isOn: $isEnabled, icon: "power")
                        Spacer()
                        ActionButton(title: "Save", icon: "checkmark") {
                            Task {
                                await appState.saveProviderConfig(
                                    type: provider.type ?? "",
                                    apiKey: apiKey,
                                    enabled: isEnabled,
                                    selectedModel: selectedModel
                                )
                            }
                        }
                    }
                }
                .padding(.top, 14)
            }
        }
        .cardStyle()
        .onAppear {
            isEnabled = provider.enabled ?? false
            if let models = provider.models, !models.isEmpty {
                selectedModel = models.first ?? ""
            }
        }
    }
}
