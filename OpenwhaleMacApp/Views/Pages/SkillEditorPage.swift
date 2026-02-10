import SwiftUI

struct SkillEditorPage: View {
    @EnvironmentObject var appState: AppState
    @State private var selectedSkill: OpenWhaleClient.MdSkillInfo? = nil
    @State private var editorContent = ""
    @State private var fileTree: [OpenWhaleClient.FileNode] = []
    @State private var selectedFilePath: String? = nil
    @State private var isSaving = false
    @State private var showCreateSkill = false
    @State private var newSkillName = ""
    @State private var newSkillDesc = ""

    var body: some View {
        HSplitView {
            // Left: skill list + file tree
            VStack(spacing: 0) {
                // Header
                HStack {
                    Text("SKILLS")
                        .sectionHeader()
                    Spacer()
                    Button {
                        showCreateSkill.toggle()
                    } label: {
                        Image(systemName: "plus")
                            .font(.system(size: 12, weight: .medium))
                            .foregroundColor(.owPrimary)
                    }
                    .buttonStyle(.plain)
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 10)

                Divider().background(Color.owBorder)

                // Create skill form
                if showCreateSkill {
                    VStack(spacing: 8) {
                        ModernTextField(placeholder: "Skill name", text: $newSkillName)
                        ModernTextField(placeholder: "Description", text: $newSkillDesc)
                        HStack {
                            ActionButton(title: "Cancel", style: .secondary) {
                                showCreateSkill = false
                                newSkillName = ""
                                newSkillDesc = ""
                            }
                            ActionButton(title: "Create", icon: "plus") {
                                Task {
                                    let _ = await appState.client.createMdSkill(name: newSkillName, description: newSkillDesc)
                                    if let ms = await appState.client.getMdSkills() {
                                        appState.mdSkills = ms
                                    }
                                    showCreateSkill = false
                                    newSkillName = ""
                                    newSkillDesc = ""
                                }
                            }
                        }
                    }
                    .padding(10)
                    .background(Color.owSurface)

                    Divider().background(Color.owBorder)
                }

                ScrollView {
                    VStack(alignment: .leading, spacing: 2) {
                        ForEach(appState.mdSkills) { skill in
                            Button {
                                selectedSkill = skill
                                loadSkillTree(skill)
                            } label: {
                                HStack(spacing: 8) {
                                    Image(systemName: "doc.text")
                                        .font(.system(size: 12))
                                        .foregroundColor(selectedSkill?.id == skill.id ? .owPrimary : .owTextSecondary)
                                    VStack(alignment: .leading, spacing: 1) {
                                        Text(skill.name ?? "Untitled")
                                            .font(.owBody)
                                            .foregroundColor(selectedSkill?.id == skill.id ? .owTextPrimary : .owTextSecondary)
                                        if let desc = skill.description, !desc.isEmpty {
                                            Text(desc)
                                                .font(.owCaption)
                                                .foregroundColor(.owTextTertiary)
                                                .lineLimit(1)
                                        }
                                    }
                                    Spacer()
                                }
                                .padding(.horizontal, 14)
                                .padding(.vertical, 6)
                                .background(selectedSkill?.id == skill.id ? Color.owPrimary.opacity(0.1) : Color.clear)
                                .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
                            }
                            .buttonStyle(.plain)
                            .padding(.horizontal, 6)
                        }

                        // File tree
                        if !fileTree.isEmpty {
                            Divider().background(Color.owBorder).padding(.vertical, 6)
                            Text("FILES")
                                .sectionHeader()
                                .padding(.horizontal, 14)
                                .padding(.bottom, 4)
                            ForEach(fileTree) { node in
                                fileTreeRow(node, depth: 0)
                            }
                        }
                    }
                    .padding(.vertical, 8)
                }
            }
            .frame(minWidth: 200, idealWidth: 240, maxWidth: 280)
            .background(Color.owSidebarBg)

            // Right: editor
            VStack(spacing: 0) {
                if let path = selectedFilePath {
                    HStack {
                        Text(URL(fileURLWithPath: path).lastPathComponent)
                            .font(.owHeadline)
                            .foregroundColor(.owTextPrimary)
                        Spacer()
                        if isSaving {
                            ProgressView()
                                .scaleEffect(0.6)
                        }
                        ActionButton(title: "Save", icon: "square.and.arrow.down") {
                            Task {
                                isSaving = true
                                let _ = await appState.client.saveMdSkillContent(path: path, content: editorContent)
                                isSaving = false
                            }
                        }
                    }
                    .padding(.horizontal, 20)
                    .padding(.vertical, 12)

                    Divider().background(Color.owBorder)

                    WhiteTextEditor(text: $editorContent, placeholder: "Edit skill file...", font: .owMono, minHeight: 200)

                } else {
                    EmptyStateView(
                        icon: "doc.text",
                        title: "Select a Skill",
                        subtitle: "Choose a skill from the sidebar to edit"
                    )
                }
            }
            .background(Color.owBackground)
        }
    }

    @ViewBuilder
    private func fileTreeRow(_ node: OpenWhaleClient.FileNode, depth: Int) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Button {
                if node.type == "file", let path = node.path {
                    selectedFilePath = path
                    loadFileContent(path)
                }
            } label: {
                HStack(spacing: 6) {
                    Image(systemName: node.type == "directory" ? "folder.fill" : "doc.fill")
                        .font(.system(size: 11))
                        .foregroundColor(node.type == "directory" ? .owYellow : .owTextSecondary)
                    Text(node.name ?? "")
                        .font(.owBody)
                        .foregroundColor(selectedFilePath == node.path ? .owPrimary : .owTextPrimary)
                    Spacer()
                }
                .padding(.leading, CGFloat(depth * 16) + 14)
                .padding(.vertical, 4)
                .padding(.trailing, 14)
                .background(selectedFilePath == node.path ? Color.owPrimary.opacity(0.1) : Color.clear)
            }
            .buttonStyle(.plain)

            if let children = node.children {
                ForEach(children) { child in
                    AnyView(fileTreeRow(child, depth: depth + 1))
                }
            }
        }
    }

    private func loadSkillTree(_ skill: OpenWhaleClient.MdSkillInfo) {
        guard let path = skill.path else { return }
        // Load SKILL.md content
        selectedFilePath = path
        loadFileContent(path)
        // Load tree
        let dir = URL(fileURLWithPath: path).deletingLastPathComponent().path
        Task {
            if let tree = await appState.client.getMdSkillTree(dir: dir) {
                fileTree = tree
            }
        }
    }

    private func loadFileContent(_ path: String) {
        Task {
            if let content = await appState.client.getMdSkillContent(path: path) {
                editorContent = content
            }
        }
    }
}
