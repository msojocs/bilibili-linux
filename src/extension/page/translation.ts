import { languageDocument, normalizeLanguage } from '../common/translation/language'
import { createDomTranslator } from './translation/dom-translator'

let dispose: (() => void) | undefined

export function initTranslation() {
  if (dispose) return dispose
  const translator = createDomTranslator(document)
  const target = languageDocument()
  const onLanguageChange = (event: Event) => {
    translator.setLanguage(normalizeLanguage((event as CustomEvent<unknown>).detail))
  }
  target.addEventListener('changeLanguage', onLanguageChange)
  dispose = () => {
    target.removeEventListener('changeLanguage', onLanguageChange)
    window.removeEventListener('pagehide', onPageHide)
    translator.dispose()
    dispose = undefined
  }
  const onPageHide = (event: PageTransitionEvent) => {
    if (!event.persisted) dispose?.()
  }
  window.addEventListener('pagehide', onPageHide)
  return dispose
}
