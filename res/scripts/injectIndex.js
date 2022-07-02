const {
  app
} = require("electron")
const pkgHack = {
  idx: 0,
  data: [
    true,
    true,
    true,
    false,  // warning, jsc中的
    false,  // .biliapp
    // ======app.js start======
    true,
    false // app.js isPackaged -> warning
  ]
}
Object.defineProperty(app, 'isPackaged', {
  get() {
    let ret = pkgHack.data[pkgHack.idx++]
    if (ret === undefined) ret = true;
    // console.log("get isPackaged", ret)
    return ret;
  },

});