// index.ts 文件

import { configureStore, createListenerMiddleware, isAnyOf } from "@reduxjs/toolkit";
import storageSlice, { changeLanguage, languageReceived, storageSync } from "./storage.ts";
import { createLogger } from "../../../common/log.ts";
import sponsorSlice, { sponsorSyncState } from "./sponsor.ts";
import playSlice, { playSyncState } from "./play.ts";
import danmakuSlice, { danmakuSyncState } from "./danmaku.ts";
import roamingSlice, { roamingSyncState } from "./roaming.ts";
import { requestContent } from "../../document/communication.ts";
import { languageDocument, normalizeLanguage } from "../../common/translation/language.ts";
import i18n from "../i18n.ts";

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
const languageListener = createListenerMiddleware()

// configureStore创建一个redux数据
const store = configureStore({
  middleware: getDefaultMiddleware => getDefaultMiddleware().prepend(languageListener.middleware),
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

let languageRevision = 0
let persistence = Promise.resolve()
languageListener.startListening.withTypes<RootState, AppDispatch>()({
  matcher: isAnyOf(changeLanguage, languageReceived, storageSync),
  effect: (action, api) => {
    languageRevision++
    const language = api.getState().storage.lang
    const previous = api.getOriginalState().storage.lang
    if (language === previous) return
    void i18n.changeLanguage(language)
    if (changeLanguage.match(action)) {
      // Serialize writes so rapid toggles cannot persist an older selection last.
      persistence = persistence.then(() => requestContent('setStorage', { key: 'lang', value: language }))
        .then(() => undefined)
        .catch(error => { log.error('Language persistence failed:', error) })
    }
    if (!languageReceived.match(action)) {
      languageDocument().dispatchEvent(new CustomEvent('changeLanguage', { detail: language }))
    }
  },
})

let initialization: Promise<void> | undefined

// Called after the page/content message bridge is registered.
export function initStore() {
  if (initialization) return initialization
  const target = languageDocument()
  const onLanguageChange = (event: Event) => {
    const language = normalizeLanguage((event as CustomEvent<unknown>).detail)
    if (language === store.getState().storage.lang) {
      languageRevision++
      return
    }
    const wasSyncing = isSyncing
    isSyncing = true
    try {
      store.dispatch(languageReceived(language))
    } finally {
      isSyncing = wasSyncing
    }
  }
  target.addEventListener('changeLanguage', onLanguageChange)
  const unsubscribe = store.subscribe(() => {
    if (isSyncing) return
    window.biliBridge?.callNativeSync('config/dataSync', JSON.stringify(store.getState()))
  })
  const onPageHide = (event: PageTransitionEvent) => {
    if (event.persisted) return
    target.removeEventListener('changeLanguage', onLanguageChange)
    window.removeEventListener('pagehide', onPageHide)
    unsubscribe()
  }
  window.addEventListener('pagehide', onPageHide)
  const revision = languageRevision
  initialization = requestContent<string>('getStorage', { key: 'lang' })
    .then(language => {
      // A user selection or another window's update takes precedence over a delayed read.
      if (languageRevision !== revision) return
      isSyncing = true
      try {
        store.dispatch(storageSync({ lang: normalizeLanguage(language) }))
      } finally {
        isSyncing = false
      }
    })
    .catch(error => { log.error('Language initialization failed:', error) })
  return initialization
}

// 多窗口数据同步
window.dataSync = (dataStr: string) => {
  if (!dataStr) return
  try {
    log.info('sync data...')
    const data = JSON.parse(dataStr) as RootState
    isSyncing = true;
    // 全局setState - 动态支持多slice数据同步
    Object.keys(data).forEach(sliceName => {
      if (sliceName === 'storage') {
        if (data.storage) store.dispatch(storageSync(data.storage))
        return
      }
      const sliceAction = sliceActions[sliceName as Exclude<keyof typeof sliceActions, 'storage'>];
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
