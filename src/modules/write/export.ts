import { PDFDocument } from 'pdf-lib'
import { Placement } from '../../store/appStore'

// Utility function to sanitize filenames
const sanitizeFilename = (filename: string): string => {
  // Remove potentially dangerous characters and limit length
  return filename
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_') // Remove invalid filename characters
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .replace(/_{2,}/g, '_') // Replace multiple underscores with single
    .replace(/^_+|_+$/g, '') // Remove leading/trailing underscores
    .substring(0, 100) // Limit length to 100 characters
    || 'document' // Fallback if empty
}

export async function exportSignedPdf(file: File, placements: Placement[]) {
  const bytes = new Uint8Array(await file.arrayBuffer())
  const pdfDoc = await PDFDocument.load(bytes)

  // Embed each signature image at its page/rect
  const cache = new Map<string, any>()
  for (const p of placements) {
    const page = pdfDoc.getPages()[p.pageIndex]
    const { width: pageWidth, height: pageHeight } = page.getSize()
    
    let img = cache.get(p.imageDataUrl)
    if (!img) {
      try {
        // Try PNG first, then fall back to JPEG
        img = await pdfDoc.embedPng(p.imageDataUrl)
      } catch {
        img = await pdfDoc.embedJpg(p.imageDataUrl)
      }
      cache.set(p.imageDataUrl, img)
    }
    
    // Convert from canvas coordinates (scaled 1.5x, top-left origin) to PDF coordinates (1x scale, bottom-left origin)
    const scale = 1.5
    const pdfX = p.rect.x / scale
    const pdfY = pageHeight - (p.rect.y + p.rect.h) / scale
    const pdfW = p.rect.w / scale
    const pdfH = p.rect.h / scale
    
    page.drawImage(img, { 
      x: pdfX, 
      y: pdfY, 
      width: pdfW, 
      height: pdfH 
    })
  }

  const out = await pdfDoc.save()
  const blob = new Blob([out], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  
  // Sanitize the original filename and create secure download name
  const originalName = file.name.replace(/\.pdf$/i, '') || 'document'
  const sanitizedName = sanitizeFilename(originalName)
  a.download = `${sanitizedName}-signed.pdf`
  
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}