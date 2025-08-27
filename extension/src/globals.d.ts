////////////////////
// Global object
////////////////////
interface Window {
    __segment_base_map__: Record<string, [string, string]>
    biliBridgePc: {
      callNative: (action: string, ...args: unknown[]) => Promise<unknown>
      callNativeSync: (action: string, ...args: unknown[]) => unknown
    }
    cookieStore: CookieStore
    danmakuManage: DanmakuManage
    epId2seasonId: Record<string, string>;
    switchLanguage: (lang: string) => void
}
// #region Store

interface RootStore {
  configStore: ConfigStore
  danmakuStore: DanmakuStore
  storyStore: StoryStore
}
interface StoryStore extends RootStore {
  rootStore: RootStore
  state: {
    relatedAutoplay: boolean
  }
}
interface DanmakuStore extends RootStore {
  loadDmPbAll: (all: boolean) => void
  rootStore: RootStore
}
interface ConfigStore extends RootStore {
  reload: {
    cid: number
  }
  rootStore: RootStore
}
// #endregion Store
interface DanmakuManage extends RootStore {
  danmaku: {
    manager: {
      dataBase: {
        timeLine: {
          list: BiliDanmakuType[]
        }
      }
    }
    config: {
      fn: {
        filter: (t: {colorful: boolean, colorfulImg: string, weight: number}) => boolean
      }
    }
    reset: () => void
    clear: () => void
  }
  initDanmaku: () => void
  nodes: {
    controlBottomRight: Element
  }
  rootStore: RootStore
}
interface BiliDanmakuType {
    attr: number;
    color: number;
    date: number;
    mode: number;
    pool: number;
    renderAs: number;
    size: number;
    stime: number;
    text: string;
    weight: number;
}