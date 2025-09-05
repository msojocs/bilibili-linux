import { createLogger, Logger } from "../common/log"
import { getPageType, loadCSS, loadJS } from "./common/page"
import { registerMessageContent } from "./document/communication"

(() => {
  Logger.moduleName = 'Content'
  const log = createLogger('Entry')
  const pageType = getPageType()
  log.info('page:', pageType)
  registerMessageContent()
  {
    const url = window.chrome.runtime.getURL(`page.js`)
    loadJS(url)
  }
  {
    const url = window.chrome.runtime.getURL(`bilibili.css`)
    loadCSS(url)
  }
})()