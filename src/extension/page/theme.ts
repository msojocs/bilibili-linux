const DARK_CLASS = 'bili_dark'
const LIGHT_CLASS = 'bili_light'
const THEME_CHANGE_EVENT = 'bilibili-theme-change'

const readMainWindowTheme = () => {
	try {
		const bridge = window.biliBridgePc || window.biliBridge
		const theme = bridge?.callNativeSync?.('config/getMainWindowTheme')
		return typeof theme === 'string' ? theme : ''
	} catch (_error) {
		return ''
	}
}

const applyMainWindowTheme = () => {
	const theme = readMainWindowTheme()
	if (theme !== 'dark' && theme !== 'light') return

	const isDark = theme === 'dark'
	document.documentElement.classList.toggle(DARK_CLASS, isDark)
	document.documentElement.classList.toggle(LIGHT_CLASS, !isDark)
	window.dispatchEvent(new CustomEvent(THEME_CHANGE_EVENT, { detail: theme }))
}

export const initTheme = () => {
	applyMainWindowTheme()
	window.addEventListener('focus', applyMainWindowTheme)
	window.addEventListener('pageshow', applyMainWindowTheme)

	const previousDataSync = typeof window.dataSync === 'function' ? window.dataSync : undefined
	window.dataSync = (data: string) => {
		previousDataSync?.(data)
		applyMainWindowTheme()
	}
}
