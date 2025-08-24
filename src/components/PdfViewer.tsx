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
      if (!pdfFile || !containerRef.current) return
      const { canvases, sizes } = await renderPdfToCanvases(pdfFile)
      setPages(canvases, sizes)
      containerRef.current.innerHTML = ''
      canvases.forEach((c, pageIndex)=>{
        const wrap = document.createElement('div')
        wrap.className = 'page-wrap'
        c.className = 'pdf-page'
        wrap.style.width = c.width + 'px'
        wrap.style.height = c.height + 'px'
        wrap.style.cursor = currentSignature ? 'crosshair' : 'default'
        wrap.appendChild(c)
        // click-to-place or deselect
        wrap.addEventListener('click', (ev) => {
          if (currentSignature) {
            const rect = wrap.getBoundingClientRect()
            const x = ev.clientX - rect.left
            const y = ev.clientY - rect.top  // Top-based coords for display
            const w = 220, h = 60
            // Ensure signature stays within bounds
            const clampedX = Math.max(0, Math.min(x - w/2, rect.width - w))
            const clampedY = Math.max(0, Math.min(y - h/2, rect.height - h))
            addPlacement(pageIndex, { x: clampedX, y: clampedY, w, h }, currentSignature)
          } else {
            // Deselect all signatures and hide handles when clicking on empty area
            document.querySelectorAll('.sig-img').forEach(el => el.classList.remove('selected'))
            document.querySelectorAll('.sig-handle').forEach(el => (el as HTMLElement).style.display = 'none')
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
        
        // Setup image
        img.src = p.imageDataUrl
        img.className = 'sig-img'
        img.dataset.placementId = p.id
        img.style.left = p.rect.x + 'px'
        img.style.top = p.rect.y + 'px'
        img.style.width = p.rect.w + 'px'
        img.style.height = p.rect.h + 'px'
        img.draggable = false
        img.title = 'Click to select, drag to move, right-click or Delete key to remove'
        
        // Setup handle
        handle.className = 'sig-handle'
        handle.dataset.placementId = p.id
        handle.style.left = (p.rect.x + p.rect.w - 8) + 'px'
        handle.style.top = (p.rect.y + p.rect.h - 8) + 'px'
        handle.style.display = 'none' // Initially hidden
        handle.title = 'Drag to resize'
        
        // Selection functionality
        const selectSignature = () => {
          document.querySelectorAll('.sig-img').forEach(el => el.classList.remove('selected'))
          document.querySelectorAll('.sig-handle').forEach(el => (el as HTMLElement).style.display = 'none')
          img.classList.add('selected')
          handle.style.display = 'block'
        }
        
        // Click to select
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
        
        // Drag to move functionality
        let isDragging = false
        let dragStarted = false
        
        img.addEventListener('mousedown', (e) => {
          if (e.button !== 0) return // Only left click
          
          // Check if click is near the handle area to avoid conflict
          const imgRect = img.getBoundingClientRect()
          const clickX = e.clientX - imgRect.left
          const clickY = e.clientY - imgRect.top
          const handleAreaX = imgRect.width - 20 // 20px from right edge
          const handleAreaY = imgRect.height - 20 // 20px from bottom edge
          
          if (clickX > handleAreaX && clickY > handleAreaY) {
            // Click is in handle area, don't start dragging
            return
          }
          
          isDragging = true
          dragStarted = false
          const startX = e.clientX
          const startY = e.clientY
          const startRect = { ...p.rect }
          e.preventDefault()
          selectSignature()
          
          const handleMouseMove = (moveEvent: MouseEvent) => {
            if (!isDragging) return
            
            // Only start dragging after a small threshold to avoid accidental drags
            if (!dragStarted) {
              const dragThreshold = 3
              const dx = Math.abs(moveEvent.clientX - startX)
              const dy = Math.abs(moveEvent.clientY - startY)
              if (dx < dragThreshold && dy < dragThreshold) return
              dragStarted = true
            }
            
            const dx = moveEvent.clientX - startX
            const dy = moveEvent.clientY - startY
            const wrapRect = wrap.getBoundingClientRect()
            const newX = Math.max(0, Math.min(startRect.x + dx, wrapRect.width - startRect.w))
            const newY = Math.max(0, Math.min(startRect.y + dy, wrapRect.height - startRect.h))
            updatePlacement(p.id, { ...startRect, x: newX, y: newY })
          }
          
          const handleMouseUp = () => {
            isDragging = false
            dragStarted = false
            document.removeEventListener('mousemove', handleMouseMove)
            document.removeEventListener('mouseup', handleMouseUp)
          }
          
          document.addEventListener('mousemove', handleMouseMove)
          document.addEventListener('mouseup', handleMouseUp)
        })
        
        // Resize functionality
        handle.addEventListener('mousedown', (e) => {
          e.stopPropagation()
          e.preventDefault()
          
          let isResizing = true
          const startX = e.clientX
          const startY = e.clientY
          const startRect = { ...p.rect }
          
          const handleResizeMove = (moveEvent: MouseEvent) => {
            if (!isResizing) return
            const dx = moveEvent.clientX - startX
            const dy = moveEvent.clientY - startY
            const wrapRect = wrap.getBoundingClientRect()
            const maxW = wrapRect.width - startRect.x
            const maxH = wrapRect.height - startRect.y
            const newRect = { 
              ...startRect, 
              w: Math.max(40, Math.min(maxW, startRect.w + dx)), 
              h: Math.max(20, Math.min(maxH, startRect.h + dy))
            }
            updatePlacement(p.id, newRect)
          }
          
          const handleResizeUp = () => {
            isResizing = false
            document.removeEventListener('mousemove', handleResizeMove)
            document.removeEventListener('mouseup', handleResizeUp)
          }
          
          document.addEventListener('mousemove', handleResizeMove)
          document.addEventListener('mouseup', handleResizeUp)
        })
        
        wrap.appendChild(img)
        wrap.appendChild(handle)
      })
    })
  }, [placements])

  return <div ref={containerRef} style={{ padding: 12, overflow: 'auto', height: '100%' }} />
}