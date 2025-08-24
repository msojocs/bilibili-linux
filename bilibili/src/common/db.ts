import type { Bvid2DynamicIdType } from "./types"

export class CustomIndexedDB {
  name: string
  version: number
  tran: IDBTransaction | null
  db: IDBDatabase | null

  constructor(name = 'Bvid2DynamicId', version = 2) {
    this.name = name
    this.version = version
    this.tran = null
    this.db = null
  }

  /**
   * @returns {Promise<unknown>}
   */
  open() {
    // log.log('open')
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.name, this.version);
      request.onerror = (event) => {
        // console.error("为什么不允许我的 web 应用使用 IndexedDB！");
        reject(event)
      };
      request.onsuccess = (_event) => {
        // log.log('open success')
        this.db = request.result;
        resolve(this)
      };
      request.onupgradeneeded = (_e) => {
        // log.log('open', 'onupgradeneeded')
        const db = request.result;
        db.createObjectStore('b2d', { keyPath: 'bvid' })
      }
    })
  }

  putBvid2DynamicId(b2d: Bvid2DynamicIdType) {
    // log.log('addBvid2DynamicId')
    return new Promise((resolve, reject) => {
      if (this.tran == null && this.db !== null) {
        this.tran = this.db.transaction('b2d', 'readwrite')
      }
      if (!this.tran) {
        reject('get transaction fail.')
        return
      }
      const store = this.tran.objectStore('b2d')

      const req = store.put(b2d)
      req.onsuccess = (e) => {
        // log.log('addBvid2DynamicId', 'success')
        resolve(e)
      }
      req.onerror = (e) => {
        // log.log('addBvid2DynamicId', 'error', e)
        reject(e)
      }
    })
  }

  getBvid2DynamicId(bvid: string): Promise<Bvid2DynamicIdType> {
    return new Promise((resolve, reject) => {
      if (this.db == null) {
        throw new Error('请先打开数据库！')
      }
      if (this.tran == null) {
        this.tran = this.db.transaction('b2d', 'readwrite')
      }
      const store = this.tran.objectStore('b2d')

      const request = store.get(bvid)
      request.onerror = (e) => {
        reject(e)
      }
      request.onsuccess = (_e) => {
        resolve(request.result)
      }
    })
  }

}