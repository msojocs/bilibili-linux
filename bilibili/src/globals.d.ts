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
    danmakuManage: unknown
}