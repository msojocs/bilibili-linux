
export const Page = {
  Home: 'home',
  Login: 'login',
  Search: 'search',
  Unknown: 'Unknown'
} as const
export type PageType = typeof Page[keyof typeof Page]
export interface Bvid2DynamicIdType {
  bvid: string
  dynamic_id: string
}
export interface DandanPlayAnimeType {
  animeId: number
  animeTitle: string
  episodes: DandanPlayEpisodeType[]
  type: string
  typeDescription: string
}
export interface DandanPlayEpisodeType {
  episodeId: number
  episodeTitle: string
}
export interface DandanPlayCommentType {
  cid: number
  m: string
  /**
   * 出现时间,模式,颜色,用户ID
   */
  p: string
}
export interface BiliResponseType<T> {
  code: number
  data: T
}

export interface BiliSeasonInfoType {
  actor: {
    info: string
  }
  alias: string
  areas: string
  cover: string
  dynamic_subtitle: string
  enable_vt: boolean
  evaluate: string
  icon_font: string
  link: string
  media_id: number
  mode: string
  modules: BiliSeasonInfoModuleType[]
  new_ep: boolean
  payment: string
  play_strategy:string
  publish: boolean
  rating: {
    count: number
    score: number
  }
  record: Record<string, string>
  rights: {
    area_limit: number
    allow_dm: number
  }
  season_id: number
  season_title: string
  series: string
  share_copy: string
  share_url: string
  show_season_type: string
  square_cover: string
  staff: {
    info: string
  }
  stat: string
  status: string
  styles: {
    name: string
  }[]
  subtitle: string
  test_switch: {
    hide_ep_vv_vt_dm: boolean
  }
  title: string
  total: number
  type: string
  user_status: Record<string, string>
}
export interface BiliSeasonInfoModuleType {
  data: BiliAppSearchResultType
}
export interface BiliAppSearchResultType {
  area: string
  cover: string
  cv: string
  episodes: BiliSeasonInfoEpisodeType[]
  is_atten: number
  is_selection: number
  ptime: string
  rating: string
  season_id: number
  season_type: string
  selection_style: string
  staff: string
  style: string
  title: string
  uri: string
  vote: string
}
export interface BiliSeasonInfoEpisodeType {
  badge_info: {
    text: string
  }
  cid: number
  ep_id: number
  index: number
  param: string
  rights: {
    area_limit: number
    allow_dm: number
  }
  uri: string
}
/**
 * https://api.bilibili.com/x/web-interface/search/type
 * 
 */
export interface BiliWebSearchResultType {
  areas: string
  cover: string
  cv: string
  episodes: BiliSeasonInfoEpisodeType[]
  is_atten: number
  is_selection: number
  ptime: string
  rating: string
  season_id: number
  season_type: string
  selection_style: string
  staff: string
  style: string
  title: string
  uri: string
  vote: string
}