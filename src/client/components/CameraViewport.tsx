import React, { useEffect, useState } from 'react'
import type { BoundingBox, GranularityFilterResult, RecognizedDetection } from '../../invariant'
import type { CameraScopeAddStatus, CameraScopeCollection } from '../core/CameraScopeModels'
import { ColorPalette } from '../core/ColorPalette'
import type { LocaleService } from '../core/LocaleService'
import { CameraScopeDropdown } from './CameraScopeDropdown'

export interface CameraViewportProps {
  readonly videoRef: React.RefObject<HTMLVideoElement>
  readonly canvasRef: React.RefObject<HTMLCanvasElement>
  readonly cameraActive: boolean
  readonly cameraError: string | null
  readonly mirror: boolean
  readonly resolution: { readonly w: number; readonly h: number }
  readonly filterResult: GranularityFilterResult
  readonly showSuppressed: boolean
  readonly showProbLabels: boolean
  readonly recognizedDetections?: readonly RecognizedDetection[]
  readonly modelStatusBadge: string
  readonly fps: number
  readonly locale: LocaleService
  readonly scopeCollection: CameraScopeCollection
  readonly scopeConfidenceThreshold: number
  readonly scopeFilterBadge?: string | null
  readonly onScopeConfidenceThresholdChange: (value: number) => void
  readonly onAddScope: (text: string) => CameraScopeAddStatus
  readonly onSelectScope: (id: string) => void
  readonly onRenameScope: (id: string, nextText: string) => void
  readonly onDeleteScope: (id: string) => void
  readonly onSelectInstance?: (instance: BoundingBox) => void
}

interface ContainedRect {
  readonly offsetX: number
  readonly offsetY: number
  readonly drawWidth: number
  readonly drawHeight: number
  readonly scaleX: number
  readonly scaleY: number
}

/**
 * CanvasOverlayRenderer: Pure static OOP renderer drawing colored FastSAM-s instance
 * segmentation masks + crisp boundary contours, plus pixel-accurate click hit-testing.
 */
export class CanvasOverlayRenderer {
  private static maskScratchCanvas: HTMLCanvasElement | null = null
  private static maskScratchCtx: CanvasRenderingContext2D | null = null

  public static computeContainedRect(
    viewportW: number,
    viewportH: number,
    frameW: number,
    frameH: number,
  ): ContainedRect {
    if (viewportW <= 0 || viewportH <= 0 || frameW <= 0 || frameH <= 0) {
      return { offsetX: 0, offsetY: 0, drawWidth: 0, drawHeight: 0, scaleX: 1, scaleY: 1 }
    }
    const scale = Math.min(viewportW / frameW, viewportH / frameH)
    const drawWidth = frameW * scale
    const drawHeight = frameH * scale
    const offsetX = (viewportW - drawWidth) * 0.5
    const offsetY = (viewportH - drawHeight) * 0.5
    return { offsetX, offsetY, drawWidth, drawHeight, scaleX: scale, scaleY: scale }
  }

  public static hitTest(
    clientX: number,
    clientY: number,
    canvas: HTMLCanvasElement,
    video: HTMLVideoElement,
    kept: readonly BoundingBox[],
    mirror: boolean,
  ): BoundingBox | null {
    if (kept.length === 0) return null
    const frameW = video.videoWidth
    const frameH = video.videoHeight
    if (frameW <= 0 || frameH <= 0) return null
    const rect = canvas.getBoundingClientRect()
    const cx = clientX - rect.left
    const cy = clientY - rect.top
    const contained = CanvasOverlayRenderer.computeContainedRect(rect.width, rect.height, frameW, frameH)
    if (
      cx < contained.offsetX ||
      cy < contained.offsetY ||
      cx > contained.offsetX + contained.drawWidth ||
      cy > contained.offsetY + contained.drawHeight
    ) {
      return null
    }

    const rawFrameX = (cx - contained.offsetX) / contained.scaleX
    const frameX = mirror ? frameW - rawFrameX : rawFrameX
    const frameY = (cy - contained.offsetY) / contained.scaleY

    // Prefer smallest kept segment under cursor so foreground objects win over background
    const ordered = kept.slice().sort((a, b) => (a.maskArea ?? a.area) - (b.maskArea ?? b.area))
    for (let i = 0; i < ordered.length; i += 1) {
      const item = ordered[i]
      if (frameX < item.x1 || frameX > item.x2 || frameY < item.y1 || frameY > item.y2) {
        continue
      }
      if (item.maskData && item.maskWidth && item.maskHeight) {
        const mx = Math.min(item.maskWidth - 1, Math.max(0, Math.floor((frameX / frameW) * item.maskWidth)))
        const my = Math.min(item.maskHeight - 1, Math.max(0, Math.floor((frameY / frameH) * item.maskHeight)))
        if (item.maskData[my * item.maskWidth + mx] !== 0) {
          return item
        }
      } else {
        return item
      }
    }
    return null
  }

