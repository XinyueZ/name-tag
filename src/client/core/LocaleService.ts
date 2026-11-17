import { TranslationCatalog } from '../T.js'

export type TranslateFn = (key: string, params?: Record<string, string | number>) => string

/**
 * LocaleService: OOP adapter syncing T.js dictionaries with DSH global locale.
 */
export class LocaleService {
  private readonly boundTranslate: TranslateFn | undefined

  public constructor(boundTranslate?: TranslateFn) {
    this.boundTranslate = boundTranslate
  }

  public static detectIsEnglish(): boolean {
    return TranslationCatalog.detectEnglish()
  }

  public static observeLanguageChange(onChange: (isEnglish: boolean) => void): () => void {
    if (typeof document === 'undefined') return () => {}
    const observer = new MutationObserver(() => {
      onChange(LocaleService.detectIsEnglish())
    })
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['lang'],
    })
    return () => observer.disconnect()
  }

  public translate(key: string, params?: Record<string, string | number>): string {
    return TranslationCatalog.translate(key, this.boundTranslate, params)
  }
}
