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
  try {
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
    
    // Convert from percentage coordinates to PDF coordinates
    const pdfX = (p.rect.x / 100) * pageWidth
    const pdfY = pageHeight - ((p.rect.y + p.rect.h) / 100) * pageHeight  // PDF has bottom-left origin
    const pdfW = (p.rect.w / 100) * pageWidth
    const pdfH = (p.rect.h / 100) * pageHeight
    
    console.log(`PDF Export Debug:`)
    console.log(`  Page: ${pageWidth.toFixed(1)}x${pageHeight.toFixed(1)}`)
    console.log(`  Percent: (${p.rect.x.toFixed(1)}%, ${p.rect.y.toFixed(1)}%, ${p.rect.w.toFixed(1)}%, ${p.rect.h.toFixed(1)}%)`)
    console.log(`  PDF coords: (${pdfX.toFixed(1)}, ${pdfY.toFixed(1)}, ${pdfW.toFixed(1)}, ${pdfH.toFixed(1)})`)
    
    page.drawImage(img, { 
      x: pdfX, 
      y: pdfY, 
      width: pdfW, 
      height: pdfH 
    })
  }

  const out = await pdfDoc.save()
  const arrayBuffer = new Uint8Array(out).buffer
  const blob = new Blob([arrayBuffer], { type: 'application/pdf' })
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
  } catch (error) {
    console.error('PDF export error:', error)
    throw new Error('Failed to export PDF. The file may be corrupted or incompatible.')
  }
}