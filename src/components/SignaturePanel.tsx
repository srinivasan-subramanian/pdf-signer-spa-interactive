import React, { useEffect, useRef, useState } from 'react'
import SignaturePad from 'signature_pad'
import { useAppStore } from '../store/appStore'

export const SignaturePanel: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [mode, setMode] = useState<'draw'|'type'|'upload'>('draw')
  const [typed, setTyped] = useState('')
  const [removeBackground, setRemoveBackground] = useState(true)
  const [backgroundThreshold, setBackgroundThreshold] = useState(230)
  const [originalImageData, setOriginalImageData] = useState<string | null>(null)
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

  // Helper function to safely decode HTML entities without XSS risk
  const decodeHtmlEntities = (text: string): string => {
    // Use DOMParser for safe HTML entity decoding without script execution
    const parser = new DOMParser()
    const doc = parser.parseFromString(`<!doctype html><body>${text}`, 'text/html')
    return doc.body.textContent || ''
  }

  // Simple but effective background removal
  const processBackground = (imageDataUrl: string, shouldRemove: boolean, threshold: number): Promise<string> => {
    if (!shouldRemove) {
      return Promise.resolve(imageDataUrl)
    }
    
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')!
        
        canvas.width = img.width
        canvas.height = img.height
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(img, 0, 0)
        
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const data = imageData.data
        
        // Analyze the image to find the most common background color
        const colorHistogram = new Map<string, number>()
        const width = canvas.width
        const height = canvas.height
        
        // Sample edge pixels to determine background color
        const edgePixels: Array<{r: number, g: number, b: number}> = []
        
        // Top and bottom edges
        for (let x = 0; x < width; x += 4) {
          const topIdx = x * 4
          const bottomIdx = ((height - 1) * width + x) * 4
          edgePixels.push({r: data[topIdx], g: data[topIdx + 1], b: data[topIdx + 2]})
          edgePixels.push({r: data[bottomIdx], g: data[bottomIdx + 1], b: data[bottomIdx + 2]})
        }
        
        // Left and right edges
        for (let y = 0; y < height; y += 4) {
          const leftIdx = (y * width) * 4
          const rightIdx = (y * width + width - 1) * 4
          edgePixels.push({r: data[leftIdx], g: data[leftIdx + 1], b: data[leftIdx + 2]})
          edgePixels.push({r: data[rightIdx], g: data[rightIdx + 1], b: data[rightIdx + 2]})
        }
        
        // Find the most common background color from edge samples
        let dominantBgColor = {r: 255, g: 255, b: 255} // Default to white
        if (edgePixels.length > 0) {
          const avgColor = edgePixels.reduce(
            (acc, pixel) => ({
              r: acc.r + pixel.r,
              g: acc.g + pixel.g,
              b: acc.b + pixel.b
            }),
            {r: 0, g: 0, b: 0}
          )
          dominantBgColor = {
            r: Math.round(avgColor.r / edgePixels.length),
            g: Math.round(avgColor.g / edgePixels.length),
            b: Math.round(avgColor.b / edgePixels.length)
          }
        }
        
        console.log('Detected background color:', dominantBgColor)
        
        // Method 1: Remove pixels similar to detected background color
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i]
          const g = data[i + 1] 
          const b = data[i + 2]
          
          const colorDistance = Math.sqrt(
            (r - dominantBgColor.r) ** 2 + 
            (g - dominantBgColor.g) ** 2 + 
            (b - dominantBgColor.b) ** 2
          )
          
          const maxDistance = (255 - threshold) * 2
          if (colorDistance < maxDistance) {
            data[i + 3] = 0
          }
        }
        
        // Method 2: Brightness-based removal with adaptive threshold
        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] === 0) continue // Skip already transparent
          
          const r = data[i]
          const g = data[i + 1]
          const b = data[i + 2]
          
          const brightness = 0.299 * r + 0.587 * g + 0.114 * b
          const bgBrightness = 0.299 * dominantBgColor.r + 0.587 * dominantBgColor.g + 0.114 * dominantBgColor.b
          
          // Use adaptive threshold based on background brightness
          const adaptiveThreshold = Math.max(threshold, bgBrightness - 20)
          
          if (brightness > adaptiveThreshold) {
            const isNeutral = Math.abs(r - g) < 40 && Math.abs(g - b) < 40 && Math.abs(r - b) < 40
            if (isNeutral) {
              data[i + 3] = 0
            }
          }
        }
        
        // Method 3: Edge-aware processing
        for (let y = 1; y < height - 1; y++) {
          for (let x = 1; x < width - 1; x++) {
            const idx = (y * width + x) * 4
            
            if (data[idx + 3] === 0) continue // Skip already transparent
            
            const r = data[idx]
            const g = data[idx + 1]
            const b = data[idx + 2]
            const brightness = 0.299 * r + 0.587 * g + 0.114 * b
            
            if (brightness > threshold - 20) {
              // Check surrounding pixels
              let darkNeighbors = 0
              for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                  if (dx === 0 && dy === 0) continue
                  const nIdx = ((y + dy) * width + (x + dx)) * 4
                  const nBrightness = 0.299 * data[nIdx] + 0.587 * data[nIdx + 1] + 0.114 * data[nIdx + 2]
                  if (nBrightness < threshold - 50) darkNeighbors++
                }
              }
              
              // If mostly surrounded by dark pixels, keep it (likely signature content)
              // If surrounded by light pixels, make it transparent (likely background)
              if (darkNeighbors < 2) {
                data[idx + 3] = 0
              } else if (darkNeighbors < 4) {
                // Partial transparency for edges
                data[idx + 3] = Math.max(100, data[idx + 3] - 50)
              }
            }
          }
        }
        
        ctx.putImageData(imageData, 0, 0)
        resolve(canvas.toDataURL('image/png', 1.0))
      }
      img.onerror = () => reject(new Error('Failed to load image'))
      img.src = imageDataUrl
    })
  }
  
  // Legacy flood fill method as backup
  const advancedRemoveBackground = (imageDataUrl: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')!
        
        canvas.width = img.width
        canvas.height = img.height
        
        // Clear canvas with transparent background
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        
        // Draw the image
        ctx.drawImage(img, 0, 0)
        
        // Get image data
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const data = imageData.data
        const width = canvas.width
        const height = canvas.height
        
        // Create a mask to track which pixels to make transparent
        const mask = new Uint8Array(width * height)
        
        // Helper function to get pixel index
        const getIndex = (x: number, y: number) => y * width + x
        const getPixelIndex = (x: number, y: number) => (y * width + x) * 4
        
        // Helper function to check if two pixels are similar
        const arePixelsSimilar = (idx1: number, idx2: number, threshold: number = 30) => {
          const r1 = data[idx1], g1 = data[idx1 + 1], b1 = data[idx1 + 2]
          const r2 = data[idx2], g2 = data[idx2 + 1], b2 = data[idx2 + 2]
          
          const diff = Math.abs(r1 - r2) + Math.abs(g1 - g2) + Math.abs(b1 - b2)
          return diff < threshold
        }
        
        // Helper function to check if pixel is light colored
        const isLightPixel = (pixelIdx: number, threshold: number = 230) => {
          const r = data[pixelIdx]
          const g = data[pixelIdx + 1]
          const b = data[pixelIdx + 2]
          const brightness = 0.299 * r + 0.587 * g + 0.114 * b
          const colorVariance = Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(r - b))
          return brightness > threshold && colorVariance < 50
        }
        
        // Flood fill algorithm to remove connected background areas
        const floodFill = (startX: number, startY: number) => {
          const stack: Array<[number, number]> = [[startX, startY]]
          const startPixelIdx = getPixelIndex(startX, startY)
          
          if (!isLightPixel(startPixelIdx)) return
          
          while (stack.length > 0) {
            const [x, y] = stack.pop()!
            const idx = getIndex(x, y)
            const pixelIdx = getPixelIndex(x, y)
            
            if (x < 0 || x >= width || y < 0 || y >= height || mask[idx] === 1) continue
            if (!arePixelsSimilar(startPixelIdx, pixelIdx, 40) || !isLightPixel(pixelIdx, 200)) continue
            
            mask[idx] = 1 // Mark for transparency
            
            // Add neighbors to stack
            stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1])
          }
        }
        
        // Start flood fill from all edges (assuming background touches edges)
        // Top and bottom edges
        for (let x = 0; x < width; x++) {
          floodFill(x, 0) // Top edge
          floodFill(x, height - 1) // Bottom edge
        }
        
        // Left and right edges
        for (let y = 0; y < height; y++) {
          floodFill(0, y) // Left edge
          floodFill(width - 1, y) // Right edge
        }
        
        // Additional pass: Remove isolated light pixels and apply edge smoothing
        for (let y = 1; y < height - 1; y++) {
          for (let x = 1; x < width - 1; x++) {
            const idx = getIndex(x, y)
            const pixelIdx = getPixelIndex(x, y)
            
            // If not already marked for transparency, check if it should be
            if (mask[idx] === 0 && isLightPixel(pixelIdx, 240)) {
              // Check if surrounded by transparent pixels
              let transparentNeighbors = 0
              for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                  if (dx === 0 && dy === 0) continue
                  const nx = x + dx, ny = y + dy
                  if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                    const neighborIdx = getIndex(nx, ny)
                    if (mask[neighborIdx] === 1) transparentNeighbors++
                  }
                }
              }
              
              // If mostly surrounded by transparent pixels, make this transparent too
              if (transparentNeighbors >= 5) {
                mask[idx] = 1
              }
            }
          }
        }
        
        // Apply the mask to make pixels transparent
        for (let i = 0; i < mask.length; i++) {
          if (mask[i] === 1) {
            const pixelIdx = i * 4
            data[pixelIdx + 3] = 0 // Set alpha to 0 (transparent)
          }
        }
        
        // Edge smoothing: Apply anti-aliasing to signature edges
        for (let y = 1; y < height - 1; y++) {
          for (let x = 1; x < width - 1; x++) {
            const idx = getIndex(x, y)
            const pixelIdx = getPixelIndex(x, y)
            
            // If pixel is opaque, check if it's on an edge
            if (mask[idx] === 0 && data[pixelIdx + 3] > 0) {
              let transparentNeighbors = 0
              for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                  if (dx === 0 && dy === 0) continue
                  const nx = x + dx, ny = y + dy
                  if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                    const neighborIdx = getIndex(nx, ny)
                    if (mask[neighborIdx] === 1) transparentNeighbors++
                  }
                }
              }
              
              // If on the edge of transparency, apply partial transparency for smooth edges
              if (transparentNeighbors > 0 && transparentNeighbors < 4) {
                const edgeAlpha = Math.max(50, 255 - (transparentNeighbors * 40))
                data[pixelIdx + 3] = Math.min(data[pixelIdx + 3], edgeAlpha)
              }
            }
          }
        }
        
        // Put the modified image data back
        ctx.putImageData(imageData, 0, 0)
        
        // Always return as PNG to preserve transparency
        resolve(canvas.toDataURL('image/png', 1.0))
      }
      img.onerror = () => reject(new Error('Failed to load image for background removal'))
      img.src = imageDataUrl
    })
  }

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return

    // File size validation (max 5MB)
    const MAX_FILE_SIZE = 5 * 1024 * 1024
    if (f.size > MAX_FILE_SIZE) {
      alert('File too large. Maximum size is 5MB.')
      e.target.value = ''
      return
    }

    // File type validation - accept all image types
    if (!f.type.startsWith('image/')) {
      alert('Invalid file type. Please select an image file.')
      e.target.value = ''
      return
    }

    const r = new FileReader()
    r.onload = async () => {
      try {
        const result = r.result as string
        if (isValidDataURL(result)) {
          // Store original image data for re-processing
          setOriginalImageData(result)
          // Process the image based on user settings
          const processedSignature = await processBackground(result, removeBackground, backgroundThreshold)
          setCurrentSignature(processedSignature)
        } else {
          alert('Invalid image file. Please try a different image.')
          e.target.value = ''
        }
      } catch (error) {
        console.error('Background removal failed:', error)
        // Fallback to original image if background removal fails
        const result = r.result as string
        if (isValidDataURL(result)) {
          setCurrentSignature(result)
        } else {
          alert('Invalid image file. Please try a different image.')
          e.target.value = ''
        }
      }
    }
    r.onerror = () => {
      alert('Failed to read image file. Please try again.')
      e.target.value = ''
    }
    r.readAsDataURL(f)
  }

  // Validate data URL format - accept all image types
  const isValidDataURL = (dataUrl: string): boolean => {
    return /^data:image\/[^;]+;base64,[A-Za-z0-9+/=]+$/.test(dataUrl)
  }

  // Re-process image when settings change
  const reprocessImage = async () => {
    if (!originalImageData) return
    
    try {
      const processedSignature = await processBackground(originalImageData, removeBackground, backgroundThreshold)
      setCurrentSignature(processedSignature)
    } catch (error) {
      console.error('Re-processing failed:', error)
      // Fallback to original if processing fails
      setCurrentSignature(originalImageData)
    }
  }

  // Handle background removal toggle
  const handleBackgroundToggle = (enabled: boolean) => {
    setRemoveBackground(enabled)
    if (originalImageData) {
      // Re-process with new setting
      setTimeout(() => reprocessImage(), 50)
    }
  }

  // Handle threshold change
  const handleThresholdChange = (newThreshold: number) => {
    setBackgroundThreshold(newThreshold)
    if (originalImageData && removeBackground) {
      // Re-process with new threshold
      setTimeout(() => reprocessImage(), 50)
    }
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
          <div style={{marginBottom:8}}>
            <label style={{display:'flex', alignItems:'center', fontSize:12}}>
              <input 
                type="checkbox" 
                checked={removeBackground} 
                onChange={(e) => handleBackgroundToggle(e.target.checked)}
                style={{marginRight:6}}
              />
              Remove white background
            </label>
          </div>
          {removeBackground && (
            <div style={{marginBottom:8}}>
              <label style={{fontSize:12, color:'#6b7280'}}>
                Background sensitivity: {backgroundThreshold}
              </label>
              <input 
                type="range" 
                min="100" 
                max="250" 
                value={backgroundThreshold}
                onChange={(e) => handleThresholdChange(parseInt(e.target.value))}
                style={{width:'100%', marginTop:2}}
              />
              <div style={{fontSize:10, color:'#9ca3af', display:'flex', justifyContent:'space-between'}}>
                <span>Less sensitive</span>
                <span>More sensitive</span>
              </div>
            </div>
          )}
          <input type="file" accept="image/*" onChange={onUpload} />
          {currentSignature && (
            <div style={{marginTop:8, textAlign:'center'}}>
              <div style={{marginBottom:4, fontSize:12, color:'#6b7280'}}>Preview:</div>
              <img 
                src={currentSignature} 
                alt="Signature preview" 
                style={{
                  maxWidth: '200px',
                  maxHeight: '80px',
                  border: '1px solid #e5e7eb',
                  borderRadius: '4px',
                  backgroundColor: removeBackground ? 'transparent' : '#f9fafb'
                }}
              />
              {removeBackground && (
                <div style={{fontSize:10, color:'#6b7280', marginTop:4}}>
                  Adjust sensitivity slider above if background removal isn't perfect
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}