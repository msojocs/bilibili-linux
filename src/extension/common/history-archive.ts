import md5 from "md5"
import { createLogger } from "../../common/log"

const log = createLogger('HistoryArchive')
const DEFAULT_PAGE_SIZE = 20
const BACKUP_IDLE_TIME = 1500
const BACKUP_PAGE_DELAY = 250
const BACKUP_BATCH_SIZE = 10
const MIXIN_KEY_ENC_TAB = [
  46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35,
  27, 43, 5, 49, 33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13,
  37, 48, 7, 16, 24, 55, 40, 61, 26, 17, 0, 1, 60, 51, 30, 4,
  22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11, 36, 20, 34, 44, 52,
]

export interface HistoryItem {
  [key: string]: unknown
  history?: {
    business?: string
    oid?: number | string
    epid?: number | string
    [key: string]: unknown
  }
  kid?: string
  view_at?: number
}

export interface HistoryCursor {
  [key: string]: unknown
  business?: string
  max?: number | string
  ps?: number
  view_at?: number
}

interface ArchivedHistoryItem {
  item: HistoryItem
  itemKey: string
  viewAt: number
}

interface ServerOldestBoundary {
  business: string
  epid: string
  oid: string
  syncedAt: string
  viewAt: number
}

interface LocalHistoryAccount {
  entries: HistoryItem[]
  serverOldest: ServerOldestBoundary | null
}

export interface HistoryResponse {
  [key: string]: unknown
  code?: number
  data?: {
    cursor?: HistoryCursor
    list?: HistoryItem[] | null
    [key: string]: unknown
  }
}

interface PageBoundary {
  business: string
  max: string
  viewAt: number
}

let lastForegroundHistoryRequest = 0
let wbiMixinKeyPromise: Promise<string> | null = null
const backupTasks = new Map<string, Promise<void>>()
const historyWriteTasks = new Map<string, Promise<void>>()

export const markForegroundHistoryRequest = () => {
  lastForegroundHistoryRequest = Date.now()
}

const delay = (milliseconds: number) =>
  new Promise(resolve => window.setTimeout(resolve, milliseconds))

const waitForForegroundIdle = async () => {
  while (Date.now() - lastForegroundHistoryRequest < BACKUP_IDLE_TIME) {
    await delay(BACKUP_IDLE_TIME - (Date.now() - lastForegroundHistoryRequest))
  }
  await delay(BACKUP_PAGE_DELAY)
}

const historyItemKey = (item: HistoryItem) => {
  if (typeof item.kid === 'string' && item.kid.length > 0) return item.kid

  const history = item.history || {}
  return [
    String(history.business || 'unknown'),
    String(history.oid ?? ''),
    String(history.epid ?? ''),
  ].join(':')
}

const toArchivedItem = (item: HistoryItem): ArchivedHistoryItem => ({
  item,
  itemKey: historyItemKey(item),
  viewAt: Number(item.view_at) || 0,
})

const compareArchivedItems = (left: ArchivedHistoryItem, right: ArchivedHistoryItem) =>
  right.viewAt - left.viewAt || left.itemKey.localeCompare(right.itemKey)

const sortHistoryItems = (items: HistoryItem[]) =>
  items.sort((left, right) => compareArchivedItems(toArchivedItem(left), toArchivedItem(right)))

const mergeHistoryItemLists = (existing: HistoryItem[], incoming: HistoryItem[]) => {
  const items = new Map(existing.map(item => [historyItemKey(item), item]))
  for (const item of incoming) items.set(historyItemKey(item), item)
  return sortHistoryItems([...items.values()])
}

const getHistoryAccount = (accountId: string) =>
  window.biliBridge.callNative<LocalHistoryAccount>('history/list', accountId)

const queueHistoryWrite = (
  accountId: string,
  update: (current: LocalHistoryAccount) => LocalHistoryAccount,
) => {
  const previous = historyWriteTasks.get(accountId) || Promise.resolve()
  const task = previous.catch(() => undefined).then(async () => {
    const next = update(await getHistoryAccount(accountId))
    await window.biliBridge.callNative<number>(
      'history/write',
      accountId,
      next.entries,
      next.serverOldest,
    )
  })
  historyWriteTasks.set(accountId, task)
  void task.then(
    () => {
      if (historyWriteTasks.get(accountId) === task) historyWriteTasks.delete(accountId)
    },
    () => {
      if (historyWriteTasks.get(accountId) === task) historyWriteTasks.delete(accountId)
    },
  )
  return task
}

const mergeHistoryItems = async (accountId: string, items: HistoryItem[]) => {
  if (items.length === 0) return
  await queueHistoryWrite(accountId, current => ({
    ...current,
    entries: mergeHistoryItemLists(current.entries, items),
  }))
}

