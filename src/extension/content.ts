import { createLogger, Logger } from "../common/log"
import { getPageType, loadCSS, loadJS } from "./common/page"
import { registerMessageContent } from "./document/communication"

const DARK_CLASS = 'bili_dark'
const LIGHT_CLASS = 'bili_light'
const THEME_CHANGE_EVENT = 'bilibili-theme-change'
const THEME_STORAGE_KEY = 'mainWindowTheme'

const applyThemeClass = (theme: unknown) => {
	if (theme !== 'dark' && theme !== 'light') return

	const isDark = theme === 'dark'
	document.documentElement.classList.toggle(DARK_CLASS, isDark)
	document.documentElement.classList.toggle(LIGHT_CLASS, !isDark)
}

const registerThemeSync = () => {
	// Cross-origin webviews cannot read the app bridge, so reuse the last theme seen by the extension.
	chrome.storage.local.get(THEME_STORAGE_KEY, (data) => {
		applyThemeClass(data[THEME_STORAGE_KEY])
	})

	chrome.storage.onChanged.addListener((changes, areaName) => {
		if (areaName !== 'local') return
		applyThemeClass(changes[THEME_STORAGE_KEY]?.newValue)
	})

	window.addEventListener(THEME_CHANGE_EVENT, (event) => {
		const theme = (event as CustomEvent).detail
		if (theme !== 'dark' && theme !== 'light') return

		applyThemeClass(theme)
		chrome.storage.local.set({ [THEME_STORAGE_KEY]: theme })
	})
}

(() => {
  Logger.moduleName = 'Content'
  const log = createLogger('Entry')
  const pageType = getPageType()
  log.info('page:', pageType)
  registerMessageContent()
  registerThemeSync()
  {
    const url = window.chrome.runtime.getURL(`page.js`)
    loadJS(url)
  }
  {
    const url = window.chrome.runtime.getURL(`bilibili.css`)
    loadCSS(url)
  }
})()