  private static ensureMaskScratch(width: number, height: number): CanvasRenderingContext2D | null {
    if (typeof document === 'undefined') return null
    if (CanvasOverlayRenderer.maskScratchCanvas === null) {
      CanvasOverlayRenderer.maskScratchCanvas = document.createElement('canvas')
      CanvasOverlayRenderer.maskScratchCtx = CanvasOverlayRenderer.maskScratchCanvas.getContext('2d')
    }
    if (
      CanvasOverlayRenderer.maskScratchCanvas.width !== width ||
      CanvasOverlayRenderer.maskScratchCanvas.height !== height
    ) {
      CanvasOverlayRenderer.maskScratchCanvas.width = width
      CanvasOverlayRenderer.maskScratchCanvas.height = height
    }
    return CanvasOverlayRenderer.maskScratchCtx
  }

  private static paintMaskList(
    pixels: Uint8ClampedArray,
    maskW: number,
    maskH: number,
    items: readonly BoundingBox[],
    isSuppressed: boolean,
    hoveredId: string | null,
  ): void {
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i]
      const mData = item.maskData
      if (mData === undefined || item.maskWidth !== maskW || item.maskHeight !== maskH) continue

      const isHovered = !isSuppressed && hoveredId === item.id
      const rgb = isSuppressed
        ? { r: 244, g: 63, b: 94 }
        : ColorPalette.rgbFor(item.colorIndex)
      const fillAlpha = isSuppressed ? 38 : isHovered ? 138 : 96
      const edgeAlpha = isSuppressed ? 190 : 250

