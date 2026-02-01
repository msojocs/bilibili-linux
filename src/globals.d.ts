////////////////////
// Global object

////////////////////

// 导入 EventEmitter 类型
import { EventEmitter } from 'events';

// 正确定义 NodeJS 全局变量
declare global {
  // 保持 Window 接口的定义
  interface Window {
    __segment_base_map__: Record<string, [string, string]>
    biliBridge: {
      callNative: <T>(action: string, ...args: unknown[]) => Promise<T>
      callNativeSync: (action: string, ...args: unknown[]) => unknown
    }
    biliBridgePc: {
      callNative: (action: string, ...args: unknown[]) => Promise<unknown>
      callNativeSync: (action: string, ...args: unknown[]) => unknown
    }
    biliPlayer: BiliPlayer
    cookieStore: CookieStore
    danmakuManage: DanmakuManage
    dataSync: (data: string) => void
    epId2seasonId: Record<string, string>;
  }
  
  // Node.js 全局变量
  var bootstrapEvents: EventEmitter;
  var isFiredByEntry: boolean;
  var runtimeConf: {
    exWebPreferences: Record<string, unknown>
  }
  var bootstrapBiliApp: () => void
  var biliApp = {
    configService: {
      openMainWindowPage$: {
        next: (_value: unknown) => {},
      },
      loginWindow: object,
      loginRiskWindow: object
    }
  }
}

// #region Store

interface RootStore {
  configStore: ConfigStore
  danmakuStore: DanmakuStore
  hotspotStore: HotspotStore
  mediaStore: MediaStore
  mpdStore: MpdStore
  nodes: {
    videoArea: HTMLElement
  }
  progressStore: ProgressStore
  storyStore: StoryStore
  subtitleStore: SubtitleStore
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
     * StudyNote 笔记
     */
    '-1': ProgressViewPoint[]
    /**
     * WonderMoment 高能
     */
    1: ProgressViewPoint[]
    /**
     * Division 章节
     */
    2: ProgressViewPoint[]
    /**
     * OpenEnd 片头片尾
     */
    3: ProgressViewPoint[]
    /**
     * AIPoint AI打点
     */
    4: ProgressViewPoint[]
  }
}
interface MediaStore extends RootStore {
  rootStore: RootStore
  video: HTMLVideoElement
}
interface MpdStore extends RootStore {
  body: {
    mediaDataSource: {
      duration: number
      type: string
      url: {
        audio: ParsedAudioInfo[]
      }
    }
    parsedFragmentVideoInfoList: ParsedFragmentVideoInfo[]
  }
  rootStore: RootStore
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
interface SubtitleStore extends RootStore {
  rootStore: RootStore
  state: {
    bilingual: boolean
    color: string
    enable: boolean
    fade: boolean
    fontSize: number
    hover: boolean
    isclosed: boolean
    lang: string
    languageList?: SubtitleLanguage[]
    minorLan: string
    opacity: number
    position: string
    scale: number
    shadow: string
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
interface ParsedFragmentVideoInfo {
  acceptDescription: string[]
  mediaDataSource: {
    duration: number
    url: {
      audio: ParsedAudioInfo[]
    }
  }
}
interface ParsedAudioInfo {
  backup_url: string[]
  base_url: string
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
  from : number
  imgUrl?: string
  logoUrl?: string
  /**
   * 自定义的SponsorBlock数据
   */
  sponsor_info?: SponsorBlockInfo
  team_name?: string
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
interface SubtitleLanguage {
  ai_status: number
  ai_type: number
  id: number
  id_str: `${number}`
  is_lock: boolean
  lan: string
  lan_doc: string
  subtitle_url: string
  subtitle_url_v2: string
  type: number
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
