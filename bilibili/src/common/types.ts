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