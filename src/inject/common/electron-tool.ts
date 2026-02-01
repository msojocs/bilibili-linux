import {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  protocol,
  session,
  screen,
} from "electron";
import { createLogger } from "../../common/log";
import fs from "fs";
import EventEmitter from "events";
import Module from "module";
import path from "path";
import { exec, execSync, spawn } from "child_process";
import { ChannelCredentials } from "@grpc/grpc-js";
import { DynamicClient } from "./dynamic.client";
import { GrpcTransport } from "@protobuf-ts/grpc-transport";
import type { RpcMetadata } from "@protobuf-ts/runtime-rpc";
import { Device, DynDetailReply, Metadata } from "./dynamic";

const log = createLogger("electron-tool");
export const parseElectronFlag = () => {
  //#region flags 解析
  try {
    const userDataPath = app.getPath("userData");
    const flagPath = `${userDataPath}/bilibili-flags.conf`;
    log.info("flagPath:", flagPath);
    if (fs.existsSync(flagPath) && fs.statSync(flagPath).isFile()) {
      const flagData = fs.readFileSync(flagPath).toString();
      const flags = flagData.split("\n").filter((e) => e && e.length > 0);
      for (let flag of flags) {
        if (flag.startsWith("--")) flag = flag.substring(2);

        const kv = flag.split("=");
        if (kv.length > 1) {
          log.info("append flag:", `${kv[0]}=${kv[1]}`);
          app.commandLine.appendSwitch(kv[0], kv[1]);
        } else {
          log.info("append flag:", kv[0]);
          app.commandLine.appendArgument(kv[0]);
        }
      }
    }
  } catch (error) {
    log.error("flag 解析失败", error);
  }
  //#endregion flags 解析
};

export const hookIsPackaged = () => {
  const pkgHack = {
    idx: 0,
    data: [
      true,
      true,
      true, // .biliapp
      true,
      false,
      true,
    ],
  };
  Object.defineProperty(app, "isPackaged", {
    get() {
      let ret = pkgHack.data[pkgHack.idx++];
      if (ret === undefined) ret = true;
      log.info("get isPackaged", ret);
      return ret;
    },
  });
};

export const initializeGlobalData = () => {
  global.isFiredByEntry = true;
  global.bootstrapEvents = new EventEmitter();
  global.runtimeConf = {
    exWebPreferences: {}
  }
}

