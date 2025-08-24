import React, { useEffect, useRef, useState } from 'react'
import SignaturePad from 'signature_pad'
import { useAppStore } from '../store/appStore'

export const SignaturePanel: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [mode, setMode] = useState<'draw'|'type'|'upload'>('draw')
  const [typed, setTyped] = useState('')
  const padRef = useRef<SignaturePad | null>(null)
  const { setCurrentSignature, currentSignature, clearAllPlacements } = useAppStore()

  // Handle real-time input filtering
  const handleTypedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value
    // Apply basic filtering in real-time (more comprehensive sanitization happens on submit)
    const filtered = rawValue
      .replace(/[<>\"'&`]/g, '') // Remove dangerous characters immediately
      .replace(/javascript:/gi, '') // Remove javascript protocol
      .replace(/[^\w\s\.\-']/g, '') // Only allow word characters, spaces, dots, hyphens, apostrophes
      .substring(0, 50) // Enforce length limit
    
    setTyped(filtered)
  }

  useEffect(()=>{
    if (mode !== 'draw') return
    const c = canvasRef.current; if (!c) return
    
    // Mobile-optimized signature pad configuration
    const isMobile = window.innerWidth <= 768
    const padOptions = {
      penColor: '#111827',
      minWidth: isMobile ? 2 : 1,
      maxWidth: isMobile ? 4 : 2.5,
      throttle: isMobile ? 16 : 0, // Throttle for better performance on mobile
      minDistance: isMobile ? 5 : 2,
      velocityFilterWeight: isMobile ? 0.7 : 0.7,
      dotSize: 0 // Disable dots for smoother lines
    }
    
    const pad = new SignaturePad(c, padOptions)
    padRef.current = pad
    const ratio = Math.max(window.devicePixelRatio || 1, 1)
    
    // Responsive canvas sizing
    const canvasWidth = Math.min(320, window.innerWidth - 40)
    const canvasHeight = 140
    
    c.width = canvasWidth * ratio
    c.height = canvasHeight * ratio
    c.getContext('2d')!.scale(ratio, ratio)
    c.style.width = canvasWidth + 'px'
    c.style.height = canvasHeight + 'px'
    
    // Prevent scrolling when touching the canvas
    c.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false })
    c.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false })
    
    return ()=> {
      pad.off()
      c.removeEventListener('touchstart', (e) => e.preventDefault())
      c.removeEventListener('touchmove', (e) => e.preventDefault())
    }
  }, [mode])

  const useThis = () => {
    if (mode === 'draw') {
      const pad = padRef.current
      if (!pad || pad.isEmpty()) {
        alert('Please draw your signature first')
        return
      }
      const url = pad.toDataURL('image/png')
      setCurrentSignature(url)
    } else if (mode === 'type') {
      const sanitizedText = sanitizeInput(typed.trim())
      if (!sanitizedText) {
        alert('Please enter your name first')
        return
      }
      if (sanitizedText.length > 50) {
        alert('Name is too long. Maximum 50 characters allowed.')
        return
      }
      
      // Additional validation: ensure only printable ASCII characters for canvas rendering
      const finalText = sanitizedText.replace(/[^\x20-\x7E]/g, '')
      if (!finalText) {
        alert('Please enter a valid name using standard characters')
        return
      }
      
      try {
        const c = document.createElement('canvas')
        const w = 320, h = 140
        c.width = w; c.height = h
        const ctx = c.getContext('2d')!
        
        // Clear canvas with transparent background
        ctx.fillStyle = 'rgba(255,255,255,0)'
        ctx.fillRect(0, 0, w, h)
        
        // Set text properties securely
        ctx.fillStyle = '#111827'
        ctx.font = '32px "Segoe Script", "Brush Script MT", cursive'
        ctx.textBaseline = 'middle'
        
        // Render text safely (canvas API automatically escapes content)
        ctx.fillText(finalText, 16, h/2)
        
        const url = c.toDataURL('image/png')
        setCurrentSignature(url)
      } catch (error) {
        alert('Failed to create signature. Please try again.')
        console.error('Canvas rendering error:', error)
      }
    }
  }

  // Comprehensive input sanitization to prevent XSS and script injection
  const sanitizeInput = (input: string): string => {
    // First, decode any HTML entities to prevent bypassing
    const decoded = decodeHtmlEntities(input)
    
    // Remove all HTML tags, scripts, and potentially dangerous content
    let sanitized = decoded
      .replace(/<[^>]*>/g, '') // Remove all HTML tags
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/data:/gi, '') // Remove data: protocol
      .replace(/vbscript:/gi, '') // Remove vbscript: protocol
      .replace(/on\w+\s*=/gi, '') // Remove event handlers (onclick, onload, etc.)
      .replace(/expression\s*\(/gi, '') // Remove CSS expressions
      .replace(/url\s*\(/gi, '') // Remove CSS url() functions
      .replace(/[<>\"'&`]/g, '') // Remove dangerous HTML characters
      .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim()
    
    // Only allow safe characters: letters, numbers, spaces, and basic punctuation
    sanitized = sanitized.replace(/[^a-zA-Z0-9\s\.\-']/g, '')
    
    return sanitized
  }

  // Helper function to decode HTML entities
  const decodeHtmlEntities = (text: string): string => {
    const textarea = document.createElement('textarea')
    textarea.innerHTML = text
    return textarea.value
  }

  const onUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return

    // File size validation (max 5MB)
    const MAX_FILE_SIZE = 5 * 1024 * 1024
    if (f.size > MAX_FILE_SIZE) {
      alert('File too large. Maximum size is 5MB.')
      e.target.value = ''
      return
    }

    // File type validation
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
    if (!validTypes.includes(f.type)) {
      alert('Invalid file type. Only PNG, JPEG, and WebP images are allowed.')
      e.target.value = ''
      return
    }

    const r = new FileReader()
    r.onload = () => {
      const result = r.result as string
      if (isValidDataURL(result)) {
        setCurrentSignature(result)
      } else {
        alert('Invalid image file. Please try a different image.')
        e.target.value = ''
      }
    }
    r.onerror = () => {
      alert('Failed to read image file. Please try again.')
      e.target.value = ''
    }
    r.readAsDataURL(f)
  }

  // Validate data URL format
  const isValidDataURL = (dataUrl: string): boolean => {
    return /^data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=]+$/.test(dataUrl)
  }

  return (
    <div style={{marginTop:16}}>
      <div>
        <label><input type="radio" checked={mode==='draw'} onChange={()=>setMode('draw')} /> Draw</label>
        <label style={{marginLeft:12}}><input type="radio" checked={mode==='type'} onChange={()=>setMode('type')} /> Type</label>
        <label style={{marginLeft:12}}><input type="radio" checked={mode==='upload'} onChange={()=>setMode('upload')} /> Upload</label>
      </div>
      {currentSignature && (
        <div style={{marginTop:8, padding:8, background:'#f0f9ff', borderRadius:4, fontSize:12, color:'#0369a1', display:'flex', alignItems:'center', justifyContent:'space-between'}}>
          <span>✓ Signature ready! Click on the PDF to place it.</span>
          <button style={{fontSize:10, padding:'2px 6px'}} onClick={() => clearAllPlacements()}>Clear</button>
        </div>
      )}
      {mode==='draw' && (
        <div>
          <canvas ref={canvasRef} style={{border:'1px solid #e5e7eb', borderRadius:8}}/>
          <div style={{display:'flex', gap:8, marginTop:8}}>
            <button onClick={()=>padRef.current?.clear()}>Clear</button>
            <button className="primary" onClick={useThis}>Use This</button>
          </div>
        </div>
      )}
      {mode==='type' && (
        <div style={{display:'flex', gap:8, marginTop:8}}>
          <input 
            placeholder="Type your name" 
            value={typed} 
            onChange={handleTypedChange}
            onPaste={(e) => {
              // Prevent pasting of potentially malicious content
              e.preventDefault()
              const pastedText = e.clipboardData.getData('text')
              const sanitized = sanitizeInput(pastedText)
              setTyped(sanitized.substring(0, 50))
            }}
            maxLength={50}
            pattern="[A-Za-z0-9\s\.\-']+"
            title="Only letters, numbers, spaces, periods, hyphens, and apostrophes allowed"
            autoComplete="off"
            spellCheck="false"
          />
          <button className="primary" onClick={useThis}>Use This</button>
        </div>
      )}
      {mode==='upload' && (
        <div style={{marginTop:8}}>
          <input type="file" accept="image/*" onChange={onUpload} />
        </div>
      )}
    </div>
  )
}