import { createLogger } from "../common/log"
import { ResponseReplaceFetch } from "./response-replace"
import { CustomXMLHttpRequest } from "./xml-http-request"

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
      log.info('fetch:', url, config)
      const res = await originalFetch(url, config)
      // const u = new URL(url.startsWith('//') ? `https:${url}` : url)
      // log.log('u.pathname:', u.pathname)
      log.info('res:', res)
      if (typeof url === 'string') {
        const [path, params] = url.split(/\?/);
        const replace = ResponseReplaceFetch
        if (replace[path]) {
          // debugger
          try {
            return await replace[path]({
              urlInfo: {
                path,
                params},
              config,
              res
            })
          }catch (e) {
            console.error(e)
          }
        }
      }
      return res
    }
  }
}