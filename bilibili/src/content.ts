import { createLogger, Logger } from "./common/log"
import { getPageType, loadJS } from "./common/page"

(() => {
  Logger.moduleName = 'Content'
  const log = createLogger('Entry')
  const pageType = getPageType()
  log.info('page:', pageType)
  const url = window.chrome.runtime.getURL(`page.js`)
  loadJS(url)
})()