import { create } from 'zustand'
import { exportSignedPdf } from '../modules/write/export'

// Utility function to validate data URLs
const isValidDataURL = (dataUrl: string): boolean => {
  return /^data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=]+$/.test(dataUrl)
}

export type Size = { width:number, height:number }
export type Rect = { x:number, y:number, w:number, h:number }
export type PercentRect = { x:number, y:number, w:number, h:number } // All values as percentages (0-100)
export type Placement = { id:string, pageIndex:number, rect:PercentRect, imageDataUrl:string }

type S = {
  pdfFile: File | null
  pages: HTMLCanvasElement[]
  pageSizes: Size[]
  placements: Placement[]
  currentSignature: string | null
  hasDoc: boolean

  loadFile: (f: File) => void
  clearAll: () => void
  setPages: (canvases: HTMLCanvasElement[], sizes: Size[]) => void
  setPageSizes: (sizes: Size[]) => void
  setCurrentSignature: (dataUrl: string | null) => void
  addPlacement: (pageIndex:number, rect:PercentRect, imageDataUrl:string) => void
  updatePlacement: (id:string, rect:PercentRect) => void
  removePlacement: (id:string) => void
  clearAllPlacements: () => void
  exportAll: () => void
}

export const useAppStore = create<S>((set, get)=> ({
  pdfFile: null,
  pages: [],
  pageSizes: [],
  placements: [],
  currentSignature: null,
  hasDoc: false,

  loadFile: (f) => set({ pdfFile: f, hasDoc: true, pages: [], pageSizes: [], placements: [] }),
  clearAll: () => set({ pdfFile: null, hasDoc: false, pages: [], pageSizes: [], placements: [], currentSignature: null }),
  setPages: (canvases, sizes) => set({ pages: canvases, pageSizes: sizes }),
  setPageSizes: (sizes) => set({ pageSizes: sizes }),
  setCurrentSignature: (d) => {
    // Validate data URL before setting
    if (d && !isValidDataURL(d)) {
      console.error('Invalid data URL format')
      return
    }
    set({ currentSignature: d })
  },
  addPlacement: (pageIndex, rect, imageDataUrl) => set((s)=> {
    // Validate inputs
    if (!isValidDataURL(imageDataUrl)) {
      console.error('Invalid image data URL')
      return s
    }
    if (pageIndex < 0 || !Number.isInteger(pageIndex)) {
      console.error('Invalid page index')
      return s
    }
    if (rect.w <= 0 || rect.h <= 0 || rect.x < 0 || rect.y < 0 || rect.x > 100 || rect.y > 100 || rect.w > 100 || rect.h > 100) {
      console.error('Invalid percentage rectangle dimensions (should be 0-100)')
      return s
    }

    const newPlacement = { id: crypto.randomUUID(), pageIndex, rect, imageDataUrl }
    return { placements: [...s.placements, newPlacement] }
  }),
  updatePlacement: (id, rect) => set((s)=> ({ placements: s.placements.map(p => p.id === id ? { ...p, rect } : p) })),
  removePlacement: (id) => set((s)=> ({ placements: s.placements.filter(p => p.id !== id) })),
  clearAllPlacements: () => set({ placements: [], currentSignature: null }),

  exportAll: async () => {
    const { pdfFile, placements } = get()
    if (!pdfFile) {
      alert('Please load a PDF file first')
      return
    }
    if (placements.length === 0) {
      alert('Please add at least one signature to the PDF')
      return
    }
    try {
      await exportSignedPdf(pdfFile, placements)
    } catch (error) {
      console.error('Export failed:', error)
      alert('Failed to export PDF. Please try again.')
    }
  }
}))