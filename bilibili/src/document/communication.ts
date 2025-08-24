/* eslint-disable @typescript-eslint/no-explicit-any */
import { createLogger } from "../common/log"

const communicateMap: Record<number, {
  resolve: (value: unknown) => void
  reject: () => void
  timeout: number
}> = {}
const log = createLogger('Communication')
let communicateId = 1
document.addEventListener('ROAMING_response', function (e: any) {
  // e.detail contains the transferred data (can be anything, ranging
  // from JavaScript objects to strings).
  // Do something, for example:
  log.info('translation ROAMING_response: ', e.detail);
  const detail = e.detail
  if (communicateMap[detail.id]) {
    const ctx = communicateMap[detail.id]
    delete communicateMap[detail.id]
    clearTimeout(ctx.timeout)
    ctx.resolve(detail.data)
  }
});
window.requestBackground = (action: string, data: any) => {
  return new Promise((resolve, reject) => {
    const id = communicateId++
    communicateMap[id] = {
      resolve: resolve,
      reject: reject,
      timeout: window.setTimeout(() => {
        delete communicateMap[id]
        reject(new Error('ROAMING_request timeout'))
      }, 5000) // 5 seconds timeout
    }
    document.dispatchEvent(new CustomEvent('ROAMING_request', {
      detail: {
        id,
        action: action,
        data // Some variable from Gmail.
      } // Some variable from Gmail.
    }));
  })
}
