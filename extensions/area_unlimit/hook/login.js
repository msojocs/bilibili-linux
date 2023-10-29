console.log('[hook] login.js')

const getData = (name) => {
  return new Promise((resolve, reject) => {
    document.addEventListener('ROAMING_sendURL', async function (e) {
      // e.detail contains the transferred data (can be anything, ranging
      // from JavaScript objects to strings).
      // Do something, for example:
      console.log('player ROAMING_sendURL: ', e.detail);
      document.removeEventListener('ROAMING_sendURL', this)
      if (e.detail)
        resolve(e.detail)
      else
        reject(e)
    });
    document.dispatchEvent(new CustomEvent('ROAMING_getURL', {
      detail: name // Some variable from Gmail.
    }));
  })
}

const wvList = document.getElementsByTagName('webview')
if (wvList && wvList.length > 0) {
  const wv = wvList[0]
  // 右键打开开发者工具
  wv.addEventListener("context-menu", (params) => {
    console.log('params:', params)
    if (wv.isDevToolsOpened()) {
      wv.closeDevTools()
    }
    else {
      wv.openDevTools()
    }
  });

  // 注入
  wv.addEventListener('did-finish-load', (e) => {
    console.log('did-finish-load:', e)
    ;(async() => {
      const commonJSUrl = await getData('commonJS')
      console.log('commonJSUrl:', commonJSUrl)
      const commonJS = await HTTP.get(commonJSUrl)
      // console.log('js:', commonJS.responseText)
      wv.executeJavaScript(commonJS.responseText)
    })()
  })
}
