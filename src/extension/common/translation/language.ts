export type Language = 'zh-CN' | 'en'

export const defaultLanguage: Language = 'zh-CN'

export function normalizeLanguage(value: unknown): Language {
  if (typeof value === 'string' && /^en(?:[-_]|$)/i.test(value)) return 'en'
  return defaultLanguage
}

export function languageDocument(): Document {
  try {
    return window.parent.document
  } catch {
    return document
  }
}
