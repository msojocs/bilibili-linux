(() => {
  const original = Map.prototype.delete
  window.biliPlugins = new Map()
  const otherPlugin = []
  window.biliPlugins.set('Other', otherPlugin)
  Map.prototype.delete = function (...args) {
    if (args[0].install) {
      const plugin = args[0]
      if (plugin.danmaku) {
        window.danmakuManage = plugin
        // 自动连播推荐视频处理
        plugin.storyStore.state.relatedAutoplay = localStorage.getItem('related_auto_play') === 'true'
        plugin.settingStore.getHandoff = function() {
          if (!this.storyStore.state.relatedAutoplay)
            return 2
          /**
           * 0 - Auto
           * 1 - Delay
           * 2 - Abort
           */
          return this.state.handoff
        }
      }
      if (plugin.tag) {
        window.biliPlugins.set(plugin.tag, otherPlugin)
      } else {
        otherPlugin.push(plugin)
      }
    }
    return original.apply(this, args)
  }
})();