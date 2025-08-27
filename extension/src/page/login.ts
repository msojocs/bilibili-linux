
import type { WebviewTag } from "electron";
import { createLogger, Logger } from "../common/log";
export const initLoginPage = () => {
  Logger.moduleName = 'Login'
  const log = createLogger('Entry')
  document.addEventListener('DOMContentLoaded', () => {
    const wvList = document.getElementsByTagName('webview')
    log.info('webview count:', wvList.length)
    if (wvList && wvList.length > 0) {
      const wv = wvList[0] as WebviewTag
      // 右键打开开发者工具
      wv.addEventListener("context-menu", () => {
        // content环境取到的webview对象没有DevTools的方法，只能额外加载
        if (wv.isDevToolsOpened()) {
          wv.closeDevTools()
        }
        else {
          wv.openDevTools()
        }
      });

    }
  })
}