import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { defaultLanguage } from '../common/translation/language'
import en from './locales/en'

void i18n.use(initReactI18next).init({
  resources: {
    en: { extension: en },
    'zh-CN': { extension: {} },
  },
  defaultNS: 'extension',
  lng: defaultLanguage,
  fallbackLng: defaultLanguage,
  supportedLngs: ['zh-CN', 'en'],
  keySeparator: false,
  nsSeparator: false,
  initImmediate: false,
  interpolation: { escapeValue: false },
})

export default i18n
