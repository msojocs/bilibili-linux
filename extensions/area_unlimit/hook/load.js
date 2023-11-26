(() => {

  const url = new URL(location.href)
  let fileName = url.pathname.substring(1).split('.')[0]
  fileName = fileName.substring(fileName.lastIndexOf('/') + 1)
  console.log("[hook]: load.js", fileName)

  if (!location.href.includes('live.bilibili')) {
    if (parent?.getHookXMLHttpRequest)
      window.getHookXMLHttpRequest = parent?.getHookXMLHttpRequest
    if (window.getHookXMLHttpRequest && undefined === window.XMLHttpRequest.isHooked) {
      console.log('[hook]: load replace XMLHttpRequest')
      window.XMLHttpRequest = window.getHookXMLHttpRequest(window)
    }
  }
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

  // const loadFunc = {
  //   index: () => {
  //     getFileLink('index').then(r => {
  //
  //     })
  //   }
  // }
  // if (loadFunc[fileName]) loadFunc[fileName]()

  const loadAction = async () => {
    console.log('[hook]: loadAction')
    const win = parent || window
    if (!win.URLS) {
      win.URLS = await getData('URLS')
    }
    console.log(fileName, 'onload', win.URLS)

    if (!window.URLS)
      window.URLS = win.URLS

    {
      if (win.URLS[fileName]) {
        console.log('try to load script:', win.URLS[fileName])
        const loadJS = document.createElement('script');
        loadJS.src = win.URLS[fileName];
        (document.head || document.documentElement).appendChild(loadJS);
        // loadJS.onload = function () {
        //   loadJS.remove();
        // };
      }
      else {
        console.warn('[hook]: 未找到脚本', fileName)
      }
    }
  }
  loadAction().then(_ => { })
})()