      for (let y = 0; y < maskH; y += 1) {
        const rowOffset = y * maskW
        for (let x = 0; x < maskW; x += 1) {
          const idx = rowOffset + x
          if (mData[idx] === 0) continue

          const isEdge =
            x === 0 ||
            y === 0 ||
            x === maskW - 1 ||
            y === maskH - 1 ||
            mData[idx - 1] === 0 ||
            mData[idx + 1] === 0 ||
            mData[idx - maskW] === 0 ||
            mData[idx + maskW] === 0

          const p = idx * 4
          pixels[p] = isHovered && isEdge ? 255 : rgb.r
          pixels[p + 1] = isHovered && isEdge ? 255 : rgb.g
          pixels[p + 2] = isHovered && isEdge ? 255 : rgb.b
          pixels[p + 3] = isEdge ? edgeAlpha : fillAlpha
        }
      }
    }
  }

  private static drawRoundedRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
  ): void {
    const radius = Math.min(r, w * 0.5, h * 0.5)
    ctx.beginPath()
    ctx.moveTo(x + radius, y)
    ctx.arcTo(x + w, y, x + w, y + h, radius)
    ctx.arcTo(x + w, y + h, x, y + h, radius)
    ctx.arcTo(x, y + h, x, y, radius)
    ctx.arcTo(x, y, x + w, y, radius)
    ctx.closePath()
  }

  public static render(
    canvas: HTMLCanvasElement,
    video: HTMLVideoElement,
    result: GranularityFilterResult,
    showSuppressed: boolean,
    mirror: boolean,
    hoveredId: string | null = null,
    showProbLabels = false,
    recognizedDetections: readonly RecognizedDetection[] = [],
  ): void {
    const rectCss = canvas.getBoundingClientRect()
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
    const targetW = Math.max(1, Math.round(rectCss.width * dpr))
    const targetH = Math.max(1, Math.round(rectCss.height * dpr))
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW
      canvas.height = targetH
    }

    const ctx = canvas.getContext('2d')
    if (ctx === null) return
    ctx.save()
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, rectCss.width, rectCss.height)

    const frameW = video.videoWidth
    const frameH = video.videoHeight
    if (frameW <= 0 || frameH <= 0) {
      ctx.restore()
      return
    }

    const contained = CanvasOverlayRenderer.computeContainedRect(
      rectCss.width,
      rectCss.height,
      frameW,
      frameH,
    )

    const sampleItem = result.kept[0] ?? (showSuppressed ? result.suppressed[0] : undefined)
    if (sampleItem && sampleItem.maskWidth && sampleItem.maskHeight) {
      const maskW = sampleItem.maskWidth
      const maskH = sampleItem.maskHeight
      const scratchCtx = CanvasOverlayRenderer.ensureMaskScratch(maskW, maskH)
      if (scratchCtx !== null && CanvasOverlayRenderer.maskScratchCanvas !== null) {
        const imgData = scratchCtx.createImageData(maskW, maskH)
        if (showSuppressed && result.suppressed.length > 0) {
          CanvasOverlayRenderer.paintMaskList(imgData.data, maskW, maskH, result.suppressed, true, hoveredId)
        }
        if (result.kept.length > 0) {
          CanvasOverlayRenderer.paintMaskList(imgData.data, maskW, maskH, result.kept, false, hoveredId)
        }
        scratchCtx.putImageData(imgData, 0, 0)

        ctx.save()
        ctx.imageSmoothingEnabled = true
        if (mirror) {
          ctx.translate(contained.offsetX + contained.drawWidth, contained.offsetY)
          ctx.scale(-1, 1)
          ctx.drawImage(CanvasOverlayRenderer.maskScratchCanvas, 0, 0, contained.drawWidth, contained.drawHeight)
        } else {
          ctx.drawImage(
            CanvasOverlayRenderer.maskScratchCanvas,
            contained.offsetX,
            contained.offsetY,
            contained.drawWidth,
            contained.drawHeight,
          )
        }
        ctx.restore()
      }
    }

    if (showProbLabels) {
    ctx.font = '600 11px Roboto, -apple-system, BlinkMacSystemFont, sans-serif'
    ctx.textBaseline = 'middle'
    for (let i = 0; i < result.kept.length; i += 1) {
      const kb = result.kept[i]
      const stroke = ColorPalette.strokeFor(kb.colorIndex)
      const rawAx = kb.anchorX ?? (kb.x1 + kb.x2) * 0.5
      const rawAy = kb.anchorY ?? (kb.y1 + kb.y2) * 0.5
      const ax = contained.offsetX + (mirror ? frameW - rawAx : rawAx) * contained.scaleX
      const ay = contained.offsetY + rawAy * contained.scaleY

      const badgeText = '#' + (i + 1) + ' · ' + kb.score.toFixed(2)
      const textW = ctx.measureText(badgeText).width
      const pillW = textW + 12
      const pillH = 18
      const pillX = Math.max(
        contained.offsetX + 4,
        Math.min(contained.offsetX + contained.drawWidth - pillW - 4, ax - pillW * 0.5),
      )
      const pillY = Math.max(
        contained.offsetY + 4,
        Math.min(contained.offsetY + contained.drawHeight - pillH - 4, ay - pillH * 0.5),
      )

      ctx.fillStyle = hoveredId === kb.id ? '#ffffff' : stroke
      CanvasOverlayRenderer.drawRoundedRect(ctx, pillX, pillY, pillW, pillH, 6)
      ctx.fill()
      ctx.fillStyle = '#071019'
      ctx.fillText(badgeText, pillX + 6, pillY + pillH * 0.5 + 0.5)
    }
    }

    // Classic CV bounding box + title label for recognized objects (unaffected by showProbLabels switch)
    if (recognizedDetections.length > 0) {
      ctx.font = '700 13px Roboto, -apple-system, BlinkMacSystemFont, sans-serif'
      ctx.textBaseline = 'middle'
      for (let i = 0; i < recognizedDetections.length; i += 1) {
        const det = recognizedDetections[i]
        const rawX1 = mirror ? frameW - det.x2 : det.x1
        const rawX2 = mirror ? frameW - det.x1 : det.x2
        const bx = contained.offsetX + rawX1 * contained.scaleX
        const by = contained.offsetY + det.y1 * contained.scaleY
        const bw = Math.max(4, (rawX2 - rawX1) * contained.scaleX)
        const bh = Math.max(4, (det.y2 - det.y1) * contained.scaleY)
        const boxColor = ColorPalette.strokeFor(det.colorIndex)

        // Outer dark halo + crisp classic CV rectangle
        ctx.lineWidth = 4.5
        ctx.strokeStyle = 'rgba(7, 10, 18, 0.72)'
        ctx.strokeRect(bx, by, bw, bh)
        ctx.lineWidth = 2.5
        ctx.strokeStyle = boxColor
        ctx.strokeRect(bx, by, bw, bh)

        // Classic CV title tag flush on top-left corner of bbox
        const labelText = det.title
        const textW = ctx.measureText(labelText).width
        const tagW = textW + 14
        const tagH = 22
        const tagX = Math.max(contained.offsetX, Math.min(contained.offsetX + contained.drawWidth - tagW, bx - 1))
        const tagY = by >= contained.offsetY + tagH ? by - tagH : by

        ctx.fillStyle = boxColor
        ctx.fillRect(tagX, tagY, tagW, tagH)
        ctx.fillStyle = '#071019'
        ctx.fillText(labelText, tagX + 7, tagY + tagH * 0.5 + 0.5)
      }
    }

    ctx.restore()
  }
}

