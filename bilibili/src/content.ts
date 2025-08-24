import { createLogger } from "./common/log"
import { getPageType, loadJS } from "./common/page"

(() => {
    const log = createLogger('Content')
    const pageType = getPageType()
    log.info('page:', pageType)
    const url = window.chrome.runtime.getURL(`page/${pageType}.js`)
    loadJS(url)
})()