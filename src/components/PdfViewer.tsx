import React, { useEffect, useRef } from 'react'
import { useAppStore } from '../store/appStore'
import { renderPdfToCanvases } from '../modules/pdf/render'

export const PdfViewer: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null)
  const { pdfFile, setPageSizes, setPages, pages, placements, addPlacement, currentSignature, updatePlacement, removePlacement } = useAppStore()
  
  // Handle keyboard deletion
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const selected = document.querySelector('.sig-img.selected') as HTMLElement
        if (selected) {
          const placementId = selected.dataset.placementId
          if (placementId && confirm('Delete selected signature?')) {
            removePlacement(placementId)
          }
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(()=>{
    (async () => {
      if (!containerRef.current) return
      
      if (!pdfFile) {
        // Clear the container when no PDF is loaded
        containerRef.current.innerHTML = ''
        return
      }
      
      const { canvases, sizes } = await renderPdfToCanvases(pdfFile)
      setPages(canvases, sizes)
      containerRef.current.innerHTML = ''
      canvases.forEach((c, pageIndex)=>{
        const wrap = document.createElement('div')
        wrap.className = 'page-wrap'
        c.className = 'pdf-page'
        wrap.style.cursor = currentSignature ? 'crosshair' : 'default'
        wrap.appendChild(c)
        
        // Set wrapper size to match displayed canvas size after CSS scaling
        setTimeout(() => {
          const canvasRect = c.getBoundingClientRect()
          wrap.style.width = canvasRect.width + 'px'
          wrap.style.height = canvasRect.height + 'px'
        }, 0)
        // click-to-place or deselect (with percentage-based positioning)
        const handlePlacement = (clientX: number, clientY: number) => {
          if (currentSignature) {
            const canvasRect = c.getBoundingClientRect()
            const x = clientX - canvasRect.left
            const y = clientY - canvasRect.top
            
            // Convert to percentage coordinates (0-100)
            const percentX = (x / canvasRect.width) * 100
            const percentY = (y / canvasRect.height) * 100
            
            // Default signature size as percentage of canvas
            const percentW = (220 / canvasRect.width) * 100  // ~15-20% of typical canvas width
            const percentH = (60 / canvasRect.height) * 100   // ~5-8% of typical canvas height
            
            // Center signature on click point and clamp within bounds
            const clampedX = Math.max(0, Math.min(percentX - percentW/2, 100 - percentW))
            const clampedY = Math.max(0, Math.min(percentY - percentH/2, 100 - percentH))
            
            console.log(`Percentage Position Debug:`)
            console.log(`  Click: (${x.toFixed(1)}, ${y.toFixed(1)}) in ${canvasRect.width.toFixed(1)}x${canvasRect.height.toFixed(1)} canvas`)
            console.log(`  Percent: (${percentX.toFixed(1)}%, ${percentY.toFixed(1)}%) -> Clamped: (${clampedX.toFixed(1)}%, ${clampedY.toFixed(1)}%)`)
            console.log(`  Size: ${percentW.toFixed(1)}% x ${percentH.toFixed(1)}%`)
            
            addPlacement(pageIndex, { x: clampedX, y: clampedY, w: percentW, h: percentH }, currentSignature)
          } else {
            // Deselect all signatures and hide handles when clicking on empty area
            document.querySelectorAll('.sig-img').forEach(el => el.classList.remove('selected'))
            document.querySelectorAll('.sig-handle').forEach(el => (el as HTMLElement).style.display = 'none')
          }
        }
        
        wrap.addEventListener('click', (ev) => {
          handlePlacement(ev.clientX, ev.clientY)
        })
        
        // Add touch support for signature placement with scroll detection
        let touchStartX = 0
        let touchStartY = 0
        let touchStartTime = 0
        let hasMoved = false
        
        wrap.addEventListener('touchstart', (ev) => {
          if (ev.touches.length === 1) {
            const touch = ev.touches[0]
            touchStartX = touch.clientX
            touchStartY = touch.clientY
            touchStartTime = Date.now()
            hasMoved = false
          }
        }, { passive: true })
        
        wrap.addEventListener('touchmove', (ev) => {
          if (ev.touches.length === 1) {
            const touch = ev.touches[0]
            const deltaX = Math.abs(touch.clientX - touchStartX)
            const deltaY = Math.abs(touch.clientY - touchStartY)
            
            // If movement is significant, consider it a scroll gesture
            if (deltaX > 10 || deltaY > 10) {
              hasMoved = true
            }
          }
        }, { passive: true })
        
        wrap.addEventListener('touchend', (ev) => {
          if (ev.changedTouches.length > 0 && !hasMoved) {
            const touch = ev.changedTouches[0]
            const touchDuration = Date.now() - touchStartTime
            
            // Only place signature if:
            // 1. No significant movement (not a scroll)
            // 2. Touch duration is reasonable (not too long, not too short)
            // 3. Touch is within reasonable bounds of start position
            const deltaX = Math.abs(touch.clientX - touchStartX)
            const deltaY = Math.abs(touch.clientY - touchStartY)
            
            if (touchDuration < 300 && touchDuration > 50 && deltaX < 5 && deltaY < 5) {
              ev.preventDefault()
              handlePlacement(touch.clientX, touch.clientY)
            }
          }
        })
        containerRef.current!.appendChild(wrap)
      })
    })()
  }, [pdfFile, currentSignature])

  // Render placements as absolutely positioned <img> overlays
  useEffect(()=>{
    if (!containerRef.current) return
    const wraps = Array.from(containerRef.current.querySelectorAll('.page-wrap')) as HTMLElement[]
    wraps.forEach((wrap, pageIndex)=>{
      // remove existing overlay imgs and handles
      Array.from(wrap.querySelectorAll('img.sig-img')).forEach(el => el.remove())
      Array.from(wrap.querySelectorAll('.sig-handle')).forEach(el => el.remove())
      placements.filter(p => p.pageIndex === pageIndex).forEach(p => {
        const img = document.createElement('img')
        const handle = document.createElement('div')
        
        // Convert percentage coordinates to current display pixels
        const canvas = wrap.querySelector('canvas') as HTMLCanvasElement
        const canvasRect = canvas.getBoundingClientRect()
        
        const displayX = (p.rect.x / 100) * canvasRect.width
        const displayY = (p.rect.y / 100) * canvasRect.height
        const displayW = (p.rect.w / 100) * canvasRect.width
        const displayH = (p.rect.h / 100) * canvasRect.height
        
        console.log(`Percentage Display Debug:`)
        console.log(`  Stored: (${p.rect.x.toFixed(1)}%, ${p.rect.y.toFixed(1)}%, ${p.rect.w.toFixed(1)}%, ${p.rect.h.toFixed(1)}%)`)
        console.log(`  Canvas: ${canvasRect.width.toFixed(1)}x${canvasRect.height.toFixed(1)}`)
        console.log(`  Display: (${displayX.toFixed(1)}, ${displayY.toFixed(1)}, ${displayW.toFixed(1)}, ${displayH.toFixed(1)})`)
        
        // Setup image with display coordinates
        img.src = p.imageDataUrl
        img.className = 'sig-img'
        img.dataset.placementId = p.id
        img.style.left = displayX + 'px'
        img.style.top = displayY + 'px'
        img.style.width = displayW + 'px'
        img.style.height = displayH + 'px'
        img.draggable = false
        img.title = 'Click to select, drag to move, right-click or Delete key to remove'
        
        // Setup handle with mobile-friendly positioning
        handle.className = 'sig-handle'
        handle.dataset.placementId = p.id
        
        // Position handle more accurately for mobile touch  
        const isMobile = window.innerWidth <= 768
        const handleOffset = isMobile ? 16 : 8 // Larger offset for mobile
        handle.style.left = (displayX + displayW - handleOffset) + 'px'
        handle.style.top = (displayY + displayH - handleOffset) + 'px'
        handle.style.display = 'none' // Initially hidden
        handle.title = 'Drag to resize'
        
        // Add better visual feedback for mobile
        if (isMobile) {
          handle.style.border = '3px solid #fff'
          handle.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)'
        }
        
        // Selection functionality
        const selectSignature = () => {
          document.querySelectorAll('.sig-img').forEach(el => el.classList.remove('selected'))
          document.querySelectorAll('.sig-handle').forEach(el => (el as HTMLElement).style.display = 'none')
          img.classList.add('selected')
          handle.style.display = 'block'
        }
        
        // Click/Touch to select
        img.addEventListener('click', (e) => {
          e.stopPropagation()
          selectSignature()
        })
        
        
        // Right-click to delete
        img.addEventListener('contextmenu', (e) => {
          e.preventDefault()
          if (confirm('Delete this signature?')) {
            removePlacement(p.id)
          }
        })
        
        // Drag to move functionality (mouse and touch)
        let isDragging = false
        let dragStarted = false
        
        const startDrag = (startX: number, startY: number, checkHandleArea: boolean = true) => {
          if (checkHandleArea) {
            // Check if click is near the handle area to avoid conflict
            const imgRect = img.getBoundingClientRect()
            const clickX = startX - imgRect.left
            const clickY = startY - imgRect.top
            const isMobile = window.innerWidth <= 768
            const handleAreaSize = isMobile ? 40 : 30 // Larger exclusion area for mobile
            const handleAreaX = imgRect.width - handleAreaSize
            const handleAreaY = imgRect.height - handleAreaSize
            
            if (clickX > handleAreaX && clickY > handleAreaY) {
              // Click is in handle area, don't start dragging
              return false
            }
          }
          
          isDragging = true
          dragStarted = false
          const startRect = { ...p.rect }
          selectSignature()
          
          const handleMove = (moveX: number, moveY: number) => {
            if (!isDragging) return
            
            // Only start dragging after a small threshold to avoid accidental drags
            if (!dragStarted) {
              const dragThreshold = 5 // Slightly larger threshold for touch
              const dx = Math.abs(moveX - startX)
              const dy = Math.abs(moveY - startY)
              if (dx < dragThreshold && dy < dragThreshold) return
              dragStarted = true
            }
            
            const dx = moveX - startX
            const dy = moveY - startY
            const canvas = wrap.querySelector('canvas') as HTMLCanvasElement
            const canvasRect = canvas.getBoundingClientRect()
            
            // Convert pixel movement to percentage movement
            const percentDx = (dx / canvasRect.width) * 100
            const percentDy = (dy / canvasRect.height) * 100
            
            const newX = Math.max(0, Math.min(startRect.x + percentDx, 100 - startRect.w))
            const newY = Math.max(0, Math.min(startRect.y + percentDy, 100 - startRect.h))
            updatePlacement(p.id, { ...startRect, x: newX, y: newY })
          }
          
          const handleEnd = () => {
            isDragging = false
            dragStarted = false
            document.removeEventListener('mousemove', handleMouseMove)
            document.removeEventListener('mouseup', handleMouseUp)
            document.removeEventListener('touchmove', handleTouchMove)
            document.removeEventListener('touchend', handleTouchEnd)
          }
          
          const handleMouseMove = (moveEvent: MouseEvent) => {
            handleMove(moveEvent.clientX, moveEvent.clientY)
          }
          
          const handleMouseUp = () => {
            handleEnd()
          }
          
          const handleTouchMove = (moveEvent: TouchEvent) => {
            moveEvent.preventDefault()
            if (moveEvent.touches.length > 0) {
              const touch = moveEvent.touches[0]
              handleMove(touch.clientX, touch.clientY)
            }
          }
          
          const handleTouchEnd = () => {
            handleEnd()
          }
          
          document.addEventListener('mousemove', handleMouseMove)
          document.addEventListener('mouseup', handleMouseUp)
          document.addEventListener('touchmove', handleTouchMove, { passive: false })
          document.addEventListener('touchend', handleTouchEnd)
          
          return true
        }
        
        img.addEventListener('mousedown', (e) => {
          if (e.button !== 0) return // Only left click
          e.preventDefault()
          startDrag(e.clientX, e.clientY, true)
        })
        
        // Touch handling for signatures (long press, drag, select, pinch-to-resize)
        let longPressTimer: number | null = null
        let isLongPress = false
        let touchMoveStarted = false
        let initialTouchX = 0
        let initialTouchY = 0
        let isPinching = false
        let initialDistance = 0
        let initialRect = { ...p.rect }
        
        img.addEventListener('touchstart', (e) => {
          e.preventDefault()
          
          if (e.touches.length === 1) {
            const touch = e.touches[0]
            isLongPress = false
            touchMoveStarted = false
            isPinching = false
            initialTouchX = touch.clientX
            initialTouchY = touch.clientY
            initialRect = { ...p.rect }
            
            // Set up long press detection
            longPressTimer = setTimeout(() => {
              isLongPress = true
              // Vibrate if available
              if ('vibrate' in navigator) {
                navigator.vibrate(50)
              }
              if (confirm('Delete this signature?')) {
                removePlacement(p.id)
              }
            }, 500) // 500ms for long press
          } else if (e.touches.length === 2) {
            // Two fingers - start pinch to resize
            if (longPressTimer) {
              clearTimeout(longPressTimer)
              longPressTimer = null
            }
            
            isPinching = true
            isLongPress = false
            touchMoveStarted = false
            
            const touch1 = e.touches[0]
            const touch2 = e.touches[1]
            initialDistance = Math.sqrt(
              Math.pow(touch2.clientX - touch1.clientX, 2) +
              Math.pow(touch2.clientY - touch1.clientY, 2)
            )
            initialRect = { ...p.rect }
            
            // Select the signature when starting pinch
            selectSignature()
          }
        }, { passive: false })
        
        img.addEventListener('touchend', (e) => {
          if (longPressTimer) {
            clearTimeout(longPressTimer)
            longPressTimer = null
          }
          
          // Reset pinching state when fingers are lifted
          if (e.touches.length < 2) {
            isPinching = false
          }
          
          // Handle tap to select (only if not dragging, pinching, or long pressing)
          if (!isDragging && !isLongPress && !isPinching && e.changedTouches.length > 0) {
            e.stopPropagation()
            e.preventDefault()
            selectSignature()
          }
          
          isLongPress = false
        })
        
        img.addEventListener('touchmove', (e) => {
          if (longPressTimer) {
            clearTimeout(longPressTimer)
            longPressTimer = null
          }
          
          if (e.touches.length === 2 && isPinching) {
            // Handle pinch to resize
            e.preventDefault()
            
            const touch1 = e.touches[0]
            const touch2 = e.touches[1]
            const currentDistance = Math.sqrt(
              Math.pow(touch2.clientX - touch1.clientX, 2) +
              Math.pow(touch2.clientY - touch1.clientY, 2)
            )
            
            // Calculate scale factor
            const scaleFactor = currentDistance / initialDistance
            
            // Apply scaling with reasonable percentage limits
            const minW = 5  // 5% of canvas width
            const minH = 3  // 3% of canvas height  
            const maxW = Math.min(50, 100 - initialRect.x) // Max 50% or remaining space
            const maxH = Math.min(30, 100 - initialRect.y) // Max 30% or remaining space
            
            const newW = Math.max(minW, Math.min(maxW, initialRect.w * scaleFactor))
            const newH = Math.max(minH, Math.min(maxH, initialRect.h * scaleFactor))
            
            updatePlacement(p.id, { ...initialRect, w: newW, h: newH })
            
          } else if (e.touches.length === 1 && !isPinching) {
            // Start dragging only if there's intentional movement on the signature
            if (!touchMoveStarted) {
              const touch = e.touches[0]
              const deltaX = Math.abs(touch.clientX - initialTouchX)
              const deltaY = Math.abs(touch.clientY - initialTouchY)
              
              // Check if touch started in handle area
              const imgRect = img.getBoundingClientRect()
              const startClickX = initialTouchX - imgRect.left
              const startClickY = initialTouchY - imgRect.top
              const isMobile = window.innerWidth <= 768
              const handleAreaSize = isMobile ? 40 : 30
              const handleAreaX = imgRect.width - handleAreaSize
              const handleAreaY = imgRect.height - handleAreaSize
              const inHandleArea = startClickX > handleAreaX && startClickY > handleAreaY
              
              // If significant movement detected and not in handle area, start drag
              if (!inHandleArea && (deltaX > 15 || deltaY > 15)) {
                touchMoveStarted = true
                e.preventDefault() // Prevent scrolling when dragging signature
                startDrag(initialTouchX, initialTouchY, true)
              }
            }
          }
        }, { passive: false })
        
        // Resize functionality (mouse and touch)
        const startResize = (startX: number, startY: number) => {
          let isResizing = true
          const startRect = { ...p.rect }
          
          // Visual feedback during resize
          handle.style.backgroundColor = '#1d4ed8'
          handle.style.transform = 'scale(1.2)'
          
          const handleResizeMove = (moveX: number, moveY: number) => {
            if (!isResizing) return
            const dx = moveX - startX
            const dy = moveY - startY
            const canvas = wrap.querySelector('canvas') as HTMLCanvasElement
            const canvasRect = canvas.getBoundingClientRect()
            
            // Convert pixel movement to percentage movement
            const percentDx = (dx / canvasRect.width) * 100
            const percentDy = (dy / canvasRect.height) * 100
            
            // Percentage-based size limits
            const minW = 5  // 5% minimum width
            const minH = 3  // 3% minimum height
            const maxW = 100 - startRect.x  // Can't exceed canvas bounds
            const maxH = 100 - startRect.y
            
            const newRect = { 
              ...startRect, 
              w: Math.max(minW, Math.min(maxW, startRect.w + percentDx)),
              h: Math.max(minH, Math.min(maxH, startRect.h + percentDy))
            }
            updatePlacement(p.id, newRect)
          }
          
          const handleResizeEnd = () => {
            isResizing = false
            
            // Reset visual feedback
            handle.style.backgroundColor = '#3b82f6'
            handle.style.transform = 'scale(1)'
            
            document.removeEventListener('mousemove', handleMouseResizeMove)
            document.removeEventListener('mouseup', handleMouseResizeUp)
            document.removeEventListener('touchmove', handleTouchResizeMove)
            document.removeEventListener('touchend', handleTouchResizeEnd)
          }
          
          const handleMouseResizeMove = (moveEvent: MouseEvent) => {
            handleResizeMove(moveEvent.clientX, moveEvent.clientY)
          }
          
          const handleMouseResizeUp = () => {
            handleResizeEnd()
          }
          
          const handleTouchResizeMove = (moveEvent: TouchEvent) => {
            moveEvent.preventDefault()
            if (moveEvent.touches.length > 0) {
              const touch = moveEvent.touches[0]
              handleResizeMove(touch.clientX, touch.clientY)
            }
          }
          
          const handleTouchResizeEnd = () => {
            handleResizeEnd()
          }
          
          document.addEventListener('mousemove', handleMouseResizeMove)
          document.addEventListener('mouseup', handleMouseResizeUp)
          document.addEventListener('touchmove', handleTouchResizeMove, { passive: false })
          document.addEventListener('touchend', handleTouchResizeEnd)
        }
        
        handle.addEventListener('mousedown', (e) => {
          e.stopPropagation()
          e.preventDefault()
          startResize(e.clientX, e.clientY)
        })
        
        // Improved touch handling for resize handle
        let resizeTouchStarted = false
        
        handle.addEventListener('touchstart', (e) => {
          e.stopPropagation()
          e.preventDefault()
          
          if (e.touches.length === 1) {
            resizeTouchStarted = true
            const touch = e.touches[0]
            
            // Immediately start resize for better responsiveness
            startResize(touch.clientX, touch.clientY)
            
            // Also ensure the signature is selected
            selectSignature()
          }
        }, { passive: false })
        
        // Prevent signature dragging when handle is touched
        handle.addEventListener('touchmove', (e) => {
          e.stopPropagation()
          e.preventDefault()
        }, { passive: false })
        
        wrap.appendChild(img)
        wrap.appendChild(handle)
      })
    })
  }, [placements])

  return <div ref={containerRef} style={{ padding: 12, overflow: 'auto', height: '100%' }} />
}