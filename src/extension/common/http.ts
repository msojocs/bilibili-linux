const OriginXMLHttpRequest = XMLHttpRequest
export const GET = (url: string, headers: Record<string, string> = {}) => new Promise<XMLHttpRequest>((resolve, reject) => {
  const Http = new OriginXMLHttpRequest()
  Http.timeout = 10000;
  Http.open('GET', url)
  if (headers) {
    for (const key in headers) {
      Http.setRequestHeader(key, headers[key])
    }
  }
  Http.send()
  Http.onloadend = _e => {
    resolve(Http)
  }
  Http.onerror = _e => reject
})

export const POST = (url: string, body: string | null = null, headers: Record<string, string> = {}) => new Promise<XMLHttpRequest>((resolve, reject) => {
      const Http = new OriginXMLHttpRequest()
      Http.timeout = 5000;
      Http.open('POST', url)
      if (headers) {
        for (const key in headers) {
          Http.setRequestHeader(key, headers[key])
        }
      }
      Http.send(body)
      Http.onloadend = _e => {
        resolve(Http)
      }
      Http.onerror = _e => reject
    })