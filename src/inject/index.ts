import { app } from "electron";
import { createBilibiliServer } from "./common/bilibili";
import { electronOverwrite, electronOverwriteAfterReady, hookIsPackaged, initializeGlobalData, nodeJsOverWrite, parseElectronFlag, registerExtension, registerIpcHandle, registerProtocol, replaceBrowserWindow } from "./common/electron-tool";
import { createLogger, Logger } from "../common/log";
(() => {
  const log = createLogger('Index')
  Logger.moduleName = 'Index'
  parseElectronFlag()
  hookIsPackaged()
  initializeGlobalData()
  createBilibiliServer()
  replaceBrowserWindow()
  electronOverwrite()
  nodeJsOverWrite()
  registerIpcHandle()
  // 加载主代码
  module.require("./main/app.js")
  // 启动app
  app.whenReady().then(() => {
    registerProtocol()
    registerExtension()
    electronOverwriteAfterReady()
    global.bootstrapBiliApp();
  });
  // https://github.com/msojocs/bilibili-linux/issues/147
  process.on("uncaughtException", (err) => {
    log.error("uncaughtException", err);
  });
})()