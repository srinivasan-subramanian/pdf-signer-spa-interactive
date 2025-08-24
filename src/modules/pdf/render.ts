import * as pdfjsLib from 'pdfjs-dist'
import 'pdfjs-dist/build/pdf.worker.mjs'

type Size = { width: number, height: number }

export async function renderPdfToCanvases(file: File): Promise<{canvases: HTMLCanvasElement[], sizes: Size[]}> {
  const data = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data }).promise
  const canvases: HTMLCanvasElement[] = []
  const sizes: Size[] = []
  for (let i=1; i<=pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const viewport = page.getViewport({ scale: 1.5 })
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!
    canvas.width = viewport.width
    canvas.height = viewport.height
    // @ts-ignore
    await page.render({ canvasContext: ctx, viewport }).promise
    canvases.push(canvas)
    sizes.push({ width: viewport.width, height: viewport.height })
  }
  return { canvases, sizes }
}