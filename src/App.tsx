import React, { useRef } from 'react'
import { useAppStore } from './store/appStore'
import { PdfViewer } from './components/PdfViewer'
import { SignaturePanel } from './components/SignaturePanel'

export default function App(){
  const fileInput = useRef<HTMLInputElement>(null)
  const { loadFile, clearAll, hasDoc, exportAll, placements } = useAppStore()

  const handleClearAll = () => {
    clearAll()
    // Clear the file input value to allow re-selecting the same file
    if (fileInput.current) {
      fileInput.current.value = ''
    }
  }

  const handlePdfUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return

    // File size validation (max 50MB)
    const MAX_PDF_SIZE = 50 * 1024 * 1024
    if (f.size > MAX_PDF_SIZE) {
      alert('PDF file too large. Maximum size is 50MB.')
      e.target.value = ''
      return
    }

    // File type validation
    if (f.type !== 'application/pdf') {
      alert('Invalid file type. Only PDF files are allowed.')
      e.target.value = ''
      return
    }

    // Basic PDF header validation
    const reader = new FileReader()
    reader.onload = () => {
      const arrayBuffer = reader.result as ArrayBuffer
      const bytes = new Uint8Array(arrayBuffer)
      
      // Check PDF magic number
      if (bytes.length < 4 || 
          bytes[0] !== 0x25 || bytes[1] !== 0x50 || 
          bytes[2] !== 0x44 || bytes[3] !== 0x46) {
        alert('Invalid PDF file format.')
        e.target.value = ''
        return
      }

      loadFile(f)
    }
    reader.onerror = () => {
      alert('Failed to read PDF file. Please try again.')
      e.target.value = ''
    }
    reader.readAsArrayBuffer(f)
  }
  return (
    <div className="app">
      <aside className="sidebar">
        <div className="row">
          <div className="dropzone" onClick={()=>fileInput.current?.click()}>
            <div><strong>Open a PDF</strong></div>
            <div className="hint">Click to choose</div>
          </div>
          <input ref={fileInput} type="file" accept="application/pdf" onChange={handlePdfUpload} />
        </div>
        <div style={{marginTop:12}} className="row">
          <button onClick={handleClearAll}>Clear Session</button>
          <button className="primary" onClick={exportAll} disabled={!hasDoc}>Download Signed PDF</button>
        </div>
        {placements.length > 0 && (
          <div style={{marginTop:8, padding:8, background:'#f9fafb', borderRadius:4, fontSize:12}}>
            <strong>{placements.length}</strong> signature{placements.length !== 1 ? 's' : ''} placed
          </div>
        )}
        <SignaturePanel />
        <div className="hint" style={{marginTop:12}}>
          <p><strong>How to use:</strong></p>
          <p>• Create/select a signature above</p>
          <p>• Tap anywhere on PDF to place it</p>
          <p>• Tap signature to select (red border + blue dot)</p>
          <p>• Drag to move, pinch to resize, or drag blue dot</p>
          <p>• Long press or Delete key to remove</p>
          <p>• Tap empty area to deselect</p>
        </div>
      </aside>
      <main className="viewer">
        <div className="toolbar">
          <strong>PDF Signer — Interactive</strong>
          <span style={{marginLeft:8, color:'#6b7280'}}>local-only</span>
        </div>
        <PdfViewer />
      </main>
    </div>
  )
}