
import type { WebviewTag } from "electron";
import { createLogger } from "../common/log";
export const loginPageInit = () => {
    const log = createLogger('Login')
    document.addEventListener('DOMContentLoaded', () => {
        const wvList = document.getElementsByTagName('webview')
        log.info('webview count:', wvList.length)
        if (wvList && wvList.length > 0) {
            const wv = wvList[0] as WebviewTag
            // 右键打开开发者工具
            wv.addEventListener("context-menu", () => {
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