import SwiftUI

// MARK: - Color Palette (matches main app)

extension Color {
    static let owPrimary = Color(hex: "6C5CE7")
    static let owPrimaryHover = Color(hex: "8577ED")
    static let owBackground = Color(hex: "161829")
    static let owSurface = Color(hex: "1E2035")
    static let owSurfaceRaised = Color(hex: "272A40")
    static let owSidebarBg = Color(hex: "131525")
    static let owSurfaceHover = Color(hex: "2D3050")
    static let owTextPrimary = Color(hex: "F0F0F5")
    static let owTextSecondary = Color(hex: "A0A3BD")
    static let owTextTertiary = Color(hex: "6B6F8D")
    static let owGreen = Color(hex: "00D68F")
    static let owRed = Color(hex: "FF6B7A")
    static let owYellow = Color(hex: "FFD93D")
    static let owCyan = Color(hex: "48DBFB")
    static let owBorder = Color.white.opacity(0.06)
    static let owBorderLight = Color.white.opacity(0.10)

    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let r, g, b: UInt64
        switch hex.count {
        case 6: (r, g, b) = ((int >> 16) & 0xFF, (int >> 8) & 0xFF, int & 0xFF)
        default: (r, g, b) = (0, 0, 0)
        }
        self.init(.sRGB, red: Double(r) / 255, green: Double(g) / 255, blue: Double(b) / 255, opacity: 1)
    }
}

extension Font {
    static let owLargeTitle = Font.system(size: 26, weight: .bold, design: .rounded)
    static let owTitle = Font.system(size: 20, weight: .bold, design: .rounded)
    static let owHeadline = Font.system(size: 15, weight: .semibold)
    static let owBody = Font.system(size: 13, weight: .regular)
    static let owBodyMedium = Font.system(size: 13, weight: .medium)
    static let owCaption = Font.system(size: 11, weight: .medium)
}
