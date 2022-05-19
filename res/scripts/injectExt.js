// 简易代理服务器，用于东南亚图片
const net = require('net')
const serverPort = 22332
// 有请求就创建一个tcp链接
net.createServer(client => {
  client.on('error', error => console.error('client', error))
  client.on('data', req => {
    // 请求的处理
    let content = req.toString()
    content = content.replace('localhost:' + serverPort, 'pic.bstarstatic.com')
    //  除掉referer
    content = content.replace(/Referer:.*?\r\n/, '')
    //  console.log('req: ', content)
    // 创建与b服务的链接
    const bServer = new net.Socket()
    bServer.connect(80, 'pic.bstarstatic.com')
    bServer.on('error', error => console.error('bSserve', error))
    // 把请求发送给b服务器
    bServer.write(content)
    bServer.on('data', res => {
      // 响应的处理
      const content = res.toString()
      //  console.log('resp: ', content)
      // 把响应发送给客户端
      client.write(res)
    })
  })
}).listen(serverPort)

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
          pacScript: args[1]
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