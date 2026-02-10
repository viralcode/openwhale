import SwiftUI

// MARK: - Color Palette — Deep Navy, Flat, No Gradients

extension Color {
    // Primary accent
    static let owPrimary = Color(hex: "6C5CE7")          // soft purple
    static let owPrimaryHover = Color(hex: "8577ED")

    // Surfaces — deep navy tones
    static let owBackground = Color(hex: "161829")        // deepest navy
    static let owSurface = Color(hex: "1E2035")           // card surface
    static let owSurfaceRaised = Color(hex: "272A40")     // elevated surface (inputs)
    static let owSidebarBg = Color(hex: "131525")         // top bar / header back
    static let owSurfaceHover = Color(hex: "2D3050")      // hover highlight

    // Text
    static let owTextPrimary = Color(hex: "F0F0F5")       // near-white
    static let owTextSecondary = Color(hex: "A0A3BD")     // muted lavender
    static let owTextTertiary = Color(hex: "6B6F8D")      // dim
    static let owPlaceholder = Color.white                 // always visible

    // Accent colors — warm & vibrant
    static let owGreen = Color(hex: "00D68F")             // teal green
    static let owRed = Color(hex: "FF6B7A")               // coral red
    static let owYellow = Color(hex: "FFD93D")            // warm gold
    static let owOrange = Color(hex: "FF9F43")            // tangerine
    static let owCyan = Color(hex: "48DBFB")              // sky blue
    static let owPurple = Color(hex: "A855F7")            // vivid violet
    static let owPink = Color(hex: "FF6B8A")              // rose

    // Borders
    static let owBorder = Color.white.opacity(0.06)
    static let owBorderLight = Color.white.opacity(0.10)

    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let r, g, b: UInt64
        switch hex.count {
        case 6:
            (r, g, b) = ((int >> 16) & 0xFF, (int >> 8) & 0xFF, int & 0xFF)
        default:
            (r, g, b) = (0, 0, 0)
        }
        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue: Double(b) / 255,
            opacity: 1
        )
    }
}

// MARK: - Typography

extension Font {
    static let owLargeTitle = Font.system(size: 26, weight: .bold, design: .rounded)
    static let owTitle = Font.system(size: 20, weight: .bold, design: .rounded)
    static let owHeadline = Font.system(size: 15, weight: .semibold, design: .default)
    static let owBody = Font.system(size: 13, weight: .regular, design: .default)
    static let owBodyMedium = Font.system(size: 13, weight: .medium, design: .default)
    static let owCaption = Font.system(size: 11, weight: .medium, design: .default)
    static let owMono = Font.system(size: 12, weight: .regular, design: .monospaced)
    static let owMonoSmall = Font.system(size: 11, weight: .regular, design: .monospaced)
    static let owStatValue = Font.system(size: 32, weight: .bold, design: .rounded)
    static let owStatSmall = Font.system(size: 22, weight: .bold, design: .rounded)
}

// MARK: - View Modifiers

struct CardStyle: ViewModifier {
    var padding: CGFloat = 18

    func body(content: Content) -> some View {
        content
            .padding(padding)
            .background(Color.owSurface)
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
    }
}

struct PillBadgeStyle: ViewModifier {
    let color: Color

    func body(content: Content) -> some View {
        content
            .font(.owCaption)
            .foregroundColor(color)
            .padding(.horizontal, 10)
            .padding(.vertical, 4)
            .background(color.opacity(0.12))
            .clipShape(Capsule())
    }
}

struct SectionHeaderStyle: ViewModifier {
    func body(content: Content) -> some View {
        content
            .font(.system(size: 11, weight: .semibold))
            .textCase(.uppercase)
            .foregroundColor(.owTextTertiary)
            .tracking(1.0)
    }
}

struct InputFieldStyle: ViewModifier {
    func body(content: Content) -> some View {
        content
            .font(.owBody)
            .foregroundColor(.owTextPrimary)
            .padding(12)
            .background(Color.owSurfaceRaised)
            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .stroke(Color.owBorderLight, lineWidth: 1)
            )
    }
}

extension View {
    func cardStyle(padding: CGFloat = 18) -> some View {
        modifier(CardStyle(padding: padding))
    }

    func pillBadge(color: Color) -> some View {
        modifier(PillBadgeStyle(color: color))
    }

    func sectionHeader() -> some View {
        modifier(SectionHeaderStyle())
    }

    func inputField() -> some View {
        modifier(InputFieldStyle())
    }
}
