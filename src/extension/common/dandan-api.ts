import { GET } from "./http"
import { createLogger } from "../../common/log"
import type { DandanPlayAnimeType, DandanPlayCommentType } from "./types"
const log = createLogger('DandanApi')
export const getComment = async (epId: string, withRelated = false): Promise<DandanPlayCommentType[]> => {
  const url = `https://api.dandanplay.net/api/v2/comment/${epId}?withRelated=${withRelated}`
  const res = await GET(url)
  const resp = JSON.parse(res.responseText || "{}")
  return resp.comments || []
}
export const dandanplaySearch = async (str: string): Promise<DandanPlayAnimeType[]> => {
  const url = `https://api.dandanplay.net/api/v2/search/episodes?anime=${str}`
  const res = await GET(url)
  const resp = JSON.parse(res.responseText)
  log.info('dandanplay: ', resp)
  return resp?.animes ?? []
}