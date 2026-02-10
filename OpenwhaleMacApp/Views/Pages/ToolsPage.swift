import SwiftUI

struct ToolsPage: View {
    @EnvironmentObject var appState: AppState
    @State private var searchText = ""

    private var filteredTools: [OpenWhaleClient.ToolInfo] {
        if searchText.isEmpty { return appState.tools }
        return appState.tools.filter { tool in
            (tool.name ?? "").localizedCaseInsensitiveContains(searchText) ||
            (tool.category ?? "").localizedCaseInsensitiveContains(searchText) ||
            (tool.description ?? "").localizedCaseInsensitiveContains(searchText)
        }
    }

    private var groupedTools: [(String, [OpenWhaleClient.ToolInfo])] {
        let grouped = Dictionary(grouping: filteredTools) { $0.category ?? "Other" }
        return grouped.sorted { $0.key < $1.key }
    }

    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                PageHeader(title: "Tools", subtitle: "\(appState.tools.count) tools available")
                Spacer()
            }
            .padding(.horizontal, 24)
            .padding(.top, 20)
            .padding(.bottom, 12)

            // Search
            HStack(spacing: 8) {
                Image(systemName: "magnifyingglass")
                    .font(.system(size: 13))
                    .foregroundColor(.owTextTertiary)
                ZStack(alignment: .leading) {
                    if searchText.isEmpty {
                        Text("Search tools...")
                            .font(.owBody)
                            .foregroundColor(.white.opacity(0.65))
                    }
                    TextField("", text: $searchText)
                        .textFieldStyle(.plain)
                        .font(.owBody)
                        .foregroundColor(.white)
                }
                if !searchText.isEmpty {
                    Button {
                        searchText = ""
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .font(.system(size: 12))
                            .foregroundColor(.owTextTertiary)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(10)
            .background(Color.owSurface)
            .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 8, style: .continuous)
                    .stroke(Color.owBorder, lineWidth: 1)
            )
            .padding(.horizontal, 24)
            .padding(.bottom, 12)

            Divider().background(Color.owBorder)

            // Tools list
            if appState.tools.isEmpty {
                EmptyStateView(
                    icon: "hammer",
                    title: "No Tools",
                    subtitle: "No tools available"
                )
            } else if filteredTools.isEmpty {
                EmptyStateView(
                    icon: "magnifyingglass",
                    title: "No Results",
                    subtitle: "No tools match \"\(searchText)\""
                )
            } else {
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        ForEach(groupedTools, id: \.0) { category, tools in
                            VStack(alignment: .leading, spacing: 6) {
                                HStack(spacing: 6) {
                                    Text(category.uppercased())
                                        .sectionHeader()
                                    Text("\(tools.count)")
                                        .font(.owCaption)
                                        .foregroundColor(.owTextTertiary)
                                }
                                .padding(.horizontal, 4)

                                VStack(spacing: 4) {
                                    ForEach(tools) { tool in
                                        toolRow(tool)
                                    }
                                }
                            }
                        }
                    }
                    .padding(24)
                }
            }
        }
    }

    private func toolRow(_ tool: OpenWhaleClient.ToolInfo) -> some View {
        HStack(spacing: 10) {
            Image(systemName: "hammer")
                .font(.system(size: 12))
                .foregroundColor(.owTextSecondary)
                .frame(width: 20)

            VStack(alignment: .leading, spacing: 2) {
                Text(tool.name ?? "Unknown")
                    .font(.owBody)
                    .foregroundColor(tool.disabled ?? false ? .owTextTertiary : .owTextPrimary)
                if let desc = tool.description, !desc.isEmpty {
                    Text(desc)
                        .font(.owCaption)
                        .foregroundColor(.owTextTertiary)
                        .lineLimit(1)
                }
            }

            Spacer()

            HStack(spacing: 4) {
                if tool.disabled ?? false {
                    Text("Disabled")
                        .pillBadge(color: .owRed)
                }
                if tool.requiresApproval ?? false {
                    Text("Approval")
                        .pillBadge(color: .owYellow)
                }
                if tool.requiresElevated ?? false {
                    Text("Elevated")
                        .pillBadge(color: .owOrange)
                }
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(Color.owSurface)
        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .stroke(Color.owBorder, lineWidth: 1)
        )
    }
}
