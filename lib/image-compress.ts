import sharp from "sharp"

/**
 * Lossless/high-quality image compression helper using Sharp.
 * Reduces image file size before saving to disk.
 */
export async function compressImage(
  buffer: Buffer,
  originalFilename?: string
): Promise<{ compressedBuffer: Buffer; ext: string; originalSize: number; compressedSize: number; savingsPercent: number }> {
  const originalSize = buffer.length
  let compressedBuffer = buffer
  let ext = originalFilename ? originalFilename.slice(originalFilename.lastIndexOf(".")) || ".png" : ".png"

  try {
    const metadata = await sharp(buffer).metadata()
    const format = metadata.format

    if (format === "png") {
      compressedBuffer = await sharp(buffer)
        .png({ compressionLevel: 9, effort: 7 })
        .toBuffer()
      ext = ".png"
    } else if (format === "webp") {
      compressedBuffer = await sharp(buffer)
        .webp({ lossless: true, effort: 6 })
        .toBuffer()
      ext = ".webp"
    } else if (format === "jpeg") {
      compressedBuffer = await sharp(buffer)
        .jpeg({ quality: 85, progressive: true, mozjpeg: true })
        .toBuffer()
      ext = ".jpg"
    } else if (format === "gif") {
      compressedBuffer = await sharp(buffer, { animated: true })
        .gif()
        .toBuffer()
      ext = ".gif"
    } else {
      compressedBuffer = await sharp(buffer)
        .png({ compressionLevel: 9 })
        .toBuffer()
      ext = ".png"
    }
  } catch (err) {
    console.error("Error compressing image with sharp, saving original:", err)
  }

  const compressedSize = compressedBuffer.length
  const savingsBytes = originalSize - compressedSize
  const savingsPercent = originalSize > 0 ? Math.round((savingsBytes / originalSize) * 1000) / 10 : 0

  const nameLabel = originalFilename || "Uploaded Image"
  const origKb = (originalSize / 1024).toFixed(1)
  const compKb = (compressedSize / 1024).toFixed(1)

  console.log(
    `📷 [Sharp Compression] ${nameLabel}: ${origKb} KB ➔ ${compKb} KB (${savingsPercent > 0 ? `${savingsPercent}% smaller` : "No size reduction"})`
  )

  return { compressedBuffer, ext, originalSize, compressedSize, savingsPercent }
}
