(() => {
  const original = Map.prototype.delete
  window.biliPlugins = new Map()
  const otherPlugin = []
  window.biliPlugins.set('Other', otherPlugin)
  Map.prototype.delete = function (...args) {
    if (args[0].install) {
      window?.log?.info('Plugin:', args[0])
      if (args[0].danmaku) {
        window.danmakuManage = args[0]
      }
      if (args[0].tag) {
        window.biliPlugins.set(args[0].tag, otherPlugin)
      }
      else {
        otherPlugin.push(args[0])
      }
    }
    return original.apply(this, args)
  }
})();