import SwiftUI

/// Quick chat interface embedded in the menu bar popover
struct MiniChatView: View {
    @EnvironmentObject var state: AppState
    @FocusState private var isInputFocused: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Label("Quick Chat", systemImage: "bubble.left.and.bubble.right")
                .font(.caption)
                .fontWeight(.semibold)
                .foregroundStyle(.secondary)

            // Messages
            if !state.chatMessages.isEmpty {
                ScrollViewReader { proxy in
                    ScrollView {
                        VStack(spacing: 4) {
                            ForEach(state.chatMessages.suffix(8)) { msg in
                                miniChatStep(msg).id(msg.id)
                            }
                        }
                    }
                    .frame(maxHeight: 200)
                    .onChange(of: state.chatMessages.count) { _, _ in
                        if let last = state.chatMessages.last {
                            withAnimation { proxy.scrollTo(last.id, anchor: .bottom) }
                        }
                    }
                }
            }

            // Input
            HStack(spacing: 8) {
                TextField("Ask anything...", text: $state.chatInput)
                    .textFieldStyle(.plain)
                    .font(.caption)
                    .padding(6)
                    .background(.quaternary, in: RoundedRectangle(cornerRadius: 6))
                    .focused($isInputFocused)
                    .onSubmit {
                        Task { await state.sendMessage() }
                    }
                    .disabled(state.isSending)

                if state.isSending {
                    ProgressView()
                        .controlSize(.mini)
                } else {
                    Button {
                        Task { await state.sendMessage() }
                    } label: {
                        Image(systemName: "arrow.up.circle.fill")
                            .foregroundStyle(.blue)
                    }
                    .buttonStyle(.borderless)
                    .disabled(state.chatInput.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            }
        }
        .padding(.horizontal, 16)
    }

    @ViewBuilder
    private func miniChatStep(_ msg: AppState.ChatMessage) -> some View {
        switch msg.kind {
        case .user:
            HStack { Spacer(minLength: 24)
                Text(msg.content).font(.caption).padding(6)
                    .background(Color.blue.opacity(0.12), in: RoundedRectangle(cornerRadius: 8))
            }

        case .assistant:
            HStack(spacing: 6) {
                Text("🐋").font(.system(size: 10))
                MarkdownText(content: msg.content).font(.caption).padding(6)
                    .background(Color.secondary.opacity(0.06), in: RoundedRectangle(cornerRadius: 8))
                Spacer(minLength: 24)
            }

        case .toolStart:
            HStack(spacing: 4) {
                ProgressView().controlSize(.mini)
                Text(msg.toolName ?? "").font(.system(size: 10, weight: .medium)).foregroundStyle(.orange)
                Spacer()
            }
            .padding(4)
            .background(Color.orange.opacity(0.06), in: RoundedRectangle(cornerRadius: 6))

        case .toolEnd:
            HStack(spacing: 4) {
                Image(systemName: "checkmark").font(.system(size: 8, weight: .bold)).foregroundStyle(.green)
                Text(msg.toolName ?? "").font(.system(size: 10, weight: .medium)).foregroundStyle(.green)
                Spacer()
            }
            .padding(4)
            .background(Color.green.opacity(0.06), in: RoundedRectangle(cornerRadius: 6))

        case .thinking:
            HStack(spacing: 4) {
                ProgressView().controlSize(.mini)
                Text(msg.content).font(.system(size: 10)).foregroundStyle(.secondary).lineLimit(1)
                Spacer()
            }.padding(4)

        case .error:
            HStack(spacing: 4) {
                Image(systemName: "exclamationmark.triangle.fill").font(.system(size: 8)).foregroundStyle(.red)
                Text(msg.content).font(.system(size: 10)).foregroundStyle(.red).lineLimit(2)
                Spacer()
            }.padding(4).background(Color.red.opacity(0.06), in: RoundedRectangle(cornerRadius: 6))
        }
    }
}
