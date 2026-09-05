const { contextBridge, ipcRenderer } = require('electron');

const svpShm = createSvpShmBridge();
contextBridge.exposeInMainWorld('biliBridge', {
  callNativeSync: (...args) => ipcRenderer.sendSync(...args),
  callNative: (...args) => ipcRenderer.invoke(...args),
  svpShmAvailable: () => svpShm.available(),
  svpShmSeek: (startTime, baseIndex) => svpShm.seek(startTime, baseIndex),
  svpShmStart: options => svpShm.start(options),
  svpShmStatus: () => svpShm.status(),
  svpShmStop: () => svpShm.stop(),
});

// HOOK biliBridgePc.callNativeSync
const originEIMW = contextBridge.exposeInMainWorld;
contextBridge.exposeInMainWorld = function () {
  if (arguments[0] === 'biliBridgePc') {
    const originCNS = arguments[1].callNativeSync;
    arguments[1].callNativeSync = function () {
      if (arguments[0] === 'system/isWin') return true;
      return originCNS.apply(this, arguments);
    };
  }
  originEIMW.apply(this, arguments);
};