const syncServerHistory = async (accountId: string, items: HistoryItem[]) => {
  if (items.length === 0) return
  const serverEntries = sortHistoryItems([...items])
  const oldestServerEntry = serverEntries[serverEntries.length - 1]
  const serverKeys = new Set(serverEntries.map(historyItemKey))

  await queueHistoryWrite(accountId, current => ({
    entries: mergeHistoryItemLists(
      serverEntries,
      current.entries.filter(item =>
        Number(item.view_at) <= Number(oldestServerEntry.view_at) &&
        !serverKeys.has(historyItemKey(item))),
    ),
    serverOldest: {
      business: String(oldestServerEntry.history?.business || ''),
      epid: String(oldestServerEntry.history?.epid ?? ''),
      oid: String(oldestServerEntry.history?.oid ?? ''),
      syncedAt: new Date().toISOString(),
      viewAt: Number(oldestServerEntry.view_at) || 0,
    },
  }))
}

const getHistoryItems = async (accountId: string) => {
  await historyWriteTasks.get(accountId)
  return sortHistoryItems((await getHistoryAccount(accountId)).entries)
}

const cookieValue = (name: string) => {
  const prefix = `${encodeURIComponent(name)}=`
  const cookie = document.cookie.split('; ').find(value => value.startsWith(prefix))
  return cookie ? decodeURIComponent(cookie.slice(prefix.length)) : ''
}

const getAccountId = async () => {
  try {
    const cookie = await window.cookieStore?.get('DedeUserID')
    if (cookie?.value) return cookie.value
  } catch (error) {
    log.warn('Unable to read account cookie with cookieStore:', error)
  }
  return cookieValue('DedeUserID') || localStorage.getItem('DedeUserID') || null
}

const cursorIdentity = (business: unknown, max: unknown) =>
  `${String(business || 'unknown')}:${String(max ?? '')}`

const itemCursorIdentity = (item: HistoryItem) =>
  cursorIdentity(item.history?.business, item.history?.oid)

const pageBoundaryFromItem = (item: HistoryItem): PageBoundary => ({
  business: String(item.history?.business || ''),
  max: String(item.history?.oid ?? ''),
  viewAt: Number(item.view_at) || 0,
})

const pageBoundaryFromParams = (params: URLSearchParams): PageBoundary => ({
  business: params.get('business') || '',
  max: params.get('max') || '',
  viewAt: Number(params.get('view_at')) || 0,
})

const findItemsAfterBoundary = (
  items: HistoryItem[],
  boundary: PageBoundary,
  limit: number,
) => {
  let boundaryIndex = -1
  if (boundary.max || boundary.business) {
    const identity = cursorIdentity(boundary.business, boundary.max)
    boundaryIndex = items.findIndex(item =>
      Number(item.view_at) === boundary.viewAt && itemCursorIdentity(item) === identity)
  }

  const candidates = boundaryIndex >= 0
    ? items.slice(boundaryIndex + 1)
    : items.filter(item => boundary.viewAt === 0 || Number(item.view_at) < boundary.viewAt)

  return candidates.slice(0, limit)
}

const setCursorFromItem = (cursor: HistoryCursor, item: HistoryItem, pageSize: number) => {
  const boundary = pageBoundaryFromItem(item)
  cursor.business = boundary.business
  cursor.max = item.history?.oid ?? boundary.max
  cursor.view_at = boundary.viewAt
  cursor.ps = pageSize
}

const isFirstHistoryPage = (params: URLSearchParams) =>
  (!params.get('max') || params.get('max') === '0') &&
  (!params.get('view_at') || params.get('view_at') === '0') &&
  (!params.has('business') || params.get('business') === '')

const cursorSignature = (cursor: HistoryCursor) =>
  `${String(cursor.business || '')}:${String(cursor.max ?? '')}:${Number(cursor.view_at) || 0}`

const fileStem = (url: string) => url.slice(url.lastIndexOf('/') + 1, url.lastIndexOf('.'))

const getWbiMixinKey = async (fetchPage: typeof window.fetch) => {
  if (!wbiMixinKeyPromise) {
    wbiMixinKeyPromise = (async () => {
      const response = await fetchPage('https://api.bilibili.com/x/web-interface/nav', {
        credentials: 'include',
      })
      if (!response.ok) throw new Error(`WBI key request failed: ${response.status}`)

      const body = await response.json() as {
        code?: number
        data?: { wbi_img?: { img_url?: string, sub_url?: string } }
      }
      const imgUrl = body.data?.wbi_img?.img_url
      const subUrl = body.data?.wbi_img?.sub_url
      if (body.code !== 0 || !imgUrl || !subUrl) throw new Error('WBI key is unavailable')

      const source = fileStem(imgUrl) + fileStem(subUrl)
      return MIXIN_KEY_ENC_TAB.map(index => source[index]).join('').slice(0, 32)
    })()
    wbiMixinKeyPromise.catch(() => {
      wbiMixinKeyPromise = null
    })
  }
  return wbiMixinKeyPromise
}

