import type { WebviewTag } from 'electron'
import { createLogger, Logger } from '../../common/log'
import darkLoginCss from './login-dark.css?raw'

const DARK_CLASS = 'bili_dark'

export const initLoginPage = () => {
	Logger.moduleName = 'Login'
	const log = createLogger('Entry')

	const bindLoginWebview = () => {
		const wvList = document.getElementsByTagName('webview')
		log.info('webview count:', wvList.length)
		if (!wvList || wvList.length === 0) return

		const wv = wvList[0] as WebviewTag
		let darkCssKey: string | undefined

		const applyWebviewTheme = async () => {
			try {
				if (darkCssKey) {
					await wv.removeInsertedCSS(darkCssKey).catch(() => undefined)
					darkCssKey = undefined
				}

				if (document.documentElement.classList.contains(DARK_CLASS)) {
					darkCssKey = await wv.insertCSS(darkLoginCss)
				}
			}
			catch (error) {
				log.warn('Failed to apply login webview theme:', error)
			}
		}

		wv.addEventListener('dom-ready', applyWebviewTheme)
		void applyWebviewTheme()

		const themeObserver = new MutationObserver(applyWebviewTheme)
		themeObserver.observe(document.documentElement, {
			attributeFilter: ['class'],
			attributes: true
		})

		// Open or close DevTools from the webview context menu.
		wv.addEventListener('context-menu', () => {
			// The content context cannot access DevTools APIs, so the host page handles it.
			if (wv.isDevToolsOpened()) {
				wv.closeDevTools()
			}
			else {
				wv.openDevTools()
			}
		})
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', bindLoginWebview)
	}
	else {
		bindLoginWebview()
	}
}
