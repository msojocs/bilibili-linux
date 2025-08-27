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
    danmakuManage: {
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
      danmakuStore: {
        loadDmPbAll: (all: boolean) => void
      }
      nodes: {
        controlBottomRight: Element
      }
      rootStore: {
        configStore: {
          reload: {
            cid: number
          }
        }
      }
      initDanmaku: () => void
    }
    epId2seasonId: Record<string, string>;
    switchLanguage: (lang: string) => void
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