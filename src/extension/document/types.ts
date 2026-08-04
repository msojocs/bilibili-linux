export interface FetchReplaceType {
  config?: RequestInit
  requestId?: number
  res: Response
  urlInfo: {
    path: string
    params: string
  }
}
