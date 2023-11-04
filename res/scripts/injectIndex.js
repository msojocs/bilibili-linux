const {app} = require('electron');
const fs = require('fs')
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
global['isFiredByEntry'] = true;
require('./main/app.js');