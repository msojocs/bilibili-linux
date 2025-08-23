/* eslint-disable @typescript-eslint/no-explicit-any */

export const loginPageInit = () => {
    const wvList = document.getElementsByTagName('webview')
    if (wvList && wvList.length > 0) {
        const wv = wvList[0] as unknown as any
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
}