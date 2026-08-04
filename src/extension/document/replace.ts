import { createLogger } from "../../common/log"
import { ResponseReplaceFetch } from "./response-replace"
import { CustomXMLHttpRequest } from "./xml-http-request"
import { nextSvpRequestId } from "../common/svp"

const log = createLogger('Replace')
export const replaceXMLHttpRequest = () => {
  if (location.href.includes('live.bilibili')) return
  if (Object.hasOwn(window.XMLHttpRequest, 'isHooked')) {
    return
  }
  window.XMLHttpRequest = CustomXMLHttpRequest
}
export const replaceFetch = () => {
  const originalFetch = window.fetch
  if (fetch.toString().includes('[native code]')) {
    window.fetch = async (url, config) => {
      const requestId = nextSvpRequestId(url)
      log.info('fetch:', url, config)
      const res = await originalFetch(url, config)
      // const u = new URL(url.startsWith('//') ? `https:${url}` : url)
      // log.log('u.pathname:', u.pathname)
      log.info('res:', res)
      const requestUrl = typeof url === 'string' ? url : url instanceof URL ? url.href : url.url
      if (requestUrl) {
        const [path, params] = requestUrl.split(/\?/);
        const replace = ResponseReplaceFetch
        if (replace[path]) {
          // debugger
          try {
            return await replace[path]({
              requestId,
              urlInfo: {
                path,
                params},
              config,
              res
            })
          }catch (e) {
            log.error(e)
          }
        }
      }
      return res
    }
  }
}
