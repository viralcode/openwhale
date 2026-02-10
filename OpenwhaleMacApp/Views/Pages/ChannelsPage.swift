import SwiftUI

struct ChannelsPage: View {
    @EnvironmentObject var appState: AppState

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                PageHeader(title: "Channels", subtitle: "\(appState.channels.count) configured")

                if appState.channels.isEmpty {
                    EmptyStateView(icon: "antenna.radiowaves.left.and.right.slash", title: "No Channels", subtitle: "No channels are configured")
                } else {
                    VStack(spacing: 10) {
                        ForEach(appState.channels) { channel in
                            channelCard(channel)
                        }
                    }
                }
            }
            .padding(28)
        }
    }

    private func channelCard(_ channel: OpenWhaleClient.ChannelInfo) -> some View {
        HStack(spacing: 14) {
            // Channel icon
            Image(systemName: iconForChannel(channel.name))
                .font(.system(size: 15, weight: .medium))
                .foregroundColor(.owPrimary)
                .frame(width: 38, height: 38)
                .background(Color.owPrimary.opacity(0.10))
                .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))

            // Name + status
            VStack(alignment: .leading, spacing: 3) {
                Text(channel.name)
                    .font(.owHeadline)
                    .foregroundColor(.owTextPrimary)
                HStack(spacing: 6) {
                    Circle()
                        .fill(channel.connected ? Color.owGreen : Color.owTextTertiary)
                        .frame(width: 6, height: 6)
                    Text(channel.connected ? "Connected" : "Disconnected")
                        .font(.owCaption)
                        .foregroundColor(channel.connected ? .owGreen : .owTextTertiary)
                }
            }

            Spacer()

            // Message counts
            VStack(alignment: .trailing, spacing: 2) {
                let total = (channel.messagesSent ?? 0) + (channel.messagesReceived ?? 0)
                if total > 0 {
                    Text("\(total)")
                        .font(.owStatSmall)
                        .foregroundColor(.owTextPrimary)
                    Text("messages")
                        .font(.system(size: 10))
                        .foregroundColor(.owTextTertiary)
                }
            }

            // Toggle
            Toggle("", isOn: Binding(
                get: { channel.enabled },
                set: { _ in
                    Task { await appState.toggleChannel(channel.type) }
                }
            ))
            .toggleStyle(.switch)
            .labelsHidden()
            .tint(.owPrimary)
        }
        .cardStyle()
    }

    private func iconForChannel(_ name: String) -> String {
        let n = name.lowercased()
        if n.contains("imessage") { return "message" }
        if n.contains("whatsapp") { return "phone.bubble" }
        if n.contains("telegram") { return "paperplane" }
        if n.contains("discord") { return "gamecontroller" }
        if n.contains("twitter") || n.contains("x.com") { return "at" }
        if n.contains("slack") { return "number" }
        return "bubble.left"
    }
}
