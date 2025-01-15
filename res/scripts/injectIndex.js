const {app, protocol, ipcMain, BrowserWindow, Menu} = require('electron');
const EventEmitter = require('events');
const https = require('https');
const path = require('path');
const fs = require('fs')
const { Module } = require("module");

//#region flags 解析
try {
  const userDataPath = app.getPath("userData")
  const flagPath = `${userDataPath}/bilibili-flags.conf`
  console.log('flagPath:', flagPath)
  if (fs.existsSync(flagPath) && fs.statSync(flagPath).isFile()) {
    const flagData = fs.readFileSync(flagPath).toString()
    const flags = flagData.split('\n').filter(e => e && e.length > 0)
    for (let flag of flags) {
      if (flag.startsWith('--'))
        flag = flag.substring(2)

      const kv = flag.split('=')
      if (kv.length > 1) {
        console.log('append flag:', `${kv[0]}=${kv[1]}`)
        app.commandLine.appendSwitch(kv[0], kv[1])
      }else {
        console.log('append flag:', kv[0])
        app.commandLine.appendArgument(kv[0])
      }
    }
  }
} catch (error) {
  console.error('flag 解析失败', error)
}
//#endregion flags 解析

const pkgHack = {
  idx: 0,
  data: [
    true,
    true,
    true,  // .biliapp
    true,
    false,
    true,
  ]
}
Object.defineProperty(app, 'isPackaged', {
  get() {
    let ret = pkgHack.data[pkgHack.idx++]
    if (ret === undefined) ret = true;
    console.log("get isPackaged", ret)
    return ret;
  },

});
global.isFiredByEntry = true
global.bootstrapEvents = new EventEmitter()
// create app server
{
  // 创建https服务器
  const server = https.createServer({
    key: "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC19oO8fx2YxkOt\nGoeqffhsXRfFvq/mhkA+9cp+NfV+TaKs8Ap7n3w2I97JwYUbtKYIfL+z/1GHOS5f\np8kJaVcFMxx8iowW5/bitReeHC1T+MCqOynrXfhU54DNJVkGhXsWAxwAoHzDVUh9\nax248EWJR3wrTVuCIK3NM1iFs2KItQNa9CcyLtzXsHfKifGu0Se7aDJNIVR3R4B4\nQtvFzbEfLr3kvq0QGAnBeZ00blPE19lB4dIHi4aPeQz5H0bySpvmCW7rDaoCsoJ0\nwv/MtZanZjORephlY3E7lziUpL1toF4qowB5Ogb20+r8Vwkc3ONgjMpOmH3ze6ki\n+WXPEFNTAgMBAAECggEBAJjgXPvAPIh/gppr4LFwFohMik18EOL3xgBfltoE0ZVk\n+pibL+N/Med2qZYOfZuyYZBd5t3+U2vtsbVyDShYFWFr+LH14Q7ZooYEKayP9dFH\n++7JuEVj9OC4g3FXwH0HJktvH1azfz7JZxbgKN+ZFoLoyTzESG6CsCLn0aa6+Lzr\nFRPqLM8TRZKjfl5dYy6z8nEVWWA+ow1MTsaEq0aNpeBsYePjz/181jpQV5OrQe/+\nl/LqzUU53iSOU1ZAoruhzeJ0/aGfYjG/QdphNWuK6a2590kETxWoDiz7Z1m82Vx6\n1FrOY5Dr8/+dzgFLdrQkKz+DGpUlnnA+6wGw6K7MlUECgYEA2QfmC8AoHf5Du4K/\nS6JpnczvqxwTEXPMKwMNDRAxXmXyvi2PszkpLGwvP2pZYlK6D20FtOW1uVtp5jiN\nyQ0J42P83KlYQeBNvV7flgSZW7ImO8u5JO8UybbNelu+B/OKqSR9ZoHXZRzG4bYU\nlaKQxIoXG6l7IieDN0TLPgv6EfMCgYEA1qKsuh+M61EFSosIPb5fhvg/2/TeizDm\nZRvG8Zju/e6tikewGW0XLRVb1trSBFu6Ijf41QsTZRxh37FjYRPN/XF6sRHpr3Ni\nRmaQch+0BcQaU4v+WSbCnGR9nyi3O8hCPC713UrusNfokXRf6z5ARtLvDwfBU2tQ\nDCLtMmypsSECgYEAqm/chj/agWtrr7cHGZOrU8RcN0kt5FfG78ROnIKp8pMnZZiM\nMFhkcEFpfWi8V03WVkTs5Vo8MxuJ98VT+57ktBGSw4uuBtXq1xvJhJuKAAvQoMbl\nWA71iU+o4D1p5/6nVxuT60tuZzaJLTp7weNPwzka2ptnWrQjBOVeoxRux2cCgYAD\n7u09Z/CcK1rud8fJ4eA8R/ZboIwnftjqB21I5iWTD7msbA3lGWOwVtDdChuJKukp\nUV9FADP1yWRdxhFtKQDAYUD/V7Wxmmq1oZGKFdylsmdNGqapmZU9anYG4ach+FSG\nZ9HnoUTohrxjVf+f/v8MjTcGTn0Te0b3QfiY0Pb3IQKBgFhRUMasW/MnIFg1IfYU\nkVtMEJpajml9tEEQ91bBr29bCxl+nM2bM9yjb6LQU0vYTyWNn3zS/LOa3gSbOC/i\nc+3fmiI6TpouNE1eBva6kKyvmqC4dwD6aTEHokfhuMFYZQbVC8IGuhEQuN9OIM9x\nTQg6mubcOzaGBUeTmeZTkCpb\n-----END PRIVATE KEY-----\n",
    cert: "-----BEGIN CERTIFICATE-----\nMIIEPzCCAyegAwIBAgIUJVg1qdKcUuryV+2IxAn9teS5qu0wDQYJKoZIhvcNAQEL\nBQAwga0xCzAJBgNVBAYTAkNOMREwDwYDVQQIDAhTaGFuZ0hhaTERMA8GA1UEBwwI\nU2hhbmdIYWkxLzAtBgNVBAoMJlNoYW5naGFpIEJpbGliaWxpIFRlY2hub2xvZ3kg\nQ28uLCBMdGQuMREwDwYDVQQLDAhiaWxpYmlsaTEPMA0GA1UEAwwGYmlsaXBjMSMw\nIQYJKoZIhvcNAQkBFhRzaGVudGFvQGJpbGliaWxpLmNvbTAgFw0yMzEwMjQwNTIy\nMTNaGA8yMTIzMDkzMDA1MjIxM1owga0xCzAJBgNVBAYTAkNOMREwDwYDVQQIDAhT\naGFuZ0hhaTERMA8GA1UEBwwIU2hhbmdIYWkxLzAtBgNVBAoMJlNoYW5naGFpIEJp\nbGliaWxpIFRlY2hub2xvZ3kgQ28uLCBMdGQuMREwDwYDVQQLDAhiaWxpYmlsaTEP\nMA0GA1UEAwwGYmlsaXBjMSMwIQYJKoZIhvcNAQkBFhRzaGVudGFvQGJpbGliaWxp\nLmNvbTCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBALX2g7x/HZjGQ60a\nh6p9+GxdF8W+r+aGQD71yn419X5NoqzwCnuffDYj3snBhRu0pgh8v7P/UYc5Ll+n\nyQlpVwUzHHyKjBbn9uK1F54cLVP4wKo7Ketd+FTngM0lWQaFexYDHACgfMNVSH1r\nHbjwRYlHfCtNW4Igrc0zWIWzYoi1A1r0JzIu3Newd8qJ8a7RJ7toMk0hVHdHgHhC\n28XNsR8uveS+rRAYCcF5nTRuU8TX2UHh0geLho95DPkfRvJKm+YJbusNqgKygnTC\n/8y1lqdmM5F6mGVjcTuXOJSkvW2gXiqjAHk6BvbT6vxXCRzc42CMyk6YffN7qSL5\nZc8QU1MCAwEAAaNTMFEwHQYDVR0OBBYEFNCVw8dStnHz5VY1MEIDI8dPR9t2MB8G\nA1UdIwQYMBaAFNCVw8dStnHz5VY1MEIDI8dPR9t2MA8GA1UdEwEB/wQFMAMBAf8w\nDQYJKoZIhvcNAQELBQADggEBAAiisyz9WJNmyYthp7hRHxt8ptV8UefFOVt1oJfE\nuicHBoXBCWKOb2sYbJUOnpPQrCGTLxa0sDUXu1OvwJP2YrKhbiW4ZLefWlVM/Rx0\nJpcbbVvrR5puMfwxKrW5HT+Uafq/bFe/fJPTdHmLU9vAqkAcqZxrPhNjz1O88wp4\ntuyLcVxHcwr4ZvHFcCMo+Gkph76QY8clcOtyTF3p3U2HCFGu3I8WvJcEexjjanx6\nztZgsc9zCVdDWS5RFsEMXPj9+vTvLuo1S6z0UhMnKo4yYBCb/6gmJRJMrZ7beifP\niVFRvhO43BAkKW04hRC/nsliqcedqetuZbpTjq98g9eEDow=\n-----END CERTIFICATE-----\n"
  }, (req, res) => {
    const renderPath = path.resolve(__dirname, './render')
    const url = req.url.split('?')[0]
    const p = path.resolve(renderPath, `.${url}`)
    console.log(url)
    if (url.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8')
    }
    res.writeHead(200)
    res.write(fs.readFileSync(p))
    res.end()
  })
  server.listen(3031)
  app.commandLine.appendSwitch('host-rules', 'MAP bilipc.bilibili.com localhost:3031')
}
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

