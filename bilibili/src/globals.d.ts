////////////////////
// Global object
////////////////////
interface Window {
    epId2seasonId: Record<string, string>;
    __segment_base_map__: Record<string, string[]>
    biliBridgePc: {
      callNative: (action: string, ...args: unknown[]) => Promise<unknown>
      callNativeSync: (action: string, ...args: unknown[]) => unknown
    }
    requestBackground: (action: string, data: unknown) => Promise<unknown>
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
        reset: () => void
        clear: () => void
      }
      danmakuStore: {
        loadDmPbAll: (all: boolean) => void
      }
      rootStore: {
        configStore: {
          reload: {
            cid: number
          }
        }
      }
    }
}
interface BiliDanmakuType {
    attr: number;
    color: number;
    date: number;
    mode: number;
    pool: number;
    renderAs: number;
    size: number;
    text: string;
    stime: number;
    weight: number;
}