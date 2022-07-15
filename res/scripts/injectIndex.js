const {
  app
} = require("electron")
const pkgHack = {
  idx: 0,
  data: [
    true,
    true,
    false,  // .biliapp
    true, 
    false,
    false,
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