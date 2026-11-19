export interface TimerAdapter {
  readonly setTimeout: (cb: () => void, ms: number) => unknown
  readonly clearTimeout: (handle: unknown) => void
  readonly setInterval: (cb: () => void, ms: number) => unknown
  readonly clearInterval: (handle: unknown) => void
}

/**
 * CameraTipsScheduler: Strict OOP timer coordinator for the non-dismissible
 * floating tips bubble on the top-left camera dropdown.
 * - Appears immediately when the camera starts and stays visible for 5 seconds.
 * - Re-appears every 1 minute (60s) for 5 seconds while the camera stays active.
 * - Clears all timers and hides cleanly when the camera stops or disposes.
 */
export class CameraTipsScheduler {
  public static readonly VISIBLE_DURATION_MS = 5_000
  public static readonly REPEAT_INTERVAL_MS = 60_000

  private readonly onVisibilityChange: (visible: boolean) => void
  private readonly timers: TimerAdapter
  private hideTimer: unknown = null
  private repeatTimer: unknown = null
  private active = false

  public constructor(
    onVisibilityChange: (visible: boolean) => void,
    timers?: TimerAdapter,
  ) {
    this.onVisibilityChange = onVisibilityChange
    this.timers = timers ?? CameraTipsScheduler.createDefaultTimers()
  }

  public static createDefaultTimers(): TimerAdapter {
    return {
      setTimeout: (cb, ms) => globalThis.setTimeout(cb, ms),
      clearTimeout: (handle) => globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>),
      setInterval: (cb, ms) => globalThis.setInterval(cb, ms),
      clearInterval: (handle) => globalThis.clearInterval(handle as ReturnType<typeof setInterval>),
    }
  }

  public start(): void {
    this.clearTimers()
    this.active = true
    this.triggerBurst()
    this.repeatTimer = this.timers.setInterval(() => {
      if (!this.active) return
      this.triggerBurst()
    }, CameraTipsScheduler.REPEAT_INTERVAL_MS)
  }

  public stop(): void {
    this.active = false
    this.clearTimers()
    this.onVisibilityChange(false)
  }

  public dispose(): void {
    this.stop()
  }

  private triggerBurst(): void {
    if (this.hideTimer !== null) {
      this.timers.clearTimeout(this.hideTimer)
      this.hideTimer = null
    }
    this.onVisibilityChange(true)
    this.hideTimer = this.timers.setTimeout(() => {
      this.hideTimer = null
      this.onVisibilityChange(false)
    }, CameraTipsScheduler.VISIBLE_DURATION_MS)
  }

  private clearTimers(): void {
    if (this.hideTimer !== null) {
      this.timers.clearTimeout(this.hideTimer)
      this.hideTimer = null
    }
    if (this.repeatTimer !== null) {
      this.timers.clearInterval(this.repeatTimer)
      this.repeatTimer = null
    }
  }
}