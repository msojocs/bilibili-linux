
修改cid `danmakuManage.rootStore.configStore.reload.cid`

虹咲1:  564735779

726466820

加载弹幕: `danmakuManage.loadDmPbAll(isReset)`

## 清空重载

```javascript
danmakuManage.danmaku.danmakuArray = []
danmakuManage.danmaku.clear()
danmakuManage.danmakuStore.loadDmPbAll(true)
```

```javascript
while(test.dmListStore.allDm.length > 0){
  test.dmListStore.allDm.shift()
}

for(let t of document.querySelector("#app > div > div.app_player--content.flex_end.ov_hidden > div.app_player--content-player.h_100.p_relative > div > div.app_video--player > div > div > div.cpx-player-primary-area > div.cpx-player-video-area > div.cpx-player-row-dm-wrap").children){
  t.remove()
}
```