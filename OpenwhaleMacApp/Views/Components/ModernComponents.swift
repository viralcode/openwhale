import SwiftUI

// MARK: - Stat Tile (Large, premium style)

struct StatTile: View {
    let icon: String
    let value: String
    let label: String
    var iconColor: Color = .owPrimary
    var trend: String? = nil

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: icon)
                    .font(.system(size: 16, weight: .medium))
                    .foregroundColor(iconColor)
                    .frame(width: 34, height: 34)
                    .background(iconColor.opacity(0.12))
                    .clipShape(RoundedRectangle(cornerRadius: 9, style: .continuous))
                Spacer()
                if let trend = trend {
                    Text(trend)
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundColor(.owGreen)
                }
            }
            VStack(alignment: .leading, spacing: 3) {
                Text(value)
                    .font(.owStatValue)
                    .foregroundColor(.owTextPrimary)
                Text(label)
                    .font(.owCaption)
                    .foregroundColor(.owTextTertiary)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .cardStyle()
    }
}

// MARK: - Status Badge

struct StatusBadge: View {
    let text: String
    let isActive: Bool

    var body: some View {
        HStack(spacing: 6) {
            Circle()
                .fill(isActive ? Color.owGreen : Color.owRed)
                .frame(width: 7, height: 7)
            Text(text)
        }
        .pillBadge(color: isActive ? .owGreen : .owRed)
    }
}

// MARK: - Section Card

struct SectionCard<Content: View>: View {
    let title: String
    var icon: String? = nil
    @ViewBuilder let content: () -> Content

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 8) {
                if let icon = icon {
                    Image(systemName: icon)
                        .font(.system(size: 13, weight: .medium))
                        .foregroundColor(.owPrimary)
                }
                Text(title)
                    .sectionHeader()
            }
            content()
        }
        .cardStyle()
    }
}

// MARK: - Modern Text Field (ZStack overlay for visible white placeholder)

struct ModernTextField: View {
    let placeholder: String
    @Binding var text: String
    var isMonospace: Bool = false

    var body: some View {
        ZStack(alignment: .leading) {
            // White placeholder overlay — always visible when empty
            if text.isEmpty {
                Text(placeholder)
                    .font(isMonospace ? .owMono : .owBody)
                    .foregroundColor(.white.opacity(0.65))
                    .padding(.leading, 12)
            }
            TextField("", text: $text)
                .textFieldStyle(.plain)
                .font(isMonospace ? .owMono : .owBody)
                .foregroundColor(.white)
                .padding(12)
        }
        .background(Color.owSurfaceRaised)
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .stroke(Color.owBorderLight, lineWidth: 1)
        )
    }
}

// MARK: - Modern Secure Field (ZStack overlay for visible white placeholder)

struct ModernSecureField: View {
    let placeholder: String
    @Binding var text: String
    @State private var isRevealed = false

    var body: some View {
        HStack(spacing: 8) {
            ZStack(alignment: .leading) {
                if text.isEmpty {
                    Text(placeholder)
                        .font(.owMono)
                        .foregroundColor(.white.opacity(0.65))
                }
                if isRevealed {
                    TextField("", text: $text)
                        .textFieldStyle(.plain)
                        .font(.owMono)
                        .foregroundColor(.white)
                } else {
                    SecureField("", text: $text)
                        .textFieldStyle(.plain)
                        .font(.owMono)
                        .foregroundColor(.white)
                }
            }
            Button {
                isRevealed.toggle()
            } label: {
                Image(systemName: isRevealed ? "eye.slash" : "eye")
                    .font(.system(size: 13))
                    .foregroundColor(.owTextSecondary)
            }
            .buttonStyle(.plain)
        }
        .padding(12)
        .background(Color.owSurfaceRaised)
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .stroke(Color.owBorderLight, lineWidth: 1)
        )
    }
}

// MARK: - Modern Toggle Row

struct ModernToggleRow: View {
    let label: String
    @Binding var isOn: Bool
    var icon: String? = nil

