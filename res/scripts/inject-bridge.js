// 去除无限debugger
Function.prototype.__constructor_back = Function.prototype.constructor;
Function.prototype.constructor = function() {
    if(arguments && typeof arguments[0]==='string'){
        // console.log("arguments: ", arguments);
        if("debugger" === arguments[0]){
            //arguments[0]="console.log(\"anti debugger\");";
            //arguments[0]=";";
            return
        }
    }
   return Function.prototype.__constructor_back.apply(this,arguments);
};
const {contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld(
  'biliBridge',
  {
    callNativeSync: (...args) => ipcRenderer.sendSync(...args),
    callNative: (...args) => ipcRenderer.invoke(...args),
  }
)

// HOOK biliBridgePc.callNativeSync
const originEIMW = contextBridge.exposeInMainWorld
contextBridge.exposeInMainWorld = function(){
  // console.log('electron.contextBridge.exposeInMainWorld', arguments);
  if(arguments[0] === "biliBridgePc"){
    // "biliBridgePc"
    const originCNS = arguments[1].callNativeSync
    arguments[1].callNativeSync = function(){
      // console.log("callNativeSync", arguments)
      if(arguments[0] === "system/isWin")return true;
      return originCNS.apply(this, arguments);
    }
  }
  originEIMW.apply(this, arguments);
};