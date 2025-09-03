// index.ts 文件

import { configureStore } from "@reduxjs/toolkit";
import storageSlice, { storageSync } from "./storage.ts";
import { createLogger } from "../../common/log.ts";
import sponsorSlice, { sponsorSyncState } from "./sponsor.ts";
import playSlice, { playSyncState } from "./play.ts";
import danmakuSlice, { danmakuSyncState } from "./danmaku.ts";
import roamingSlice, { roamingSyncState } from "./roaming.ts";

// slice actions映射，用于多slice数据同步
const sliceActions = {
  storage: storageSync,
  // 可以在这里添加其他slice的syncState action
  // user: userSyncState,
  sponsor: sponsorSyncState,
  play: playSyncState,
  danmaku: danmakuSyncState,
  roaming: roamingSyncState,
};

// 防止循环同步的标志
let isSyncing = false;

// configureStore创建一个redux数据
const store = configureStore({
  // 合并多个Slice
  reducer: {
    storage: storageSlice,
    sponsor: sponsorSlice,
    play: playSlice,
    danmaku: danmakuSlice,
    roaming: roamingSlice,
  },
});

export default store;


// 从 store 本身推断出 `RootState` 和 `AppDispatch` 类型
export type RootState = ReturnType<typeof store.getState>
// 推断出类型: {posts: PostsState, comments: CommentsState, users: UsersState}
export type AppDispatch = typeof store.dispatch

const log = createLogger('Store')
store.subscribe(() => {
  // 防止循环同步：如果正在同步中，不触发数据发送
  if (isSyncing) return;

  // 数据同步，数据有更新，发送给mian process
  const state = store.getState()
  // log.info('state change result:', state)
  window.biliBridge.callNativeSync('config/dataSync', JSON.stringify(state))
})
// 多窗口数据同步
window.dataSync = (dataStr: string) => {
  if (!dataStr) return
  try {
    log.info('sync data...')
    const data = JSON.parse(dataStr) as RootState
    isSyncing = true;
    // 全局setState - 动态支持多slice数据同步
    Object.keys(data).forEach(sliceName => {
      const sliceAction = sliceActions[sliceName as keyof typeof sliceActions];
      if (sliceAction && data[sliceName as keyof RootState]) {
        store.dispatch(sliceAction(data[sliceName as keyof RootState]));
      }
    });
  }
  catch (_e) {
    log.error('dataSync error:', _e);
  }
  finally {
    isSyncing = false;
  }
}