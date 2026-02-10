import SwiftUI

struct LogsPage: View {
    @EnvironmentObject var appState: AppState
    @State private var filterLevel = "all"

    private let levels = ["all", "info", "warn", "error", "debug"]

    private var filteredLogs: [OpenWhaleClient.LogEntry] {
        if filterLevel == "all" { return appState.logs }
        return appState.logs.filter { ($0.level ?? "").lowercased() == filterLevel }
    }

    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                PageHeader(title: "Logs", subtitle: "\(appState.logs.count) entries")
                Spacer()

                // Level filter pills
                HStack(spacing: 3) {
                    ForEach(levels, id: \.self) { level in
                        Button {
                            filterLevel = level
                        } label: {
                            Text(level.capitalized)
                                .font(.system(size: 11, weight: filterLevel == level ? .semibold : .regular))
                                .foregroundColor(filterLevel == level ? levelColor(level) : .owTextTertiary)
                                .padding(.horizontal, 10)
                                .padding(.vertical, 5)
                                .background(filterLevel == level ? levelColor(level).opacity(0.10) : Color.clear)
                                .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(3)
                .background(Color.owSurface)
                .clipShape(RoundedRectangle(cornerRadius: 9, style: .continuous))

                Button {
                    Task { await appState.refreshDashboardData() }
                } label: {
                    Image(systemName: "arrow.clockwise")
                        .font(.system(size: 13, weight: .medium))
                        .foregroundColor(.owTextSecondary)
                        .frame(width: 28, height: 28)
                        .background(Color.owSurface)
                        .clipShape(RoundedRectangle(cornerRadius: 7, style: .continuous))
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal, 28)
            .padding(.top, 20)
            .padding(.bottom, 12)

            SubtleDivider()

            // Log entries
            if filteredLogs.isEmpty {
                EmptyStateView(
                    icon: "list.bullet.rectangle",
                    title: "No Logs",
                    subtitle: filterLevel != "all" ? "No \(filterLevel) level logs" : "No log entries available"
                )
            } else {
                ScrollView {
                    LazyVStack(spacing: 2) {
                        ForEach(filteredLogs) { entry in
                            logRow(entry)
                        }
                    }
                    .padding(20)
                }
            }
        }
    }

    private func logRow(_ entry: OpenWhaleClient.LogEntry) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Text((entry.level ?? "info").uppercased())
                .font(.system(size: 9, weight: .bold, design: .monospaced))
                .foregroundColor(levelColor(entry.level ?? "info"))
                .frame(width: 42)
                .padding(.vertical, 3)
                .background(levelColor(entry.level ?? "info").opacity(0.10))
                .clipShape(RoundedRectangle(cornerRadius: 4, style: .continuous))

            if let ts = entry.timestamp {
                Text(formatLogTimestamp(ts))
                    .font(.owMonoSmall)
                    .foregroundColor(.owTextTertiary)
                    .frame(width: 70, alignment: .leading)
            }

            if let cat = entry.category {
                Text(cat)
                    .font(.owCaption)
                    .foregroundColor(.owCyan)
                    .frame(width: 85, alignment: .leading)
            }

            Text(entry.message ?? "")
                .font(.owMonoSmall)
                .foregroundColor(.owTextPrimary)
                .lineLimit(3)
                .textSelection(.enabled)

            Spacer()
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 7)
        .background(Color.owSurface)
        .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
    }

    private func levelColor(_ level: String) -> Color {
        switch level.lowercased() {
        case "error": return .owRed
        case "warn", "warning": return .owYellow
        case "info": return .owCyan
        case "debug": return .owTextTertiary
        default: return .owTextSecondary
        }
    }

    private func formatLogTimestamp(_ ts: String) -> String {
        if ts.contains("T") {
            let parts = ts.split(separator: "T")
            if parts.count > 1 {
                return String(parts[1].prefix(8))
            }
        }
        return String(ts.suffix(8))
    }
}
