const {protocol, ipcMain} = require('electron')
const https = require('https');
const HttpGet = (url, headers = {})=>{
  return new Promise((resolve, reject)=>{
    const u = new URL(url)
    // console.log(u)
    const options = {
      hostname: u.hostname,
      port: u.port,
      path: `${u.pathname}${u.search}`,
      method: 'GET',
      headers,
    };
    const result = []
    const req = https.request(options, res => {
      // console.log(`statusCode: ${res.statusCode}`);
      res.on('end', ()=>{
        resolve(Buffer.concat(result).toString())
      })
      res.on('data', d => {
        result.push(d)
      });
    });
    req.on('error', error => {
      // console.error(error);
      reject(error)
    });

    req.end();
  })
}

// HOOK
const {app, BrowserWindow, Menu} = require('electron');
const path = require("path");
const { Module } = require("module")

const buildFromTemplate =  Menu.buildFromTemplate
Menu.buildFromTemplate = function() {
  if (arguments[0]?.[0]?.label == '设置') {
    arguments[0]?.unshift({
      label: '首页',
      click: () => global.biliApp.configService.openMainWindowPage$.next({ page: 'Root' })
    })
    console.log('menu list:', arguments)
  }
  return buildFromTemplate.apply(this, arguments)
}

const originalBrowserWindow = BrowserWindow;

const hookBrowserWindow = (OriginalBrowserWindow) => {
  function HookedBrowserWindow(options) {
    // 修改或增加构造函数的选项
    try {
      if (options) {
        options.frame = false
        if (options.webPreferences) {
          options.webPreferences.devTools = true
        }
      }
      console.log('======HookedBrowserWindow:', options)
    }catch(e) {

    }
    // 使用修改后的选项调用原始构造函数
    return new OriginalBrowserWindow(options);
  }

  // 复制原始构造函数的原型链并进行替换
  HookedBrowserWindow.prototype = Object.create(OriginalBrowserWindow.prototype);
  HookedBrowserWindow.prototype.constructor = HookedBrowserWindow;
  Object.setPrototypeOf(HookedBrowserWindow, OriginalBrowserWindow);

  return HookedBrowserWindow;
};

// 使用替换的构造函数
const HookedBrowserWindow = hookBrowserWindow(originalBrowserWindow);

const ModuleLoadHook = {
  electron: (module) => {
    return {
      ...module,
      BrowserWindow: HookedBrowserWindow
    }
  },
}
const original_load = Module._load;
// console.log('Module:', Module)
Module._load = (...args) => {
  const loaded_module = original_load(...args);
  // console.log('load', args[0])
  if (ModuleLoadHook[args[0]]) {
    return ModuleLoadHook[args[0]](loaded_module)
  }
  else {
    return loaded_module;
  }
}

const originloadURL = BrowserWindow.prototype.loadURL;
BrowserWindow.prototype.loadURL = function(){
  this.setMinimumSize(300, 300);
  // 设置UA，有些番剧播放链接Windows会403
  this.webContents.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) bilibili_pc/1.9.1 Chrome/98.0.4758.141 Electron/17.4.11 Safari/537.36')
  console.log('=====loadURL', arguments)
  // DevTools切换
  this.webContents.on("before-input-event", (event, input) => {
    if (input.key === "F12" && input.type === "keyUp") {
      this.webContents.toggleDevTools();
    }
  });
  if(arguments[0].includes('player.html') || arguments[0].includes('index.html')){
    // this.webContents.openDevTools()
    const extPath = path.join(path.dirname(app.getAppPath()), "extensions");
    console.log('----extPath----', extPath)
    this.webContents.session.loadExtension(extPath + "/area_unlimit").then(({ id }) => {
      // ...
      console.log('-----Load Extension:', id)
    })
    // 设置PAC代理脚本
    this.webContents.on('ipc-message-sync', (event, ...args)=>{
      if(args[0] === "config/roamingPAC")
      {
        console.log("receive config/roamingPAC: ", ...args)
        const ses = this.webContents.session
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
          event.returnValue = 'error'
        })
      }
    })
  }
  originloadURL.apply(this, arguments)
};

// 从文件加载页面
const _loadFile = BrowserWindow.prototype.loadFile;
BrowserWindow.prototype.loadFile = function(...args){
  console.log('=====loadFile:', ...args)
  // DevTools切换
  this.webContents.on("before-input-event", (event, input) => {
    if (input.key === "F12" && input.type === "keyUp") {
      this.webContents.toggleDevTools();
    }
  });
  const extPath = path.join(path.dirname(app.getAppPath()), "extensions");
  console.log('extension path:', extPath)
  this.webContents.session.loadExtension(extPath + "/area_unlimit", {
    allowFileAccess: true,
  }).then(({ id }) => {
    // ...
    console.log('-----Load Extension:', id)
  }).catch((e) => {

  })
  _loadFile.apply(this, args)
  // this.loadURL('http://www.jysafe.cn')
}

/**
 * 
 * @param {string} struct
 */
