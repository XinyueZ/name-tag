import type { BoundingBox } from '../../invariant'

export type AugmentationKind = 'original' | 'flip' | 'scale' | 'color' | 'rotate' | 'blur'

export interface CutoutPreviewItem {
  readonly kind: AugmentationKind
  readonly dataUrl: string
  readonly width: number
  readonly height: number
}

/**
 * CutoutAugmenter: OOP image-processing pipeline extracting clean transparent RGBA cutouts
 * from segmented video frames and synthesizing 5 CLIP/Embedding-ready augmentations.
 */
export class CutoutAugmenter {
  private static readonly MAX_PREVIEW_DIM = 360
  private static readonly ROTATE_DEG = 8
  private static readonly ZOOM_SCALE = 1.16
  private static readonly BLUR_PX = 1.6

  public static captureVideoFrame(video: HTMLVideoElement): HTMLCanvasElement {
    const w = Math.max(1, video.videoWidth)
    const h = Math.max(1, video.videoHeight)
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (ctx === null) {
      throw new Error('Failed to acquire 2D canvas context for frame capture')
    }
    ctx.drawImage(video, 0, 0, w, h)
    return canvas
  }

  public static computeCropBounds(
    instance: BoundingBox,
    frameW: number,
    frameH: number,
    padRatio = 0.04,
  ): { readonly x: number; readonly y: number; readonly w: number; readonly h: number } {
    const bw = Math.max(4, instance.x2 - instance.x1)
    const bh = Math.max(4, instance.y2 - instance.y1)
    const padX = Math.round(bw * padRatio)
    const padY = Math.round(bh * padRatio)
    const x1 = Math.max(0, Math.floor(instance.x1 - padX))
    const y1 = Math.max(0, Math.floor(instance.y1 - padY))
    const x2 = Math.min(frameW, Math.ceil(instance.x2 + padX))
    const y2 = Math.min(frameH, Math.ceil(instance.y2 + padY))
    return {
      x: x1,
      y: y1,
      w: Math.max(4, x2 - x1),
      h: Math.max(4, y2 - y1),
    }
  }

  private static buildAlphaMaskCanvas(
    instance: BoundingBox,
    frameW: number,
    frameH: number,
    crop: { readonly x: number; readonly y: number; readonly w: number; readonly h: number },
    outW: number,
    outH: number,
  ): HTMLCanvasElement | null {
    const mData = instance.maskData
    const mW = instance.maskWidth
    const mH = instance.maskHeight
    if (mData === undefined || mW === undefined || mH === undefined || mW <= 0 || mH <= 0) {
      return null
    }

    // 1. Paint binary prototype mask onto low-res mask canvas
    const lowCanvas = document.createElement('canvas')
    lowCanvas.width = mW
    lowCanvas.height = mH
    const lowCtx = lowCanvas.getContext('2d')
    if (lowCtx === null) return null
    const lowImg = lowCtx.createImageData(mW, mH)
    for (let i = 0; i < mData.length; i += 1) {
      if (mData[i] !== 0) {
        const p = i * 4
        lowImg.data[p] = 255
        lowImg.data[p + 1] = 255
        lowImg.data[p + 2] = 255
        lowImg.data[p + 3] = 255
      }
    }
    lowCtx.putImageData(lowImg, 0, 0)

    // 2. Smoothly sample the exact crop region onto high-res mask canvas
    const hiCanvas = document.createElement('canvas')
    hiCanvas.width = outW
    hiCanvas.height = outH
    const hiCtx = hiCanvas.getContext('2d', { willReadFrequently: true })
    if (hiCtx === null) return null
    hiCtx.imageSmoothingEnabled = true
    hiCtx.imageSmoothingQuality = 'high'
    const sx = (crop.x / Math.max(1, frameW)) * mW
    const sy = (crop.y / Math.max(1, frameH)) * mH
    const sw = Math.max(0.5, (crop.w / Math.max(1, frameW)) * mW)
    const sh = Math.max(0.5, (crop.h / Math.max(1, frameH)) * mH)
    hiCtx.drawImage(lowCanvas, sx, sy, sw, sh, 0, 0, outW, outH)

    // 3. Apply crisp soft-threshold ramp on alpha channel so background halo stays transparent
    const hiImg = hiCtx.getImageData(0, 0, outW, outH)
    const d = hiImg.data
    for (let i = 3; i < d.length; i += 4) {
      const a = d[i]
      if (a <= 96) {
        d[i] = 0
      } else if (a >= 192) {
        d[i] = 255
      } else {
        d[i] = Math.round(((a - 96) / 96) * 255)
      }
    }
    hiCtx.putImageData(hiImg, 0, 0)
    return hiCanvas
  }

