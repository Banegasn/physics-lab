import CoreGraphics
import Foundation
import ImageIO
import UniformTypeIdentifiers

struct IconTarget {
  let filename: String
  let size: Int
}

let targets = [
  IconTarget(filename: "favicon-32.png", size: 32),
  IconTarget(filename: "apple-touch-icon.png", size: 180),
  IconTarget(filename: "icon-192.png", size: 192),
  IconTarget(filename: "icon-512.png", size: 512),
]

let outputDirectory = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
  .appendingPathComponent("public", isDirectory: true)

func drawIcon(size: Int) throws -> CGImage {
  let colorSpace = CGColorSpaceCreateDeviceRGB()
  guard
    let context = CGContext(
      data: nil,
      width: size,
      height: size,
      bitsPerComponent: 8,
      bytesPerRow: 0,
      space: colorSpace,
      bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
    )
  else {
    throw CocoaError(.fileWriteUnknown)
  }

  let edge = CGFloat(size)
  context.setAllowsAntialiasing(true)
  context.setShouldAntialias(true)
  context.setFillColor(CGColor(red: 10 / 255, green: 13 / 255, blue: 28 / 255, alpha: 1))
  context.fill(CGRect(x: 0, y: 0, width: edge, height: edge))

  let inset = edge * 0.105
  let tile = CGRect(x: inset, y: inset, width: edge - 2 * inset, height: edge - 2 * inset)
  context.addPath(
    CGPath(
      roundedRect: tile,
      cornerWidth: edge * 0.19,
      cornerHeight: edge * 0.19,
      transform: nil
    )
  )
  context.setFillColor(CGColor(red: 111 / 255, green: 231 / 255, blue: 195 / 255, alpha: 1))
  context.fillPath()

  context.setStrokeColor(CGColor(red: 10 / 255, green: 13 / 255, blue: 28 / 255, alpha: 1))
  context.setLineWidth(edge * 0.09)
  context.setLineCap(.round)
  context.setLineJoin(.round)

  context.move(to: CGPoint(x: edge * 0.37, y: edge * 0.27))
  context.addLine(to: CGPoint(x: edge * 0.37, y: edge * 0.73))
  context.strokePath()

  context.move(to: CGPoint(x: edge * 0.39, y: edge * 0.5))
  context.addLine(to: CGPoint(x: edge * 0.66, y: edge * 0.72))
  context.strokePath()

  context.move(to: CGPoint(x: edge * 0.39, y: edge * 0.5))
  context.addLine(to: CGPoint(x: edge * 0.68, y: edge * 0.27))
  context.strokePath()

  guard let image = context.makeImage() else {
    throw CocoaError(.fileWriteUnknown)
  }
  return image
}

for target in targets {
  let output = outputDirectory.appendingPathComponent(target.filename)
  guard
    let destination = CGImageDestinationCreateWithURL(
      output as CFURL,
      UTType.png.identifier as CFString,
      1,
      nil
    )
  else {
    throw CocoaError(.fileWriteUnknown)
  }

  CGImageDestinationAddImage(destination, try drawIcon(size: target.size), nil)
  guard CGImageDestinationFinalize(destination) else {
    throw CocoaError(.fileWriteUnknown)
  }
}
