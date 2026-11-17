import { NameTagStyles } from '../S.js'

/**
 * ThemeService: OOP observer for DSH Web dark/light theme attribute.
 */
export class ThemeService {
  public static isDarkTheme(): boolean {
    if (typeof document === 'undefined') return true
    return document.body.hasAttribute('data-ds-dark-theme')
  }

  public static applyStyles(isDark: boolean): void {
    NameTagStyles.ensureInjected(isDark)
  }

  public static observeThemeChange(onChange: (isDark: boolean) => void): () => void {
    if (typeof document === 'undefined') return () => {}
    const observer = new MutationObserver(() => {
      const dark = ThemeService.isDarkTheme()
      ThemeService.applyStyles(dark)
      onChange(dark)
    })
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['data-ds-dark-theme'],
    })
    return () => observer.disconnect()
  }
}
