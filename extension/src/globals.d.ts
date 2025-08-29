////////////////////
// Global object

////////////////////
interface Window {
    __segment_base_map__: Record<string, [string, string]>
    biliBridgePc: {
      callNative: (action: string, ...args: unknown[]) => Promise<unknown>
      callNativeSync: (action: string, ...args: unknown[]) => unknown
    }
    biliPlayer: BiliPlayer
    cookieStore: CookieStore
    danmakuManage: DanmakuManage
    epId2seasonId: Record<string, string>;
    switchLanguage: (lang: string) => void
}
// #region Store

interface RootStore {
  configStore: ConfigStore
  danmakuStore: DanmakuStore
  mediaStore: MediaStore
  nodes: {
    videoArea: HTMLElement
  }
  progressStore: ProgressStore
  storyStore: StoryStore
  toastStore: ToastStore
}
interface ConfigStore extends RootStore {
  reload: {
    cid: number
  }
  rootStore: RootStore
}
interface DanmakuStore extends RootStore {
  loadDmPbAll: (all: boolean) => void
  rootStore: RootStore
}
interface HotspotStore extends RootStore {
  rootStore: RootStore
  state: {
    /**
     * StudyNote
     */
    '-1': ProgressViewPoint[]
    /**
     * WonderMoment
     */
    1: ProgressViewPoint[]
    /**
     * Division
     */
    2: ProgressViewPoint[]
    /**
     * OpenEnd
     */
    3: ProgressViewPoint[]
    /**
     * AIPoint
     */
    4: ProgressViewPoint[]
  }
}
interface MediaStore extends RootStore {
  rootStore: RootStore
  video: HTMLVideoElement
}
interface ProgressStore extends RootStore {
  rootStore: RootStore
  viewpoint?: ProgressViewPoint[]
}
interface StoryStore extends RootStore {
  rootStore: RootStore
  state: {
    relatedAutoplay: boolean
  }
}
interface ToastStore extends RootStore {
  create: (param: ToastCreateParam) => number
  remove: (id: number) => boolean
  resumeClock: (id: number) => void
  rootStore: RootStore
  suspendClock: (id: number) => void
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
interface BiliPlayer {

  /**
   * [{
   *   type: 1,
   *   from: 60,
   *   to: 120,
   *   content: 'test'
   * }]
   * @param data string
   * @returns 
   */
  addViewPoints: (data: string) => void
  on: (event: string, callback: (...args: unknown[]) => void) => this
  seek: (time: number, cfg?: {initiator: string}) => Promise<void>
}
/**
 *  -1 = "StudyNote"
 *   1 = "WonderMoment"
 *   2 = "Division"
 *   3 = "OpenEnd"
 *   4 = "AIPoint"
 */
type HotspotType = "StudyNote" | "WonderMoment" | "Division" | "OpenEnd" | "AIPoint"
interface ProgressViewPoint {
  content: string
  from : 0
  imgUrl: string
  logoUrl: string
  /**
   * 自定义的SponsorBlock数据
   */
  sponsor_info?: SponsorBlockInfo
  team_name: string
  to: number
  /**
   * 1: 高能
   * 2: 章节
   */
  type: number
}
interface SponsorBlockInfo {
  actionType: 'skip' | 'mute' | 'full' | 'poi' | 'chapter'
  category: 'sponsor' | 'selfpromo' | 'interaction' | 'intro' | 'outro' | 'preview' | 'hook' | 'filler'
}
interface ToastCreateParam {
  confirmText?: string
  duration?: number
  fixed?: boolean
  /**
   * 是否手动取消
   */
  manualMode: boolean
  onConfirmClicked?: () => void,
  onHoverChanged?: (hovering: boolean) => void
  onRemoved?: () => void
  priority?: number
  text: string | HTMLElement | Node
}