(() => {

  const url = new URL(location.href)
  const fileName = url.pathname.substring(1).split('.')[0]
  console.log("[hook]: load.js", fileName)

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
        loadJS.onload = function () {
          loadJS.remove();
        };
      }
      else {
        console.warn('[hook]: 未找到脚本', fileName)
      }
    }
    {
      const list = document.querySelectorAll('iframe')
      console.log(window)
      console.log('[hook]:', `${fileName} 下的iframe数量：${list.length}`, document)
      for (const item of list) {
        console.log('[hook]: 给元素添加load脚本', item.id, `link->${item.src}<-`, item)
        const w = item.contentWindow
        const insertLoad = () => {
          console.log('插入load脚本')
          const loadJS = w.document.createElement('script');
          loadJS.src = win.URLS.load;
          (w.document.head || w.document.documentElement).appendChild(loadJS);
          loadJS.onload = () => {
            console.log(w.document.querySelectorAll('iframe'))
          }
          item.removeEventListener('load', insertLoad)
        }
        if (w.document.readyState === 'complete' || w.document.readyState === 'interactive') {
          console.log('iframe已经加载完成')
          insertLoad()
        }
        else {
          console.log('iframe未加载完', w.document.readyState)
          item.addEventListener('load', insertLoad)
        }
      }
    }

  }
  let interval = setInterval(() => {
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      // 渲染完成
      console.log('[hook]: 渲染完成，直接执行')
      // loadAction().then(_ => {})
      loadAction().then(_ => {})
      clearInterval(interval)
    }
    else {
      console.log('[hook]: 渲染未完成，监听执行', performance, performance.now(), performance.timing.domComplete, new Date(performance.timing.domComplete))
    }
  }, 500)
})()