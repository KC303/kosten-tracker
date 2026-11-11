// Zeichnet das App-Symbol (weißes Euro-Zeichen auf violettem Verlauf) in den nötigen Größen.
// Aufruf: swift werkzeuge/icon.swift icons
import AppKit

let ziel = CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : "icons"

func zeichne(_ kante: Int) -> Data {
    let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: kante, pixelsHigh: kante,
                               bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false,
                               colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
    rep.size = NSSize(width: kante, height: kante)
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
    let s = CGFloat(kante)
    let verlauf = NSGradient(starting: NSColor(srgbRed: 0.33, green: 0.26, blue: 0.78, alpha: 1),
                             ending: NSColor(srgbRed: 0.47, green: 0.36, blue: 0.92, alpha: 1))!
    verlauf.draw(in: NSRect(x: 0, y: 0, width: s, height: s), angle: 45)
    let schrift = NSFont.systemFont(ofSize: s * 0.56, weight: .semibold)
    let text = NSAttributedString(string: "€", attributes: [.font: schrift, .foregroundColor: NSColor.white])
    let groesse = text.size()
    text.draw(at: NSPoint(x: (s - groesse.width) / 2 - s * 0.015, y: (s - groesse.height) / 2 + s * 0.01))
    NSGraphicsContext.restoreGraphicsState()
    return rep.representation(using: .png, properties: [:])!
}

for kante in [180, 192, 512] {
    let pfad = "\(ziel)/icon-\(kante).png"
    try! zeichne(kante).write(to: URL(fileURLWithPath: pfad))
    print(pfad)
}
