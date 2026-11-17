export interface CameraDeviceOption {
  readonly deviceId: string
  readonly label: string
}

/**
 * CameraController: OOP wrapper for browser WebRTC getUserMedia camera lifecycle.
 */
export class CameraController {
  private stream: MediaStream | null = null

  public static isSupported(): boolean {
    return typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia)
  }

  public static async listVideoDevices(): Promise<CameraDeviceOption[]> {
    if (!CameraController.isSupported()) return []
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      return devices
        .filter((d) => d.kind === 'videoinput')
        .map((d, idx) => ({
          deviceId: d.deviceId,
          label: d.label || 'Camera ' + (idx + 1),
        }))
    } catch {
      return []
    }
  }

  public async start(videoElement: HTMLVideoElement, deviceId?: string): Promise<MediaStream> {
    this.stop(videoElement)
    if (!CameraController.isSupported()) {
      throw new Error('MediaDevices getUserMedia is unavailable in this browser context')
    }
    const videoConstraints: MediaTrackConstraints = deviceId
      ? { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
      : { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }

    const stream = await navigator.mediaDevices.getUserMedia({
      video: videoConstraints,
      audio: false,
    })
    this.stream = stream
    videoElement.srcObject = stream
    await videoElement.play()
    return stream
  }

  public stop(videoElement?: HTMLVideoElement | null): void {
    if (this.stream !== null) {
      for (const track of this.stream.getTracks()) {
        track.stop()
      }
      this.stream = null
    }
    if (videoElement) {
      videoElement.srcObject = null
    }
  }
}
