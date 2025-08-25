export const Page = {
  Login: 'login',
  Home: 'home',
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
  type: string
  typeDescription: string
  episodes: DandanPlayEpisodeType[]
}
export interface DandanPlayEpisodeType {
  episodeId: number
  episodeTitle: string
}
export interface DandanPlayCommentType {
  cid: number
  /**
   * 出现时间,模式,颜色,用户ID
   */
  p: string
  m: string
}
export interface BiliResponseType<T> {
  code: number
  data: T
}

export interface BiliSeasonInfoType {
  modules: BiliSeasonInfoModuleType[]
  actor: {
    info: string
  }
  alias: string
  areas: string
  cover: string
  enable_vt: boolean
  evaluate: string
  test_switch: {
    hide_ep_vv_vt_dm: boolean
  }
  icon_font: string
  link: string
  media_id: number
  mode: string
  new_ep: boolean
  payment: string
  play_strategy:string
  publish: boolean
  share_url: string
  square_cover: string
  staff: {
    info: string
  }
  show_season_type: string
  dynamic_subtitle: string
  share_copy: string
  stat: string
  status: string
  styles: {
    name: string
  }[]
  subtitle: string
  title: string
  total: number
  type: string
  user_status: Record<string, string>
  record: Record<string, string>
  rights: {
    area_limit: number
    allow_dm: number
  }
  season_id: number
  season_title: string
  series: string
  rating: {
    count: number
    score: number
  }
}
export interface BiliSeasonInfoModuleType {
  data: BiliAppSearchResultType
}
export interface BiliAppSearchResultType {
  season_id: number
  title: string
  cv: string
  staff: string
  season_type: string
  selection_style: string
  uri: string
  is_atten: number
  is_selection: number
  cover: string
  area: string
  style: string
  ptime: string
  rating: string
  vote: string
  episodes: BiliSeasonInfoEpisodeType[]
}
export interface BiliSeasonInfoEpisodeType {
  ep_id: number
  cid: number
  param: string
  index: number
  uri: string
  badge_info: {
    text: string
  }
  rights: {
    area_limit: number
    allow_dm: number
  }
}