export function CameraViewport(props: CameraViewportProps): React.JSX.Element {
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  useEffect(() => {
    const canvas = props.canvasRef.current
    const video = props.videoRef.current
    if (!canvas || !video) return
    CanvasOverlayRenderer.render(
      canvas,
      video,
      props.filterResult,
      props.showSuppressed,
      props.mirror,
      hoveredId,
      props.showProbLabels,
      props.recognizedDetections ?? [],
    )
  }, [props.canvasRef, props.videoRef, props.filterResult, props.showSuppressed, props.mirror, hoveredId, props.showProbLabels, props.recognizedDetections])

  useEffect(() => {
    const canvas = props.canvasRef.current
    const video = props.videoRef.current
    if (!canvas || !video || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => {
      CanvasOverlayRenderer.render(
        canvas,
        video,
        props.filterResult,
        props.showSuppressed,
        props.mirror,
        hoveredId,
        props.showProbLabels,
        props.recognizedDetections ?? [],
      )
    })
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [props.canvasRef, props.videoRef, props.filterResult, props.showSuppressed, props.mirror, hoveredId, props.showProbLabels, props.recognizedDetections])

  return (
    <div className="nt-camera-frame">
      <div className="nt-camera-media">
        <video
          ref={props.videoRef}
          className="nt-video"
          playsInline
          muted
          style={{ transform: props.mirror ? 'scaleX(-1)' : 'none' }}
        />
        <canvas
          ref={props.canvasRef}
          className={props.cameraActive ? 'nt-canvas is-interactive' : 'nt-canvas'}
          style={{ cursor: hoveredId !== null && props.cameraActive ? 'pointer' : 'default' }}
          onMouseMove={(e) => {
            const canvas = props.canvasRef.current
            const video = props.videoRef.current
            if (!props.cameraActive || !canvas || !video) {
              if (hoveredId !== null) setHoveredId(null)
              return
            }
            const hit = CanvasOverlayRenderer.hitTest(
              e.clientX,
              e.clientY,
              canvas,
              video,
              props.filterResult.kept,
              props.mirror,
            )
            const nextId = hit ? hit.id : null
            if (nextId !== hoveredId) setHoveredId(nextId)
          }}
          onMouseLeave={() => {
            if (hoveredId !== null) setHoveredId(null)
          }}
          onClick={(e) => {
            const canvas = props.canvasRef.current
            const video = props.videoRef.current
            if (!props.cameraActive || !canvas || !video || !props.onSelectInstance) return
            const hit = CanvasOverlayRenderer.hitTest(
              e.clientX,
              e.clientY,
              canvas,
              video,
              props.filterResult.kept,
              props.mirror,
            )
            if (hit !== null) {
              props.onSelectInstance(hit)
            }
          }}
        />
        {!props.cameraActive ? (
          <div className="nt-camera-empty">
            <div style={{ fontSize: '18px', fontWeight: 600, color: '#f8fafc' }}>
              {props.locale.translate('camera.idleTitle')}
            </div>
            <div style={{ fontSize: '12.5px', maxWidth: '380px', lineHeight: 1.6 }}>
              {props.locale.translate('camera.idleHint')}
            </div>
            {props.cameraError ? (
              <div className="nt-banner is-error" style={{ maxWidth: '400px' }}>
                {props.cameraError}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="nt-camera-hud">
        <div className="nt-camera-hud-left">
          <CameraScopeDropdown
            collection={props.scopeCollection}
            cameraActive={props.cameraActive}
            scopeConfidenceThreshold={props.scopeConfidenceThreshold}
            onScopeConfidenceThresholdChange={props.onScopeConfidenceThresholdChange}
            locale={props.locale}
            onAdd={props.onAddScope}
            onSelect={props.onSelectScope}
            onRename={props.onRenameScope}
            onDelete={props.onDeleteScope}
          />
          <span className="nt-hud-chip">{props.locale.translate('camera.title')}</span>
        </div>
        <div className="nt-camera-hud-right">
          {props.scopeFilterBadge ? (
            <span className="nt-hud-chip nt-hud-chip-scope">{props.scopeFilterBadge}</span>
          ) : null}
          <span className="nt-hud-chip">{props.modelStatusBadge}</span>
          {props.cameraActive && props.filterResult.kept.length > 0 ? (
            <span className="nt-hud-chip">{props.locale.translate('camera.clickHint')}</span>
          ) : null}
          {props.cameraActive && props.resolution.w > 0 ? (
            <span className="nt-hud-chip">
              {props.locale.translate('camera.resolution', { w: props.resolution.w, h: props.resolution.h })}
              {' · '}
              {props.fps > 0 ? props.fps.toFixed(1) + ' FPS' : '-- FPS'}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  )
}
