const { app } = require('electron');

function injectExtensions(win){
  win.webContents.openDevTools();
  const path = require('path');
  app.whenReady().then(()=>{
    // const extPath = app.isPackaged ? path.join(process.resourcesPath, "extensions") : path.join(app.getAppPath(), "extensions");
    const extPath = path.join(path.dirname(app.getAppPath()), "extensions");
    console.log('----extPath----', extPath)
    win.webContents.session.loadExtension(extPath + "/area_unlimit").then(({ id }) => {
      // ...
      console.log('-----Load Extension:', id)
    })
    // 设置PAC代理脚本
    win.webContents.on('ipc-message-sync', (event, ...args)=>{
      if(args[0] === "config/roamingPAC"){
        console.log("receive config/roamingPAC: ", ...args)
        const ses = win.webContents.session
        ses.setProxy({
          mode: 'pac_script',
          pacScript: args[1],
          proxyBypassRules: '"unpkg.com"'
        }).then(res=>{
          console.log("====set proxy")
          ses.forceReloadProxyConfig().then(()=>{
            ses.resolveProxy("akamai.net").then(res=>{
              console.log("resolveProxy akamai.net --> ", res)
              event.returnValue = res.length === 0?'error':'ok'
              if(res.length === 0)
              ses.setProxy({mode:'system'})
            })

          })
        }).catch(err=>{
          console.error("====set error", err)
        })
      }
    })
  })
}