  public static extractRawBboxCrop(
    frameCanvas: HTMLCanvasElement,
    instance: BoundingBox,
  ): HTMLCanvasElement {
    const frameW = frameCanvas.width
    const frameH = frameCanvas.height
    const crop = CutoutAugmenter.computeCropBounds(instance, frameW, frameH, 0.04)
    const scale = Math.min(1, CutoutAugmenter.MAX_PREVIEW_DIM / Math.max(crop.w, crop.h))
    const outW = Math.max(8, Math.round(crop.w * scale))
    const outH = Math.max(8, Math.round(crop.h * scale))

    const out = document.createElement('canvas')
    out.width = outW
    out.height = outH
    const ctx = out.getContext('2d')
    if (ctx === null) {
      throw new Error('Failed to acquire 2D canvas context for raw bbox crop')
    }
    ctx.drawImage(frameCanvas, crop.x, crop.y, crop.w, crop.h, 0, 0, outW, outH)
    return out
  }

  public static extractTransparentCutout(
    frameCanvas: HTMLCanvasElement,
    instance: BoundingBox,
  ): HTMLCanvasElement {
    const frameW = frameCanvas.width
    const frameH = frameCanvas.height
    const crop = CutoutAugmenter.computeCropBounds(instance, frameW, frameH, 0.04)
    const scale = Math.min(1, CutoutAugmenter.MAX_PREVIEW_DIM / Math.max(crop.w, crop.h))
    const outW = Math.max(8, Math.round(crop.w * scale))
    const outH = Math.max(8, Math.round(crop.h * scale))

    const cutout = document.createElement('canvas')
    cutout.width = outW
    cutout.height = outH
    const ctx = cutout.getContext('2d')
    if (ctx === null) {
      throw new Error('Failed to acquire 2D canvas context for transparent cutout')
    }

    ctx.clearRect(0, 0, outW, outH)
    ctx.drawImage(frameCanvas, crop.x, crop.y, crop.w, crop.h, 0, 0, outW, outH)

    const alphaMask = CutoutAugmenter.buildAlphaMaskCanvas(instance, frameW, frameH, crop, outW, outH)
    if (alphaMask !== null) {
      ctx.save()
      ctx.globalCompositeOperation = 'destination-in'
      ctx.drawImage(alphaMask, 0, 0, outW, outH)
      ctx.restore()
    }
    return cutout
  }

  private static createBlankCanvas(w: number, h: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (ctx === null) {
      throw new Error('Failed to create 2D canvas context for augmentation')
    }
    ctx.clearRect(0, 0, w, h)
    return { canvas, ctx }
  }

