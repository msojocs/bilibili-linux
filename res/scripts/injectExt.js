function injectExtensions(win){
  win.webContents.openDevTools();
  const path = require('path');
  const { session, app, BrowserWindow } = require('electron');
  app.whenReady().then(()=>{
    // const extPath = app.isPackaged ? path.join(process.resourcesPath, "extensions") : path.join(app.getAppPath(), "extensions");
    const extPath = path.join(path.dirname(app.getAppPath()), "extensions");
    console.log('----extPath----', extPath)
    win.webContents.session.loadExtension(extPath + "/area_unlimit").then(({ id }) => {
      // ...
      console.log('-----Load Extension:', id)
    })
  })
}