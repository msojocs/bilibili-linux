import type { WebviewTag } from 'electron'
import { createLogger, Logger } from '../../common/log'
import { requestContent } from '../document/communication'

const DEFAULT_LOGIN_TITLE = '登录-哔哩哔哩'

const LOGIN_TRANSLATIONS: Record<string, Record<string, string>> = {
	en: {
		'登录-哔哩哔哩': 'Login - Bilibili',
		'哔哩哔哩': 'Bilibili',
		'扫描二维码登录': 'Scan QR to login',
		'请使用': 'Please use',
		'哔哩哔哩客户端': 'Bilibili Client',
		'扫码登录或扫码下载APP': 'Scan to log in or download the app',
		'密码登录': 'Password Login',
		'短信登录': 'SMS Login',
		'账号登录': 'Account Login',
		'手机号': 'Phone Number',
		'手机号/邮箱': 'Phone Number / Email',
		'请输入手机号': 'Enter phone number',
		'请输入账号': 'Enter account',
		'请输入密码': 'Enter password',
		'请输入验证码': 'Enter verification code',
		'输入图片中的内容': 'Enter the text in the image',
		'获取验证码': 'Get Code',
		'验证码': 'Verification Code',
		'登录/注册': 'Log In / Sign Up',
		'登录': 'Log In',
		'注册': 'Sign Up',
		'忘记密码': 'Forgot Password',
		'二次校验': 'Secondary Verification',
		'换一张': 'Try Another',
		'取消': 'Cancel',
		'确定': 'Confirm',
		'其他方式登录': 'Other Login Methods',
		'未注册过哔哩哔哩的手机号，我们将自动帮你注册账号': 'If this phone number is not registered, we will create an account for you automatically.',
		'登录或完成注册即代表你同意': 'Logging in or completing registration means you agree to the',
		'用户协议': 'User Agreement',
		'和': 'and',
		'隐私政策': 'Privacy Policy'
	}
}

const translateLoginValue = (value: string, translations: Record<string, string>) => {
	const key = value.trim()
	const translated = translations[key]

	if (!translated) return value

	return value.replace(key, translated)
}