  private static applyColorJitterFallback(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const img = ctx.getImageData(0, 0, w, h)
    const d = img.data
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] === 0) continue
      // Subtle contrast + warm exposure boost preserving transparent alpha=0 pixels
      d[i] = Math.min(255, Math.max(0, Math.round((d[i] - 128) * 1.12 + 128 + 14)))
      d[i + 1] = Math.min(255, Math.max(0, Math.round((d[i + 1] - 128) * 1.12 + 128 + 10)))
      d[i + 2] = Math.min(255, Math.max(0, Math.round((d[i + 2] - 128) * 1.12 + 128 + 4)))
    }
    ctx.putImageData(img, 0, 0)
  }

  private static applyGaussianBlurFallback(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const src = ctx.getImageData(0, 0, w, h)
    const dst = ctx.createImageData(w, h)
    const sd = src.data
    const dd = dst.data
    const kernel = [1, 4, 6, 4, 1]
    const kSum = 16
    const tmp = new Float32Array(w * h * 4)

    // Separable horizontal pass (premultiplied-alpha safe)
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        let r = 0
        let g = 0
        let b = 0
        let a = 0
        for (let k = -2; k <= 2; k += 1) {
          const sx = Math.min(w - 1, Math.max(0, x + k))
          const weight = kernel[k + 2]
          const p = (y * w + sx) * 4
          const alpha = sd[p + 3] / 255
          r += sd[p] * alpha * weight
          g += sd[p + 1] * alpha * weight
          b += sd[p + 2] * alpha * weight
          a += sd[p + 3] * weight
        }
        const op = (y * w + x) * 4
        tmp[op] = r / kSum
        tmp[op + 1] = g / kSum
        tmp[op + 2] = b / kSum
        tmp[op + 3] = a / kSum
      }
    }

    // Separable vertical pass
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        let r = 0
        let g = 0
        let b = 0
        let a = 0
        for (let k = -2; k <= 2; k += 1) {
          const sy = Math.min(h - 1, Math.max(0, y + k))
          const weight = kernel[k + 2]
          const p = (sy * w + x) * 4
          r += tmp[p] * weight
          g += tmp[p + 1] * weight
          b += tmp[p + 2] * weight
          a += tmp[p + 3] * weight
        }
        const dp = (y * w + x) * 4
        const outA = a / kSum
        if (outA > 1) {
          const norm = 255 / outA
          dd[dp] = Math.min(255, Math.round((r / kSum) * norm))
          dd[dp + 1] = Math.min(255, Math.round((g / kSum) * norm))
          dd[dp + 2] = Math.min(255, Math.round((b / kSum) * norm))
          dd[dp + 3] = Math.min(255, Math.round(outA))
        }
      }
    }
    ctx.putImageData(dst, 0, 0)
  }

  private static supportsCanvasFilter(ctx: CanvasRenderingContext2D): boolean {
    return typeof ctx.filter === 'string'
  }

  public static generateAugmentations(cutout: HTMLCanvasElement): CutoutPreviewItem[] {
    const w = cutout.width
    const h = cutout.height
    const results: CutoutPreviewItem[] = []

    // 1. Original transparent cutout
    results.push({
      kind: 'original',
      dataUrl: cutout.toDataURL('image/png'),
      width: w,
      height: h,
    })

    // 2. Horizontal Flip
    {
      const { canvas, ctx } = CutoutAugmenter.createBlankCanvas(w, h)
      ctx.save()
      ctx.translate(w, 0)
      ctx.scale(-1, 1)
      ctx.drawImage(cutout, 0, 0)
      ctx.restore()
      results.push({ kind: 'flip', dataUrl: canvas.toDataURL('image/png'), width: w, height: h })
    }

    // 3. Scale / Multi-Crop (zoom in keeping background transparent)
    {
      const { canvas, ctx } = CutoutAugmenter.createBlankCanvas(w, h)
      const sw = w / CutoutAugmenter.ZOOM_SCALE
      const sh = h / CutoutAugmenter.ZOOM_SCALE
      const sx = (w - sw) * 0.5
      const sy = (h - sh) * 0.5
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(cutout, sx, sy, sw, sh, 0, 0, w, h)
      results.push({ kind: 'scale', dataUrl: canvas.toDataURL('image/png'), width: w, height: h })
    }

    // 4. Color / Exposure Jitter (background remains alpha = 0)
    {
      const { canvas, ctx } = CutoutAugmenter.createBlankCanvas(w, h)
      if (CutoutAugmenter.supportsCanvasFilter(ctx)) {
        ctx.filter = 'brightness(1.12) contrast(1.08) saturate(1.18)'
        ctx.drawImage(cutout, 0, 0)
        ctx.filter = 'none'
      } else {
        ctx.drawImage(cutout, 0, 0)
        CutoutAugmenter.applyColorJitterFallback(ctx, w, h)
      }
      results.push({ kind: 'color', dataUrl: canvas.toDataURL('image/png'), width: w, height: h })
    }

    // 5. Slight Rotation (+8 deg around center on transparent background)
    {
      const { canvas, ctx } = CutoutAugmenter.createBlankCanvas(w, h)
      const rad = (CutoutAugmenter.ROTATE_DEG * Math.PI) / 180
      const fitScale = 0.92
      ctx.save()
      ctx.translate(w * 0.5, h * 0.5)
      ctx.rotate(rad)
      ctx.scale(fitScale, fitScale)
      ctx.drawImage(cutout, -w * 0.5, -h * 0.5)
      ctx.restore()
      results.push({ kind: 'rotate', dataUrl: canvas.toDataURL('image/png'), width: w, height: h })
    }

    // 6. Slight Gaussian Blur (background remains alpha = 0)
    {
      const { canvas, ctx } = CutoutAugmenter.createBlankCanvas(w, h)
      if (CutoutAugmenter.supportsCanvasFilter(ctx)) {
        ctx.filter = 'blur(' + CutoutAugmenter.BLUR_PX + 'px)'
        ctx.drawImage(cutout, 0, 0)
        ctx.filter = 'none'
      } else {
        ctx.drawImage(cutout, 0, 0)
        CutoutAugmenter.applyGaussianBlurFallback(ctx, w, h)
      }
      results.push({ kind: 'blur', dataUrl: canvas.toDataURL('image/png'), width: w, height: h })
    }

    return results
  }
}
