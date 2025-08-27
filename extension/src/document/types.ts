export interface FetchReplaceType {
  urlInfo: {
    path: string
    params: string
  }
  config?: RequestInit
  res: Response
}