const wbiEncode = (value: string) =>
  encodeURIComponent(value.replace(/[!'()*]/g, ''))

const signWbiParams = async (params: URLSearchParams, fetchPage: typeof window.fetch) => {
  const mixinKey = await getWbiMixinKey(fetchPage)
  const unsigned = new URLSearchParams(params)
  unsigned.delete('w_rid')
  unsigned.set('wts', String(Math.floor(Date.now() / 1000)))

  const query = [...unsigned.entries()]
    .sort(([left], [right]) => left === right ? 0 : left < right ? -1 : 1)
    .map(([key, value]) => `${wbiEncode(key)}=${wbiEncode(value)}`)
    .join('&')
  return `${query}&w_rid=${md5(query + mixinKey)}`
}

const buildNextPageUrl = async (
  requestUrl: string,
  originalParams: URLSearchParams,
  cursor: HistoryCursor,
  fetchPage: typeof window.fetch,
) => {
  const url = new URL(requestUrl, location.href)
  const params = new URLSearchParams(originalParams)
  params.set('max', String(cursor.max ?? 0))
  params.set('view_at', String(cursor.view_at || 0))
  params.set('business', String(cursor.business || ''))
  url.search = originalParams.has('w_rid')
    ? await signWbiParams(params, fetchPage)
    : params.toString()
  return url.toString()
}

const backupRemainingServerHistory = (
  accountId: string,
  requestUrl: string,
  originalParams: URLSearchParams,
  firstCursor: HistoryCursor,
  firstPageItems: HistoryItem[],
  fetchPage: typeof window.fetch,
) => {
  if (backupTasks.has(accountId)) return

  const task = (async () => {
    let cursor = firstCursor
    let previousSignature = ''
    let pendingItems: HistoryItem[] = []
    const serverSnapshot = [...firstPageItems]
    let snapshotComplete = false

    try {
      for (let page = 0; page < 10_000; page += 1) {
        const signature = cursorSignature(cursor)
        if (signature === previousSignature) break
        previousSignature = signature

        await waitForForegroundIdle()
        const nextPageUrl = await buildNextPageUrl(requestUrl, originalParams, cursor, fetchPage)
        const response = await fetchPage(nextPageUrl, { credentials: 'include' })
        if (!response.ok) throw new Error(`History backup request failed: ${response.status}`)

        const body = await response.json() as HistoryResponse
        const list = body.data?.list
        if (body.code !== 0 || !Array.isArray(list)) break
        if (list.length === 0) {
          snapshotComplete = true
          break
        }

        serverSnapshot.push(...list)
        pendingItems.push(...list)
        if ((page + 1) % BACKUP_BATCH_SIZE === 0) {
          await mergeHistoryItems(accountId, pendingItems)
          pendingItems = []
        }
        if (!body.data?.cursor) {
          snapshotComplete = true
          break
        }
        cursor = body.data.cursor
      }
    } finally {
      await mergeHistoryItems(accountId, pendingItems)
    }
    if (snapshotComplete) {
      await syncServerHistory(accountId, serverSnapshot)
    }
  })()

  backupTasks.set(accountId, task)
  task
    .catch(error => log.error('Unable to finish the history backup:', error))
    .finally(() => backupTasks.delete(accountId))
}

export const archiveServerHistoryPage = async (
  requestUrl: string,
  requestParams: string,
  response: HistoryResponse,
  fetchPage: typeof window.fetch,
) => {
  const list = response.data?.list
  if (response.code !== 0 || !Array.isArray(list) || list.length === 0) return

  const accountId = await getAccountId()
  if (!accountId) {
    log.warn('Skipping history archive because the current account could not be identified')
    return
  }

  await mergeHistoryItems(accountId, list)
  const params = new URLSearchParams(requestParams)
  if (isFirstHistoryPage(params)) {
    if (response.data?.cursor) {
      backupRemainingServerHistory(
        accountId,
        requestUrl,
        params,
        { ...response.data.cursor },
        list,
        fetchPage,
      )
    } else {
      await syncServerHistory(accountId, list)
    }
  }
}

export const mergeLocalHistoryWhenServerEmpty = async (
  requestParams: string,
  response: HistoryResponse,
) => {
  const serverList = response.data?.list
  if (response.code !== 0 || !response.data || !Array.isArray(serverList) ||
    serverList.length > 0) return response

  const accountId = await getAccountId()
  if (!accountId) return response

  const params = new URLSearchParams(requestParams)
  const pageSize = Number(response.data.cursor?.ps) || Number(params.get('ps')) ||
    DEFAULT_PAGE_SIZE
  const localItems = findItemsAfterBoundary(
    await getHistoryItems(accountId),
    pageBoundaryFromParams(params),
    pageSize,
  )
  if (localItems.length === 0) return response

  response.data.list = localItems
  response.data.cursor ||= {}
  setCursorFromItem(response.data.cursor, localItems[localItems.length - 1], pageSize)
  return response
}