if (process.env.XDG_SESSION_TYPE === 'wayland' || process.env.WAYLAND_DISPLAY) {
  const _setAlwaysOnTop = BrowserWindow.prototype.setAlwaysOnTop;
  const key = '[Wayland置顶]'
  BrowserWindow.prototype.setAlwaysOnTop = function(...args) {
    let title = this.getTitle()
    if (args[0] && !title.startsWith(key)) {
      // 置顶
      title = `${key}${title}`
      this.setTitle(title)
    }
    else if(!args[0] && title.startsWith(key))
    {
      title = title.replace(key, '')
      this.setTitle(title)
    }
    return _setAlwaysOnTop.apply(this, args)
  }
}

// hook loadURL
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

// hook loadFile
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
      grpc.credentials.createSsl(),
      {
        'grpc.primary_user_agent': 'Dalvik/2.1.0 (Linux; U; Android 10; RMX2117 Build/QP1A.190711.020) 7.61.0 os/android model/Pixel XL mobi_app/android build/7610300 channel/yingyongbao innerVer/7610310 osVer/10 network/2 grpc-java-cronet/1.36.1'
      }
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
{
  // 处理启动缓慢的问题
  ipcMain.on('app/getTheme', (event, data) => {
    // 在这里处理数据，然后通过 event.returnValue 发送返回值
    console.info('app/getTheme')
    event.returnValue = 'simple'
  })
  ipcMain.on('app/mainProcessReady', (event, data) => {
    // 在这里处理数据，然后通过 event.returnValue 发送返回值
    console.info('app/mainProcessReady')
    event.returnValue = true
  })
  // const originalOn = ipcMain.on
  // ipcMain.on = function(...args) {
  //   console.info('on:', ...args)
  //   if (args[0] === 'app/getTheme')
  //   {
  //     debugger
  //   }
  //   return originalOn.apply(this, args)
  // }
}
app.on('ready', ()=>{
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
{
  const cp = require('child_process')
  const originalES = cp.execSync
  cp.execSync = function (...args) {
    if (args[0] === 'sw_vers') return '10.0.26100.2605'
    return originalES.apply(this, args)
  }
}

// 加载主代码
require('./main/app.js');

// 启动app
app.whenReady().then(() => {
  global["bootstrapApp"]()
})

// https://github.com/msojocs/bilibili-linux/issues/147
process.on('uncaughtException', () => {
  
})