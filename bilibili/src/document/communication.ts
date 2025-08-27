/* eslint-disable @typescript-eslint/no-explicit-any */
import { createLogger } from "../common/log"
interface MessageRequest<T> {
  action: string
  data: T
  id: number
}
interface MessageResponse {
  data: any
  id: number
}

const communicateMap: Record<number, {
  resolve: (value: any) => void
  reject: () => void
  timeout: number
}> = {}
const log = createLogger('Communication')
export const registerMessagePage = () => {
  document.addEventListener('bili_response', function (e: CustomEventInit) {
    // e.detail contains the transferred data (can be anything, ranging
    // from JavaScript objects to strings).
    // Do something, for example:
    log.info('bili_response: ', e.detail);
    const detail = e.detail
    if (communicateMap[detail.id]) {
      const ctx = communicateMap[detail.id]
      delete communicateMap[detail.id]
      clearTimeout(ctx.timeout)
      ctx.resolve(detail.data)
    }
  });
}

let communicateId = 1
/**
 * Page向Content发送消息请求
 * @param action 消息动作
 * @param data 消息内容
 * @returns 消息回复
 */
export const requestContent = <Resp, Req = any>(action: string, data: Req) => {
  return new Promise<Resp>((resolve, reject) => {
    const id = communicateId++
    communicateMap[id] = {
      resolve: resolve,
      reject: reject,
      timeout: window.setTimeout(() => {
        delete communicateMap[id]
        reject(new Error('bili_request timeout'))
      }, 5000) // 5 seconds timeout
    }
    document.dispatchEvent(new CustomEvent<MessageRequest<Req>>('bili_request', {
      detail: {
        id,
        action: action,
        data // Some variable from Gmail.
      } // Some variable from Gmail.
    }));
  })
}
export const registerMessageContent = () => {
  const storage = chrome.storage.local
  document.addEventListener('bili_request', async function (e: CustomEventInit<MessageRequest<any>>) {
    // e.detail contains the transferred data (can be anything, ranging
    // from JavaScript objects to strings).
    // Do something, for example:
    if (!e.detail) {
      log.warn('bili_request without detail');
      return;
    }
    log.info('bili_request:', e.detail);
    const request = e.detail
    let data = null
    switch (e.detail.action) {
      case 'getStorage':
        data = await storage.get(e.detail.data.key);
        data = data[e.detail.data.key] || null;
        break;
      case 'setStorage':
        data = await storage.set({ [e.detail.data.key]: e.detail.data.value });
        break;
    }
    log.info('bili_response:', data)
    document.dispatchEvent(new CustomEvent<MessageResponse>('bili_response', {
      detail: {
        id: request.id,
        data: data // Some variable from Gmail.
      } // Some variable from Gmail.
    }));
  });
}
