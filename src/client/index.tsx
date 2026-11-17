import type { Context } from '@deepseek-ai/cordis'
import type React from 'react'
import { LOCALE_NS, SLOT_ID } from '../invariant'
import { TranslationCatalog } from './T.js'
import { NameTagWorkspace } from './components/NameTagWorkspace'
export { FastSamInferenceEngine } from './core/FastSamInferenceEngine'
export { SplitPaneGeometry } from './components/SplitPaneDivider'
export { PreferencesStore } from './core/PreferencesStore'
export { CutoutAugmenter } from './core/CutoutAugmenter'
export { GranularitySettings, SavedPresetItem } from './core/SavedPresetModels'
export { Gemma2EmbeddingEngine, Gemma2LangChainEmbeddings } from './core/Gemma2EmbeddingEngine'
export { VectorTableFormatter } from './core/VectorTableFormatter'
export { PocketCaptureManager } from './core/PocketCaptureManager'

export const name = '@deepseek-ai/dsh-client-name-tag/client'
export const inject = ['slots', 'locale']

declare module '@deepseek-ai/cordis' {
  interface Context {
    locale?: {
      register(ns: string, dicts: Record<string, Record<string, string>>): () => void
      bind?(ns: string): (key: string, params?: Record<string, string | number>) => string
    }
    slots: {
      inject(name: string, factory: () => void | (() => void)): void
      register(
        options: {
          name: string
          id: string
          order?: number
          locale?: string
          label?: string | (() => string)
        },
        component: React.ComponentType<any>,
      ): () => void
    }
  }
}

export class NameTagClientPlugin {
  public static register(ctx: Context): void {
    ctx.effect(() => {
      if (ctx.locale) {
        return ctx.locale.register(LOCALE_NS, TranslationCatalog.getDictionaries())
      }
      return () => {}
    }, 'ui-name-tag: dictionaries')

    const boundTranslate = ctx.locale?.bind?.(LOCALE_NS)

    ctx.slots.inject('conversation.view', () =>
      ctx.slots.register(
        {
          name: 'conversation.view',
          id: SLOT_ID,
          order: 999,
          locale: LOCALE_NS,
          label: () => TranslationCatalog.translate('tab.label', boundTranslate),
        },
        NameTagWorkspace,
      ),
    )
  }
}

export function apply(ctx: Context): void {
  NameTagClientPlugin.register(ctx)
}
