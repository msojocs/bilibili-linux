import { enSimple, enRules } from './en'
import { defaultLanguage, type Language } from './language'

export interface TranslationRule {
  pattern: RegExp
  translation: string | ((parameters: Record<string, string>) => string)
}

export function translateText(source: string, language: Language): string {
  if (language === defaultLanguage) return source
  const key = source.trim()
  if (!key) return source
  let translated: string | undefined
  if (Object.hasOwn(enSimple, key)) {
    translated = enSimple[key]
  } else {
    for (const rule of enRules) {
      const match = rule.pattern.exec(key)
      if (!match) continue
      const parameters = match.groups || {}
      translated = typeof rule.translation === 'function'
        ? rule.translation(parameters)
        : rule.translation.replace(/\{(\w+)\}/g, (_placeholder, name: string) => parameters[name])
      break
    }
  }
  return translated === undefined ? source : source.replace(key, () => translated)
}