const buildLoginTranslationScript = (lang: string, translations: Record<string, string>) => `(${((language: string, dict: Record<string, string>) => {
	const skipTags = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT'])
	const attributes = ['placeholder', 'title', 'aria-label']
	const buildRegionTranslations = () => {
		const regionCodes = `
			AC AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ
			CA CC CD CF CG CH CI CK CL CM CN CO CP CR CU CV CW CX CY CZ DE DG DJ DK DM DO DZ EA EC EE EG EH ER ES ET EU EZ
			FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU IC ID IE IL IM IN
			IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG
			MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL
			PM PN PR PS PT PW PY QA QO RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TA TC
			TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM UN US UY UZ VA VC VE VG VI VN VU WF WS XK YE YT ZA ZM ZW
		`.trim().split(/\s+/)
		const regionTranslations: Record<string, string> = {
			'中国大陆': 'Mainland China',
			'中国香港特别行政区': 'Hong Kong SAR China',
			'中国澳门特别行政区': 'Macao SAR China',
			'中国台湾': 'Taiwan',
			'瓦利斯群岛和富图纳群岛': 'Wallis and Futuna',
			'波黑': 'Bosnia and Herzegovina',
			'印尼': 'Indonesia',
			'阿联酋': 'United Arab Emirates',
			'非洲中部': 'Central African Republic',
			'马其顿': 'North Macedonia',
			'马歇尔岛': 'Marshall Islands',
			'马提尼克岛': 'Martinique',
			'桑给巴尔岛': 'Zanzibar',
			'马里亚纳岛': 'Northern Mariana Islands',
			'福克兰岛': 'Falkland Islands',
			'瓜德罗普岛': 'Guadeloupe',
			'托克劳岛': 'Tokelau',
			'库克岛': 'Cook Islands',
			'格陵兰岛': 'Greenland',
			'蒙特塞拉特岛': 'Montserrat',
			'维珍群岛(英属)': 'British Virgin Islands',
			'维珍群岛(美属)': 'U.S. Virgin Islands',
			'特克斯和凯科斯': 'Turks and Caicos Islands',
			'百慕大群岛': 'Bermuda',
			'法罗岛': 'Faroe Islands',
			'纽埃岛': 'Niue',
			'刚果(金)': 'Congo - Kinshasa',
			'刚果': 'Congo - Brazzaville',
			'多米尼加代表': 'Dominican Republic',
			'多米尼加': 'Dominica',
			'巴哈马群岛': 'Bahamas',
			'安提瓜岛和巴布达': 'Antigua and Barbuda',
			'塞舌尔共和国': 'Seychelles',
			'迪戈加西亚岛': 'Diego Garcia',
			'聚会岛': 'Reunion',
			'维克岛': 'Wake Island',
			'萨摩亚，东部': 'American Samoa',
			'萨摩亚，西部': 'Samoa'
		}
		const intlApi = Intl as typeof Intl & {
			DisplayNames?: new (locales: string[], options: { type: 'region' }) => { of(code: string): string | undefined }
		}

		if (!intlApi.DisplayNames) return regionTranslations

		try {
			const zhNames = new intlApi.DisplayNames(['zh-Hans'], { type: 'region' })
			const enNames = new intlApi.DisplayNames(['en'], { type: 'region' })

			for (const code of regionCodes) {
				const zhName = zhNames.of(code)
				const enName = enNames.of(code)

				if (!zhName || !enName || zhName === code || enName === code) continue
				regionTranslations[zhName] = enName
			}
		}
		catch {
			return regionTranslations
		}

		return regionTranslations
	}
	const allTranslations = { ...buildRegionTranslations(), ...dict }

	const translateValue = (value: string) => {
		const key = value.trim()
		const translated = allTranslations[key]

		if (!translated) return value

		return value.replace(key, translated)
	}

	const translateTextNode = (node: Node) => {
		const value = node.nodeValue || ''
		const translated = translateValue(value)

		if (translated !== value) {
			node.nodeValue = translated
		}
	}

	const translateElement = (node: Element) => {
		if (skipTags.has(node.tagName)) return

		for (const attr of attributes) {
			const value = node.getAttribute(attr)
			if (!value) continue

			const translated = translateValue(value)
			if (translated !== value) {
				node.setAttribute(attr, translated)
			}
		}
	}

	const translateNode = (node: Node) => {
		if (node.nodeType === Node.TEXT_NODE) {
			translateTextNode(node)
			return
		}

		if (!(node instanceof Element)) return
		translateElement(node)

		// Descendant inputs keep their labels in attributes, not text nodes.
		const elementWalker = document.createTreeWalker(node, NodeFilter.SHOW_ELEMENT, {
			acceptNode(elementNode) {
				const element = elementNode as Element
				if (skipTags.has(element.tagName)) {
					return NodeFilter.FILTER_REJECT
				}

				return NodeFilter.FILTER_ACCEPT
			}
		})
		const elements: Element[] = []

		while (elementWalker.nextNode()) {
			elements.push(elementWalker.currentNode as Element)
		}

		for (const element of elements) {
			translateElement(element)
		}

		const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, {
			acceptNode(textNode) {
				const parent = textNode.parentElement
				if (!parent || skipTags.has(parent.tagName)) {
					return NodeFilter.FILTER_REJECT
				}

				return NodeFilter.FILTER_ACCEPT
			}
		})
		const textNodes: Node[] = []

		while (walker.nextNode()) {
			textNodes.push(walker.currentNode)
		}

		for (const textNode of textNodes) {
			translateTextNode(textNode)
		}
	}

	document.documentElement.setAttribute('lang', language)
	document.body?.setAttribute('lang', language)
	document.title = translateValue(document.title)
	translateNode(document.body || document.documentElement)

	const state = window as Window & { __biliLoginTranslationObserver?: MutationObserver }
	state.__biliLoginTranslationObserver?.disconnect()
	state.__biliLoginTranslationObserver = new MutationObserver((mutations) => {
		for (const mutation of mutations) {
			if (mutation.type === 'childList') {
				for (const node of mutation.addedNodes) {
					translateNode(node)
				}
				continue
			}

			translateNode(mutation.target)
		}
	})
	state.__biliLoginTranslationObserver.observe(document.body || document.documentElement, {
		attributeFilter: attributes,
		attributes: true,
		characterData: true,
		childList: true,
		subtree: true
	})
}).toString()})(${JSON.stringify(lang)}, ${JSON.stringify(translations)})`

export const initLoginPage = () => {
	Logger.moduleName = 'Login'
	const log = createLogger('Entry')

	const bindLoginWebview = () => {
		const wvList = document.getElementsByTagName('webview')
		log.info('webview count:', wvList.length)
		if (!wvList || wvList.length === 0) return

		const wv = wvList[0] as WebviewTag

		const applyWebviewLanguage = async () => {
			try {
				const lang = await requestContent<string, {key: string}>('getStorage', { key: 'lang' }) || 'zhCn'
				const translations = LOGIN_TRANSLATIONS[lang]

				if (!translations) {
					document.title = DEFAULT_LOGIN_TITLE
					return
				}

				document.title = translateLoginValue(document.title, translations)

				// The login webview does not run the shared page translator.
				await wv.executeJavaScript(buildLoginTranslationScript(lang, translations))
			}
			catch (error) {
				log.warn('Failed to apply login webview language:', error)
			}
		}

		wv.addEventListener('dom-ready', applyWebviewLanguage)
		void applyWebviewLanguage()

		document.addEventListener('changeLanguage', () => {
			void applyWebviewLanguage()
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