export const replaceBrowserWindow = () => {
  const originalBrowserWindow = BrowserWindow;
  const hookBrowserWindow = (OriginalBrowserWindow: typeof BrowserWindow) => {
    function HookedBrowserWindow(
      options?: Electron.BrowserWindowConstructorOptions
    ) {
      // 修改或增加构造函数的选项
      try {
        if (options) {
          options.frame = false;
          if (options.webPreferences) {
            options.webPreferences.devTools = true;
          }
        }
        log.info("======HookedBrowserWindow:", options);
      } catch (_e) {
        /* empty */
      }
      // 使用修改后的选项调用原始构造函数
      const instance: BrowserWindow = new OriginalBrowserWindow(options);
      instance.webContents.on("ipc-message-sync", (event, ...args) => {
        if (args[0] === "config/roamingPAC") {
          log.info("receive config/roamingPAC: ", ...args);
          const ses = instance.webContents.session;
          ses
            .setProxy({
              mode: "pac_script",
              pacScript: args[1],
            })
            .then((_res) => {
              log.info("====set proxy");
              ses.forceReloadProxyConfig().then(() => {
                ses.resolveProxy("akamai.net").then((res) => {
                  log.info("resolveProxy akamai.net --> ", res);
                  event.returnValue = res.length === 0 ? "error" : "ok";
                  if (res.length === 0) ses.setProxy({ mode: "system" });
                });
              });
            })
            .catch((err) => {
              log.error("====set error", err);
              event.returnValue = "error";
            });
        } else if (args[0] === "config/dataSync") {
          // get all window and send ChangeLanguage event
          log.info("receive config/dataSync:", ...args);
          const windows = BrowserWindow.getAllWindows();
          for (const win of windows) {
            if (win.id === instance.id) continue;
            log.info("notify dataSync to window:", win.id, args[1]);
            win.webContents
              .executeJavaScript(`window.dataSync('${args[1]}')`)
              .then((res) => {
                log.info("dataSync result:", res);
              })
              .catch((err) => {
                log.error("dataSync error:", err);
              });
          }
          log.info("dataSync end.");
          event.returnValue = "ok";
        }
      });
      // DevTools切换
      instance.webContents.on("before-input-event", (_event, input) => {
        if (input.key === "F12" && input.type === "keyUp") {
          instance.webContents.toggleDevTools();
        }
      });
      return instance;
    }

    // 复制原始构造函数的原型链并进行替换
    HookedBrowserWindow.prototype = Object.create(
      OriginalBrowserWindow.prototype
    );
    HookedBrowserWindow.prototype.constructor = HookedBrowserWindow;
    Object.setPrototypeOf(HookedBrowserWindow, OriginalBrowserWindow);

    return HookedBrowserWindow;
  };

  // 使用替换的构造函数
  const HookedBrowserWindow = hookBrowserWindow(originalBrowserWindow);

  const ModuleLoadHook: Record<string, (m: never) => unknown> = {
    electron: (module: typeof Electron) => {
      return {
        ...module,
        BrowserWindow: HookedBrowserWindow,
      };
    },
  };
  // log.info('Module:', Module)
  const m = Module as unknown as {
    _load: (path: string, ...args: unknown[]) => unknown;
  };
  const original_load = m._load;
  m._load = (...args) => {
    const loaded_module = original_load(...args);
    // console.log('load', args[0])
    if (ModuleLoadHook[args[0]]) {
      return ModuleLoadHook[args[0]](loaded_module as never);
    } else {
      return loaded_module;
    }
  };
};
export const electronOverwrite = () => {
  {
    const buildFromTemplate = Menu.buildFromTemplate;
    Menu.buildFromTemplate = function (
      template: Array<Electron.MenuItemConstructorOptions | Electron.MenuItem>
    ) {
      if (template[0]?.label == "设置") {
        template.unshift({
          label: "首页",
          click: () =>
            global.biliApp.configService.openMainWindowPage$.next({
              page: "RecommendPage",
            }),
        });
        log.info("menu list:", template);
      }
      return buildFromTemplate.apply(this, [template]);
    };
  }
  {
    // hook loadURL
    const originloadURL = BrowserWindow.prototype.loadURL;
    BrowserWindow.prototype.loadURL = function (
      url: string,
      options?: Electron.LoadURLOptions
    ) {
      this.setMinimumSize(300, 300);
      // 设置UA，有些番剧播放链接Windows会403
      this.webContents.setUserAgent(
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) bilibili_pc/1.9.1 Chrome/98.0.4758.141 Electron/17.4.11 Safari/537.36"
      );
      log.info("=====loadURL:", url);
      return originloadURL.apply(this, [url, options]);
    };
  }
  {
    // hook loadFile
    // 从文件加载页面
    const _loadFile = BrowserWindow.prototype.loadFile;
    BrowserWindow.prototype.loadFile = function (
      filePath: string,
      options?: Electron.LoadFileOptions
    ) {
      log.info("=====loadFile:", filePath);
      return _loadFile.apply(this, [filePath, options]);
    };
  }
  {
    const originalClose = BrowserWindow.prototype.close;
    BrowserWindow.prototype.close = function (...args) {
      /**
       * https://github.com/msojocs/bilibili-linux/issues/169
       * 1. 使用账户密码登录，遇到验证码
       * 2. 关闭验证码弹窗 loginRiskWindow.close
       * 3. 再次使用账户密码登录
       * 4. 此时不再需要验证码（跳过验证码），执行成功逻辑，再次调用 loginRiskWindow.close 错误
       *
       */
      log.info("------------->close window", args);
      const result = originalClose.apply(this, args);
      if (this === global.biliApp.configService.loginWindow) {
        global.biliApp.configService.loginWindow = null;
      } else if (this === global.biliApp.configService.loginRiskWindow) {
        global.biliApp.configService.loginRiskWindow = null;
      }
      return result;
    };
  }
}
export const electronOverwriteAfterReady = () => {
  {
    const cursorTool = () => {
      return new Promise<string>((resolve, reject) => {
        try {
          const info = execSync("cat /proc/bus/input/devices").toString();
          const devices = info
            .split("\n")
            .filter((e) => e.startsWith("H:"))
            .filter((e) => e.includes("mouse"))
            .map(
              (e) =>
                e
                  .split("=")[1]
                  .split(" ")
                  .filter((e1) => e1.startsWith("event"))[0]
            )
            .map((e) => `/dev/input/${e}`)
            .join(",");
          exec(
            `${path.resolve(
              __dirname,
              "../cursor-tool"
            )} --devices "${devices}"`,
            (ex, out, err) => {
              if (ex || err) {
                reject(err);
              } else {
                resolve(out);
              }
            }
          );
        } catch (err) {
          reject(err);
        }
      });
    };
    const original = screen.getCursorScreenPoint;
    let cursorToolError = false;
    let oldX = 0,
      oldY = 0;
    screen.getCursorScreenPoint = function () {
      if (process.env["XDG_SESSION_TYPE"] == "wayland" && !cursorToolError) {
        (async () => {
          try {
            const point = (await cursorTool()).replace("\n", "");
            const detail = point.split(",");
            oldX = parseInt(detail[0]);
            oldY = parseInt(detail[1]);
            return {
              x: oldX,
              y: oldY,
            };
          } catch (err) {
            cursorToolError = true;
            const error = err as string;
            log.error("error:", error.replace("\n", ""));
            if (error.includes("failed to add device")) {
              log.info(
                `\x1B[36mNeed execute: sudo usermod -aG input ${process.env.USERNAME}, then reboot.\x1B[0m`
              );
            }
          }
        })();
      }
      if (!oldX || !oldY) {
        return original.apply(this, []);
      }
      return {
        x: oldX,
        y: oldY,
      };
    };
  }
};
export const registerIpcHandle = () => {
  // 处理启动缓慢的问题
  /**
   * 获取方式：
   * 在preload.js中拦截ipcRenderer.sendSync，把log输出到文件中。
   * 
   * 如何找到哪里调用？
   * 返回一些不能处理的数据，让逻辑层报错，比如处理object的返回undefined，就会在调用处报错。
   */
  ipcMain.on("app/getTheme", (event) => {
    // 在这里处理数据，然后通过 event.returnValue 发送返回值
    event.returnValue = "bili_light";
  });
  ipcMain.on("app/mainProcessReady", (event) => {
    // 在这里处理数据，然后通过 event.returnValue 发送返回值
    event.returnValue = true;
  });
  ipcMain.on('app/getInitInfo', (event) => {
    log.info('emit app/getInitInfo')
    event.returnValue = {
      IS_MAC: false,
      IS_WIN: false,
      IS_LINUX: true,
      IS_DEV: false,
      IS_RELEASE: true,
      APP_VERSION: '1.17.5.4665',
      IS_DEV_M: false,
      JSB_PRELOAD_URL: 'bili-preload.js',
      appId: '',
      platform: 'linux'
    }
  })
  ipcMain.handle("sponsor/downloadAudio", async (_, url) => {
    log.info("sponsor/downloadAudio:", url);
    // 1. 下载文件
    const tempfile = path.resolve(
      module.require("os").tmpdir(),
      "bilibili-tanscribe.mp3"
    );
    await fetch(url, {
      method: "GET",
      headers: { Referer: "https://www.bilibili.com/" },
    }).then(async (res) => {
      const fileStream = fs.createWriteStream(tempfile);
      const writer = new WritableStream({
        write(chunk) {
          return new Promise((resolve, reject) => {
            fileStream.write(chunk, (error) => {
              if (error) reject(error);
              else resolve();
            });
          });
        },
        close() {
          fileStream.end();
        },
      });
      if (res.status !== 200)
        throw new Error(`${res.status} ${res.statusText}`);
      await res.body?.pipeTo(writer);
    });
    return tempfile;
  });
  ipcMain.handle(
    "sponsor/transcribeAudio",
    (_, options) =>
      new Promise((resolve, reject) => {
        // 2. 语音转文字
        log.info("sponsor/transcribeAudio:", options);
        const file = options.file;
        const proxy = options.proxy;
        const libPath = options.libPath;
        const task = spawn(
          path.resolve(__dirname, "../transcribe.py"),
          [file],
          {
            env: {
              HTTPS_PROXY: proxy,
              HTTP_PROXY: proxy,
              LD_LIBRARY_PATH: `${process.env.LD_LIBRARY_PATH}:${libPath}`,
            },
          }
        );
        let stdout = "";
        let stderr = "";

        task.stdout.on("data", (msg) => {
          // console.info('stdout:', msg.toString())
          stdout += msg.toString();
        });
        task.stderr.on("data", (msg) => {
          // console.info('stderr:', msg.toString())
          stderr += msg.toString();
        });
        task.on("close", (code) => {
          log.info("close:", code, task.exitCode);
          if (stderr) {
            reject(stderr);
          } else {
            resolve(stdout);
          }
        });
      })
  );

  ipcMain.handle(
    "roaming/queryDynamicDetail",
    async (_, dynamicId, accessKey) => {
      log.info("dynamic id:", dynamicId, accessKey);

      const transport = new GrpcTransport({
        host: "grpc.biliapi.net",
        channelCredentials: ChannelCredentials.createSsl(),
        clientOptions: {
          "grpc.primary_user_agent": "Dalvik/2.1.0 (Linux; U; Android 10; RMX2117 Build/QP1A.190711.020) 7.61.0 os/android model/Pixel XL mobi_app/android build/7610300 channel/yingyongbao innerVer/7610310 osVer/10 network/2 grpc-java-cronet/1.36.1",
        }
      });
      const client = new DynamicClient(transport);
      const meta: RpcMetadata = {
        "x-bili-gaia-vtoken": "",
        "x-bili-aurora-eid": "UlcBQFgHB1M=",
        "x-bili-aurora-zone": "",
        "x-bili-trace-id": "344211a71a0dcf47432b69ac84666e79:432b69ac84666e79:0:0",
        "x-bili-fawkes-req-bin": "CglhbmRyb2lkNjQSBHByb2QaCDlhMjU2NWM2",
      };

      const data: Metadata = {
        accessKey: accessKey,
        mobiApp: "android",
        device: "phone",
        build: 7610300,
        channel: "yingyongbao",
        buvid: "XU8E5D18568ACB1FFEFE1E27B3456B9AFFB28",
        platform: "android",
      };
      {
        const metadata = Buffer.from(Metadata.toBinary(data));
        log.info('meta data:', metadata.toString("base64"))
        meta["x-bili-metadata-bin"] = metadata.toString("base64");
      }
      meta["authorization"] = `identify_v1 ${accessKey}`;
      const device: Device = {
        mobiApp: "android",
        device: "phone",
        build: 7610300,
        channel: "yingyongbao",
        buvid: "XU8E5D18568ACB1FFEFE1E27B3456B9AFFB28",
        platform: "android",
        appId: 5,
        brand: "realme",
        model: "Pixel XL",
        osver: "10",
        fpLocal: "8cb55fdfcf655513e20e636f6caf0e1420240328142353b223ab3420700b2b8d",
        fpRemote: "8cb55fdfcf655513e20e636f6caf0e1420240328142353b223ab3420700b2b8d",
        versionName: "7.61.0",
        fp: "8cb55fdfcf655513e20e636f6caf0e1420240328142353b223ab3420700b2b8d",
        fts: 0n
      };
      const deviceData = Buffer.from(Device.toBinary(device));
      // 固定数据
      meta["x-bili-device-bin"] = deviceData.toString("base64");
      // 固定数据
      meta["x-bili-network-bin"] = "CAEaBTQ2MDAx";
      meta["x-bili-restriction-bin"] = "";
      // 固定数据
      meta["x-bili-locale-bin"] = "CggKAnpoGgJDThIICgJ6aBoCQ04";

      meta["x-bili-exps-bin"] = "";
      meta["buvid"] = "XU8E5D18568ACB1FFEFE1E27B3456B9AFFB28";
      meta['bili-http-engine'] = 'cronet';
      meta["te"] = "trailers";
      log.info('meta data:', meta)
      const reqData = {
        dynamicId: `${dynamicId}`,
      };
      // action: sayHello
      const result = await client.dynDetail(reqData, { 
        meta,
       });
      return DynDetailReply.toJson(result.response, { enumAsInteger: false, useProtoFieldName: true });
    }
  );

};

export const registerExtension = () => {
  const extPath = path.join(path.dirname(app.getAppPath()), "extensions");
  session.defaultSession
    .loadExtension(extPath + "/bilibili", {
      allowFileAccess: true,
    })
    .then(({ id }) => {
      // ...
      log.info("-----Load Extension:", id);
    });
};

export const registerProtocol = () => {
  // 自定义协议的具体实现
  protocol.registerStringProtocol("roaming", async (req, cb) => {
    // console.log('registerHttpProtocol', req)
    try {
      const result = await fetch(req.url.replace("roaming", "https"), {
        headers: {
          cookie: req.headers["x-cookie"],
        },
      });

      cb(await result.json());
    } catch (err) {
      cb({
        statusCode: 500,
        data: JSON.stringify(err),
      });
    }
  });

  protocol.registerHttpProtocol("roaming-thpic", (req, cb) => {
    cb({
      url: req.url.replace("roaming-thpic", "https"),
    });
  });
};

export const nodeJsOverWrite = () => {
  {
    const cp = module.require("child_process");
    const originalES = cp.execSync;
    cp.execSync = function (...args: unknown[]) {
      if (args[0] === "sw_vers") return "10.0.26100.2605";
      return originalES.apply(this, args);
    };
  }
};