const genBuffer = (struct, data) => {
  const { load } = require("protobufjs"); // respectively "./node_modules/protobufjs"
  return new Promise((resolve, reject) => {
    try {
      load(path.resolve(__dirname, './assets/protos/dynamic.proto'), function(err, root) {
        if (err)
          throw err;
    
        // example code
        const AwesomeMessage = root.lookupType(`bilibili.app.dynamic.v2.${struct}`);
    
        let message = AwesomeMessage.create(data);
        console.log(`message = ${JSON.stringify(message)}`);
    
        let buffer = AwesomeMessage.encode(message).finish();
        resolve(buffer)
        // console.log(`buffer = ${Array.prototype.toString.call(buffer)}`);
    
        // let decoded = AwesomeMessage.decode(buffer);
        // console.log(`decoded = ${JSON.stringify(decoded)}`);
      });
    }
    catch(err) {
      reject(err)
    }
  })
}
ipcMain.handle('roaming/queryDynamicDetail', (_, dynamicId, accessKey) => {
  return new Promise(async (resolve, reject) => {
    console.log('dynamic id:', dynamicId, accessKey)
    
    const path = require('path')
    /**@type {import('@grpc/grpc-js')} */
    const grpc = require("@grpc/grpc-js");
    const protoLoader = require("@grpc/proto-loader");
    const packageDefinition = protoLoader.loadSync(path.resolve(__dirname, './assets/protos/dynamic.proto'), {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    });
    var proto = grpc.loadPackageDefinition(packageDefinition).bilibili.app.dynamic.v2;

    // service: Greeter
    /**@type {import('@grpc/grpc-js').GrpcObject} */
    var client = new proto.Dynamic(
      "grpc.biliapi.net",
      grpc.credentials.createSsl()
    );
    var meta = new grpc.Metadata();
    meta.add('user-agent', 'Dalvik/2.1.0 (Linux; U; Android 10; RMX2117 Build/QP1A.190711.020) 7.61.0 os/android model/Pixel XL mobi_app/android build/7610300 channel/yingyongbao innerVer/7610310 osVer/10 network/2 grpc-java-cronet/1.36.1');
    meta.add('x-bili-gaia-vtoken', '');
    meta.add('x-bili-aurora-eid', 'UlcBQFgHB1M=');
    meta.add('x-bili-aurora-zone', '');
    meta.add('x-bili-trace-id', '344211a71a0dcf47432b69ac84666e79:432b69ac84666e79:0:0');
    meta.add('x-bili-fawkes-req-bin', Buffer.from('CglhbmRyb2lkNjQSBHByb2QaCDlhMjU2NWM2', 'base64'));

    const data = {
      access_key: accessKey,
      mobi_app: 'android',
      device: 'phone',
      build: 6830300,
      channel: 'bili',
      buvid: 'XX82B818F96FB2F312B3A1BA44DB41892FF99',
      platform: 'android',
    }
    meta.add('x-bili-metadata-bin', await genBuffer('Metadata', data));
    meta.add('authorization', `identify_v1 ${accessKey}`);
    const device = {
      mobi_app: 'android',
      device: 'phone',
      build: 6830300,
      channel: 'bili',
      buvid: 'XX82B818F96FB2F312B3A1BA44DB41892FF99',
      platform: 'android',
    }
    const d = await genBuffer('Device', device)
    console.log('Device:', d.toString('base64'))
    // 固定数据
    meta.add('x-bili-device-bin', d);
    // 固定数据
    meta.add('x-bili-network-bin', Buffer.from('CAEaBTQ2MDAx', 'base64'));
    meta.add('x-bili-restriction-bin', Buffer.from('', 'base64'));
    // 固定数据
    meta.add('x-bili-locale-bin', Buffer.from('CggKAnpoGgJDThIICgJ6aBoCQ04', 'base64'));
    meta.add('x-bili-exps-bin', Buffer.from('', 'base64'));
    meta.add('buvid', 'XX82B818F96FB2F312B3A1BA44DB41892FF99');
    // meta.add('bili-http-engine', 'cronet');
    meta.add('te', 'trailers');
    // console.log(meta)
    
    const reqData = {
      dynamic_id: `${dynamicId}`
    }
    // action: sayHello
    client.DynDetail(reqData, meta, {}, (error, value) => {
      if (error) {
        console.log(`Received error ${error}`);
        reject(error)
        return;
      }
      console.log('Response:');
      console.log(`- ${JSON.stringify(value)}`);
      resolve(value)
    })
  })
})
app.on('ready', ()=>{
  // const path = require('path');
  // const extPath = path.join(path.dirname(app.getAppPath()), "extensions");
  // session.defaultSession.loadExtension(extPath + "/area_unlimit").then(({ id }) => {
  //   // ...
  //   console.log('-----Load Extension:', id)
  // })
  // 自定义协议的具体实现
  protocol.registerStringProtocol('roaming', (req, cb) => {
    // console.log('registerHttpProtocol', req)
    HttpGet(req.url.replace('roaming', 'https'), {
      cookie: req.headers['x-cookie']
    }).then(res=>{
      cb(res)
    }).catch(err=>{
      cb({
        statusCode: 500,
        data: JSON.stringify(err)
      })
    })
  })

  protocol.registerHttpProtocol('roaming-thpic', (req, cb) => {
    cb({
      url: req.url.replace('roaming-thpic', 'https')
    })
  })

});