    var body: some View {
        HStack(spacing: 10) {
            if let icon = icon {
                Image(systemName: icon)
                    .font(.system(size: 13))
                    .foregroundColor(.owPrimary)
                    .frame(width: 22)
            }
            Text(label)
                .font(.owBodyMedium)
                .foregroundColor(.owTextPrimary)
            Spacer()
            Toggle("", isOn: $isOn)
                .toggleStyle(.switch)
                .labelsHidden()
                .tint(.owPrimary)
        }
        .padding(.vertical, 6)
    }
}

// MARK: - Empty State View

struct EmptyStateView: View {
    let icon: String
    let title: String
    var subtitle: String? = nil

    var body: some View {
        VStack(spacing: 14) {
            Image(systemName: icon)
                .font(.system(size: 40, weight: .ultraLight))
                .foregroundColor(.owTextTertiary)
            Text(title)
                .font(.owHeadline)
                .foregroundColor(.owTextSecondary)
            if let subtitle = subtitle {
                Text(subtitle)
                    .font(.owBody)
                    .foregroundColor(.owTextTertiary)
                    .multilineTextAlignment(.center)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(48)
    }
}

// MARK: - Page Header

struct PageHeader: View {
    let title: String
    var subtitle: String? = nil

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(.owLargeTitle)
                .foregroundColor(.owTextPrimary)
            if let subtitle = subtitle {
                Text(subtitle)
                    .font(.owBody)
                    .foregroundColor(.owTextSecondary)
            }
        }
    }
}

// MARK: - Action Button

struct ActionButton: View {
    let title: String
    var icon: String? = nil
    var style: ButtonVariant = .primary
    let action: () -> Void

    enum ButtonVariant {
        case primary, secondary, destructive
    }

    private var bgColor: Color {
        switch style {
        case .primary: return .owPrimary
        case .secondary: return .owSurfaceRaised
        case .destructive: return .owRed
        }
    }

    private var fgColor: Color {
        switch style {
        case .secondary: return .owTextPrimary
        default: return .white
        }
    }

    var body: some View {
        Button(action: action) {
            HStack(spacing: 6) {
                if let icon = icon {
                    Image(systemName: icon)
                        .font(.system(size: 12, weight: .medium))
                }
                Text(title)
                    .font(.system(size: 13, weight: .semibold))
            }
            .foregroundColor(fgColor)
            .padding(.horizontal, 16)
            .padding(.vertical, 8)
            .background(bgColor)
            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Info Row

struct InfoRow: View {
    let label: String
    let value: String
    var valueColor: Color = .owTextPrimary

    var body: some View {
        HStack {
            Text(label)
                .font(.owBody)
                .foregroundColor(.owTextSecondary)
            Spacer()
            Text(value)
                .font(.owBodyMedium)
                .foregroundColor(valueColor)
        }
        .padding(.vertical, 3)
    }
}

// MARK: - Subtle Divider

struct SubtleDivider: View {
    var body: some View {
        Rectangle()
            .fill(Color.owBorder)
            .frame(height: 1)
    }
}

// MARK: - White Text Editor (for TextEditor fields)

struct WhiteTextEditor: View {
    @Binding var text: String
    var placeholder: String = ""
    var font: Font = .owBody
    var minHeight: CGFloat = 80

    var body: some View {
        ZStack(alignment: .topLeading) {
            if text.isEmpty && !placeholder.isEmpty {
                Text(placeholder)
                    .font(font)
                    .foregroundColor(.white.opacity(0.65))
                    .padding(.horizontal, 12)
                    .padding(.vertical, 12)
            }
            TextEditor(text: $text)
                .font(font)
                .foregroundColor(.white)
                .scrollContentBackground(.hidden)
                .frame(minHeight: minHeight)
                .padding(4)
        }
        .background(Color.owSurfaceRaised)
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .stroke(Color.owBorderLight, lineWidth: 1)
        )
    }
}
