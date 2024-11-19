window.log = window.log || {
  log: console.log,
  warn: console.warn,
  error: console.error,
  info: console.info,
  trace: console.trace,
}
log.log('[hook]: common', location.href)
// 简易GET,POST请求封装
const OriginXMLHttpRequest = XMLHttpRequest
const HTTP = {
  get(url, headers = {}) {
    return new Promise((resolve, reject) => {
      const Http = new OriginXMLHttpRequest()
      Http.timeout = 10000;
      Http.open('GET', url)
      if (headers) {
        for (let key in headers) {
          Http.setRequestHeader(key, headers[key])
        }
      }
      Http.send()
      Http.onloadend = e => {
        resolve(Http)
      }
      Http.onerror = e => reject
    })
  },
  /**
   *
   * @param {string} url 访问的URL
   * @param {string | null} body 请求体
   * @param headers
   * @return {Promise<XMLHttpRequest>}
   */
  post(url, body = null, headers = {}) {
    return new Promise((resolve, reject) => {
      const Http = new OriginXMLHttpRequest()
      Http.timeout = 5000;
      Http.open('POST', url)
      if (headers) {
        for (let key in headers) {
          Http.setRequestHeader(key, headers[key])
        }
      }
      Http.send(body)
      Http.onloadend = e => {
        resolve(Http)
      }
      Http.onerror = e => reject
    })
  }
}
class DB {

  constructor(name = 'Bvid2DynamicId', version = 2) {
    this.name = name
    this.version = version
    /**
     *
     * @type {IDBTransaction}
     */
    this.tran = null
    /**
     *
     * @type {IDBDatabase}
     */
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
      request.onsuccess = (event) => {
        // log.log('open success')
        this.db = event.target.result;
        resolve(this)
      };
      request.onupgradeneeded = (e) => {
        // log.log('open', 'onupgradeneeded')
        const db = e.target.result;
        db.createObjectStore('b2d', { keyPath: 'bvid' })
      }
    })
  }

  /**
   *
   * @param {{bvid: string, dynamic_id: string}} b2d
   */
  putBvid2DynamicId(b2d) {
    // log.log('addBvid2DynamicId')
    return new Promise((resolve, reject) => {
      if (this.tran == null) {
        this.tran = this.db.transaction('b2d', 'readwrite')
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

  /**
   *
   * @param {string} bvid
   * @returns {Promise<{
   *  bvid: string,
   *  dynamic_id: string
   * }>}
   */
  getBvid2DynamicId(bvid) {
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
      request.onsuccess = (e) => {
        resolve(request.result)
      }
    })
  }

}

/**
 * 动态添加JavaScript
 * @param {*} url 资源地址
 * @param {*} callback 回调方法
 */
function getScript(url, callback) {
  const script = document.createElement('script');// 创建script元素
  script.type = "text/javascript"; // 定义script元素的类型(可省略)
  if (typeof (callback) != "undefined") { // 判断是否使用回调方法(第二个参数)
    if (script.readyState) {// js状态
      log.log(script.onreadystatechange); // onreadystatechange：js状态改变时执行下方函数
      script.onreadystatechange = function () {
        if (script.readyState == "loaded" || script.readyState == "complete") { // loaded：是否下载完成 complete：js执行完毕
          script.onreadystatechange = null;
          callback();
        }
      }
    } else {
      script.onload = function () {
        callback();
      }
    }
  }
  script.src = url; // js地址
  document.body.appendChild(script);// 插入body可改为head
}

// 哔哩哔哩API
class BiliBiliApi {
  constructor(server = 'api.bilibili.com') {
    this.appKey = 'dfca71928277209b'
    this.appSecret = 'b5475a8825547a4fc26c7d518eaaa02e'
    this.server = server;
  }

  genSignParam(p) {
    let pList = []
    p.appkey = this.appKey
    for (const k in p) {
      pList.push({
        key: k,
        value: p[k]
      })
    }
    pList = pList.sort((a, b) => a.key > b.key ? 1 : -1)

    const str = pList.map(e => `${e.key}=${encodeURIComponent(e.value)}`).join('&')
    const sign = hex_md5(str + this.appSecret)
    return `${str}&sign=${sign}`
  }

  setServer(server) {
    this.server = server
  }

  getSeasonInfoByEpId(ep_id) {
    return HTTP.get(`//${this.server}/pgc/view/web/season?ep_id=${ep_id}`);
  }

  getSeasonInfo(season_id) {
    return HTTP.get(`//${this.server}/pgc/view/web/season?season_id=${season_id}`);
  }


  getSeasonInfoByEpSsIdOnBangumi(epId, seasonId) {
    log.info('get season info: ', epId, seasonId)
    const sId = window.epId2seasonId[epId]
    return HTTP.get(`https://api.bilibili.com/pgc/web/season/section?season_id=${seasonId || sId}`).then(res => {
      return Promise.resolve(JSON.parse(res.responseText))
    });
  }

  getSeasonInfoByEpSsIdOnThailand(ep_id, season_id) {
    const params = '?' + (ep_id !== '' ? `ep_id=${ep_id}` : `season_id=${season_id}`) + `&mobi_app=bstar_a&s_locale=zh_SG`;
    const newParams = UTILS.generateMobiPlayUrlParams(params, 'th');
    return HTTP.get(`//${this.server}/intl/gateway/v2/ogv/view/app/season?` + newParams).then(res => {
      return Promise.resolve(JSON.parse(res.responseText || "{}"))
    });
  }

  getSubtitleOnThailand(params) {
    return HTTP.get(`//${this.server}/intl/gateway/v2/app/subtitle?${params}`).then(res => {
      const resp = JSON.parse(res.responseText || "{}")
      const subtitles = []
      if (resp.code === 0 && resp.data.subtitles) {
        for (let subtitle of resp.data.subtitles) {
          subtitles.push({
            id: subtitle.id,
            is_str: subtitle.id.toString(),
            lan: subtitle.key,
            lan_doc: subtitle.title,
            subtitle_url: subtitle.url.replace(/https?:\/\//, '//')//.replace('s.bstarstatic.com', this.server)
          })
        }
      }
      return Promise.resolve(subtitles)
    });
  }

  getPlayURL(req, ak, area) {
    return HTTP.get(`//${this.server}/pgc/player/web/playurl?${req._params}&access_key=${ak}&area=${area}`).then(res => {
      return Promise.resolve(JSON.parse(res.responseText || "{}"))
    });
  }

  getPlayURLApp(req, ak, area) {
    const _p = req._params.split('&')
    const p = {}
    for (const _pp of _p) {
      const t = _pp.split('=')
      p[t[0]] = t[1]
    }
    log.log('origin param:', p)
    const url = `https://${this.server}/pgc/player/api/playurl`
    const param = {
      access_key: ak,
      area: area,
      build: 1442100,
      cid: p.cid,
      device: 'android',
      ep_id: p.ep_id,
      fnval: 464,
      fnver: 0,
      force_host: 0,
      fourk: 0,
      mobi_app: 'android_hd',
      platform: 'android',
      qn: 80,
      ts: (Date.now()/1000).toFixed(0),
    }
    const queryParam = this.genSignParam(param)
    return HTTP.get(`${url}?${queryParam}`).then(res => {
      return Promise.resolve(JSON.parse(res.responseText || "{}"))
    });
  }
  getSeasonInfoPgcByEpId(seasonId, epId, ak) {
    const url = `https://${this.server}/pgc/view/v2/app/season`
    const param = {
      access_key: ak,
      auto_play: 0,
      build: 1442100,
      c_locale: 'zh_CN',
      channel: 'alifenfa',
      disable_rcmd: 0,
      from_av: '',
      from_spmid: '0.0.0.0',
      is_show_all_series: 0,
      mobi_app: 'android_hd',
      platform: 'android',
      s_locale: 'zh_CN',
      spmid: 'pgc.pgc-video-detail.0.0',
      track_patch: 0,
      trackid: '',
      ts: (Date.now()/1000).toFixed(0),
      ugc_ogv_unity_exp: 1
    }
    if (seasonId) {
      param.season_id = seasonId
    }
    else if (epId) {
      param.ep_id = epId
    }
    const queryParam = this.genSignParam(param)
    return HTTP.get(`${url}?${queryParam}`).then(res => {
      return Promise.resolve(JSON.parse(res.responseText || "{}"))
    });
  }
  getPlayURLThailand(req, ak, area) {
    const params = `?${req._params}&mobi_app=bstar_a&s_locale=zh_SG`;
    const newParams = UTILS.generateMobiPlayUrlParams(params, 'th');
    return HTTP.get(`//${this.server}/intl/gateway/v2/ogv/playurl?${newParams}`).then(res => {
      // 参考：哔哩漫游 油猴插件
      // const upos = localStorage.upos||""
      // const isReplaceAkamai = localStorage.replaceAkamai === "true"
      // const _params = UTILS._params2obj(req._params)
      // const responseText = UTILS.replaceUpos(res.responseText, uposMap[upos], isReplaceAkamai, 'th')
      let result = JSON.parse(res.responseText || "{}")
      if (result.code !== 0) return Promise.reject(result);
      return Promise.resolve(UTILS.fixThailandPlayUrlJson(result));
    })
  }

  searchBangumi(params, area) {
    return new Promise(async (resolve, reject) => {
      let path = "x/v2/search/type"
      try {
        params.access_key = UTILS.getAccessToken()
      }catch (e) {
        console.error('获取access token异常：', e)
      }
      if (area === 'th') {
        path = "intl/gateway/v2/app/search/type"
        // let a = 'area=th'
        // for (let k in params) {
        //   a += `&${k}=${params[k]}`
        // }
        // params = a
      }
      params = UTILS.genSearchParam(params, area)
      const url = `https://${this.server}/${path}?${params}`
      return HTTP.get(url).then(res => {
        try {

          const resp = JSON.parse(res.responseText)
          log.log("searchBangumi: ", resp)
          if (area === "th")
            resolve(UTILS.handleTHSearchResult(resp.data?.items || []))
          else {
            if (resp.data?.items) {

              resolve(UTILS.handleAppSearchResult(resp.data?.items || []))
            } else
              resolve(resp.data?.result || [])
          }
        } catch (e) {
          reject(e)
        }
      })
    })
  }

  searchBangumi2(params, area, buvid3 = '') {
    let path = "x/web-interface/search/type"
    if (area === "th") path = "intl/gateway/v2/app/search/type"
    const url = `roaming://${this.server}/${path}?${params}&area=${area}${area === "th" ? '&type=7' : ''}`

    return HTTP.get(url, {'x-cookie': `buvid3=${buvid3}`}).then(res => {
      log.log('search result:', res)
      log.log(res.responseText)
      try {

        const resp = JSON.parse(res.responseText)
        log.log("searchBangumi: ", resp)
        if (area === "th")
          return Promise.resolve(UTILS.handleTHSearchResult(resp.data.items || []))
        else
          return Promise.resolve(resp.data?.result || [])
      } catch (e) {
        return Promise.resolve(e)
      }
    })
  }

  /**
   * 获取动态详情
   *
   * @param {string} dynamicId
   */
  getDynamicDetail(dynamicId) {
    const url = `https://api.vc.bilibili.com/dynamic_svr/v1/dynamic_svr/get_dynamic_detail?dynamic_id=${dynamicId}`
    return HTTP.get(url).then(res => {
      const resp = JSON.parse(res.responseText)
      // log.log('dynamicDetail:', resp)
      if (resp.code === 0) {
        return Promise.resolve(resp)
      }
      return Promise.reject(resp)
    })
  }

  /**
   * 获取用户卡片详情
   *
   * @param {string} userId
   */
  getUserCard(userId) {
    const url = `https://api.bilibili.com/x/web-interface/card?mid=${userId}`
    return HTTP.get(url).then(res => {
      const resp = JSON.parse(res.responseText)
      // log.log('dynamicDetail:', resp)
      if (resp.code === 0) {
        return Promise.resolve(resp)
      }
      return Promise.reject(resp)
    })
  }

  genDeviceId(){
    let deviceId = localStorage.getItem('device_id')
    if (deviceId != null) return deviceId
    deviceId = hex_md5(`${Math.random()}`) + hex_md5(`${Math.random()}`)
    localStorage.setItem('device_id', deviceId)
    return deviceId
  }

  /**
   * 获取登录二维码
   * @return {Promise<any>}
   * @constructor
   */
  async HD_getLoginQrCode() {
    const url = 'https://passport.bilibili.com/x/passport-tv-login/qrcode/auth_code'
    // const url = 'https://passport.snm0516.aisee.tv/x/passport-tv-login/qrcode/auth_code'
    const deviceId = this.genDeviceId()
    const buvid = deviceId + deviceId.substring(0, 5)
    const param = {
      bili_local_id: deviceId,
      build: 1442100,
      buvid: buvid,
      c_locale: 'zh_CN',
      channel: 'yingyongbao',
      code: '',
      device: 'phone',
      device_id: deviceId,
      device_name: 'OnePlus7TPro',
      device_platform: 'Android10OnePlusHD1910',
      disable_rcmd: 0,
      guid: buvid,
      local_id: buvid,
      mobi_app: 'android_hd',
      networkstate: 'wifi',
      platform: 'android',
      s_locale: 'zh_CN',
      spm_id: 'from_spmid',
      statistics: '{"appId":5,"platform":3,"version":"1.44.2","abtest":""}',
      sys_ver: '29',
      ts: (Date.now()/1000).toFixed(0)
    }
    const _resp = await HTTP.post(url, this.genSignParam(param), {
      'Content-Type': 'application/x-www-form-urlencoded',
      'app-key': 'android_hd',
      env: 'prod',
      buvid: buvid,
    })
    const resp = JSON.parse(_resp.responseText)
    if (resp.code === 0) {
      return resp
    }
    else {
      return Promise.reject(resp)
    }
  }

  /**
   * 检查登录结果
   * @param authCode
   * @return {Promise<any>}
   * @constructor
   */
  async HD_pollCheckLogin(authCode) {
    const url = 'https://passport.bilibili.com/x/passport-tv-login/qrcode/poll'
    const deviceId = this.genDeviceId()
    const buvid = deviceId + deviceId.substring(0, 5)
    const param = {
      auth_code: authCode,
      bili_local_id: deviceId,
      build: 1442100,
      buvid: buvid,
      c_locale: 'zh_CN',
      channel: 'yingyongbao',
      device: 'phone',
      device_id: deviceId,
      device_name: 'OnePlus7TPro',
      device_platform: 'Android10OnePlusHD1910',
      disable_rcmd: 0,
      extend: '',
      local_id: buvid,
      mobi_app: 'android_hd',
      platform: 'android',
      s_locale: 'zh_CN',
      spm_id: 'from_spmid',
      statistics: '{"appId":5,"platform":3,"version":"1.44.2","abtest":""}',
      ts: (Date.now()/1000).toFixed(0),
    }
    const _resp = await HTTP.post(url, this.genSignParam(param), {
      'Content-Type': 'application/x-www-form-urlencoded',
      'app-key': 'android_hd',
      env: 'prod',
      buvid: buvid,
    })
    const resp = JSON.parse(_resp.responseText)
    if (resp.code >= 0) {
      return resp
    }
    else {
      return Promise.reject(resp)
    }

  }

}

const space_account_info_map = {
  "11783021": {
    "code": 0, "message": "0", "ttl": 1, "data": {
      "mid": 11783021,
      "name": "哔哩哔哩番剧出差",
      "sex": "保密",
      "face": "http://i0.hdslb.com/bfs/face/9f10323503739e676857f06f5e4f5eb323e9f3f2.jpg",
      "sign": "",
      "rank": 10000,
      "level": 6,
      "jointime": 0,
      "moral": 0,
      "silence": 0,
      "coins": 0,
      "fans_badge": false,
      "fans_medal": {"show": false, "wear": false, "medal": null},
      "official": {"role": 3, "title": "哔哩哔哩番剧出差 官方账号", "desc": "", "type": 1},
      "vip": {
        "type": 0,
        "status": 0,
        "due_date": 0,
        "vip_pay_type": 0,
        "theme_type": 0,
        "label": {
          "path": "",
          "text": "",
          "label_theme": "",
          "text_color": "",
          "bg_style": 0,
          "bg_color": "",
          "border_color": ""
        },
        "avatar_subscript": 0,
        "nickname_color": "",
        "role": 0,
        "avatar_subscript_url": ""
      },
      "pendant": {"pid": 0, "name": "", "image": "", "expire": 0, "image_enhance": "", "image_enhance_frame": ""},
      "nameplate": {"nid": 0, "name": "", "image": "", "image_small": "", "level": "", "condition": ""},
      "user_honour_info": {"mid": 0, "colour": null, "tags": []},
      "is_followed": true,
      "top_photo": "http://i2.hdslb.com/bfs/space/cb1c3ef50e22b6096fde67febe863494caefebad.png",
      "theme": {},
      "sys_notice": {},
      "live_room": {
        "roomStatus": 1,
        "liveStatus": 0,
        "url": "https://live.bilibili.com/931774",
        "title": "「梦之祭！部」 社团活动最终回",
        "cover": "http://i0.hdslb.com/bfs/live/c89c499096fa6527765de1fcaa021c9e2db7fbf8.jpg",
        "online": 0,
        "roomid": 931774,
        "roundStatus": 0,
        "broadcast_type": 0
      },
      "birthday": "",
      "school": {"name": ""},
      "profession": {"name": ""},
      "tags": null,
      "series": {"user_upgrade_status": 3, "show_upgrade_window": false}
    }
  },
  "1988098633": {
    "code": 0, "message": "0", "ttl": 1, "data": {
      "mid": 1988098633,
      "name": "b站_戲劇咖",
      "sex": "保密",
      "face": "http://i0.hdslb.com/bfs/face/member/noface.jpg",
      "sign": "提供bilibili港澳台地區專屬戲劇節目。",
      "rank": 10000,
      "level": 2,
      "jointime": 0,
      "moral": 0,
      "silence": 0,
      "coins": 0,
      "fans_badge": false,
      "fans_medal": {"show": false, "wear": false, "medal": null},
      "official": {"role": 0, "title": "", "desc": "", "type": -1},
      "vip": {
        "type": 0,
        "status": 0,
        "due_date": 0,
        "vip_pay_type": 0,
        "theme_type": 0,
        "label": {
          "path": "",
          "text": "",
          "label_theme": "",
          "text_color": "",
          "bg_style": 0,
          "bg_color": "",
          "border_color": ""
        },
        "avatar_subscript": 0,
        "nickname_color": "",
        "role": 0,
        "avatar_subscript_url": ""
      },
      "pendant": {"pid": 0, "name": "", "image": "", "expire": 0, "image_enhance": "", "image_enhance_frame": ""},
      "nameplate": {"nid": 0, "name": "", "image": "", "image_small": "", "level": "", "condition": ""},
      "user_honour_info": {"mid": 0, "colour": null, "tags": []},
      "is_followed": true,
      "top_photo": "http://i0.hdslb.com/bfs/space/cb1c3ef50e22b6096fde67febe863494caefebad.png",
      "theme": {},
      "sys_notice": {},
      "live_room": {
        "roomStatus": 0,
        "liveStatus": 0,
        "url": "",
        "title": "",
        "cover": "",
        "online": 0,
        "roomid": 0,
        "roundStatus": 0,
        "broadcast_type": 0
      },
      "birthday": "01-01",
      "school": {"name": ""},
      "profession": {"name": ""},
      "tags": null,
      "series": {"user_upgrade_status": 3, "show_upgrade_window": false}
    }
  },
  "2042149112": {
    "code": 0, "message": "0", "ttl": 1, "data": {
      "mid": 2042149112,
      "name": "b站_綜藝咖",
      "sex": "保密",
      "face": "http://i0.hdslb.com/bfs/face/member/noface.jpg",
      "sign": "提供bilibili港澳台地區專屬綜藝節目。",
      "rank": 10000,
      "level": 3,
      "jointime": 0,
      "moral": 0,
      "silence": 0,
      "coins": 0,
      "fans_badge": false,
      "fans_medal": {"show": false, "wear": false, "medal": null},
      "official": {"role": 0, "title": "", "desc": "", "type": -1},
      "vip": {
        "type": 0,
        "status": 0,
        "due_date": 0,
        "vip_pay_type": 0,
        "theme_type": 0,
        "label": {
          "path": "",
          "text": "",
          "label_theme": "",
          "text_color": "",
          "bg_style": 0,
          "bg_color": "",
          "border_color": ""
        },
        "avatar_subscript": 0,
        "nickname_color": "",
        "role": 0,
        "avatar_subscript_url": ""
      },
      "pendant": {"pid": 0, "name": "", "image": "", "expire": 0, "image_enhance": "", "image_enhance_frame": ""},
      "nameplate": {"nid": 0, "name": "", "image": "", "image_small": "", "level": "", "condition": ""},
      "user_honour_info": {"mid": 0, "colour": null, "tags": []},
      "is_followed": true,
      "top_photo": "http://i0.hdslb.com/bfs/space/cb1c3ef50e22b6096fde67febe863494caefebad.png",
      "theme": {},
      "sys_notice": {},
      "live_room": {
        "roomStatus": 0,
        "liveStatus": 0,
        "url": "",
        "title": "",
        "cover": "",
        "online": 0,
        "roomid": 0,
        "roundStatus": 0,
        "broadcast_type": 0
      },
      "birthday": "",
      "school": {"name": ""},
      "profession": {"name": ""},
      "tags": null,
      "series": {"user_upgrade_status": 3, "show_upgrade_window": false}
    }
  },
};
const uposMap = {
  bos: 'upos-sz-mirrorbos.bilivideo.com',
  cos: 'upos-sz-mirrorcos.bilivideo.com',
  cosb: 'upos-sz-mirrorcosb.bilivideo.com',
  coso1: 'upos-sz-mirrorcoso1.bilivideo.com',
  cosov: 'upos-sz-mirrorcosov.bilivideo.com',
  hw: 'upos-sz-mirrorhw.bilivideo.com',
  hwb: 'upos-sz-mirrorhwb.bilivideo.com',
  hwo1: 'upos-sz-mirrorhwo1.bilivideo.com',
  hwov: 'upos-sz-mirrorhwov.bilivideo.com',
  ali: 'upos-sz-mirrorali.bilivideo.com',
  alib: 'upos-sz-mirroralib.bilivideo.com',
  alio1: 'upos-sz-mirroralio1.bilivideo.com',
  aliov: 'upos-sz-mirroraliov.bilivideo.',
  '08c': 'upos-sz-mirror08c.bilivideo.com',
  '08h': 'upos-sz-mirror08h.bilivideo.com',
  '08ct': 'upos-sz-mirror08ct.bilivideo.com',
  tf_hw: 'upos-tf-all-hw.bilivideo.com',
  tf_tx: 'upos-tf-all-tx.bilivideo.com',
  hk_bcache: 'cn-hk-eq-bcache-01.bilivideo.com',
  akamai: 'upos-hz-mirrorakam.akamaized.net',
};
const AREA_MARK_CACHE = {}

// HOOK
const URL_HOOK = {

  /**
   * 番剧信息
   * @param {XMLHttpRequest} req 原请求结果
   * @returns {Promise<void>}
   */
  "https://api.bilibili.com/pgc/view/pc/season": async (req) => {
    UTILS.enableReferer();
    log.log('HOOK', req)
    const resp = JSON.parse(req.responseText || "{}")
    log.info('season result:', resp)
    if (resp.code !== 0) {
      // 状态码异常
      const api = new BiliBiliApi()
      log.log('upos: ', localStorage.upos)

      const serverList = JSON.parse(localStorage.serverList || "{}")
      log.log('serverList: ', serverList)

      let seasonInfo = null;
      const params = UTILS._params2obj(req._params)
      log.log('params: ', params)

      seasonInfo = await api.getSeasonInfoPgcByEpId(params.season_id, params.ep_id, UTILS.getAccessToken())

      // seasonInfo = await api.getSeasonInfoByEpSsIdOnBangumi(params.ep_id || "", params.season_id || "")
      log.log('getSeasonInfo:', seasonInfo)
      if (seasonInfo.code === 0) {
        seasonInfo = seasonInfo.data
        const eps = seasonInfo.modules[0].data.episodes
        for (const ep of eps) {
          ep.rights.area_limit = 0
          ep.badge_info.text = ''
          ep.rights.allow_dm = 1
        }
        const result = {
          code: 0,
          message: 'success',
          result: {
            activity: {
              head_bg_url: "",
              id: 0,
              title: ""
            },
            actors: seasonInfo.actor.info,
            alias: seasonInfo.alias,
            areas: seasonInfo.areas,
            bkg_cover: '',
            cover: seasonInfo.cover,
            enable_vt: seasonInfo.enable_vt,
            episodes: eps,
            evaluate: seasonInfo.evaluate,
            freya: {
              bubble_desc: "ta给你说了悄悄话",
              bubble_show_cnt: 10000,
              icon_show: 1
            },
            hide_ep_vv_vt_dm: seasonInfo.test_switch.hide_ep_vv_vt_dm,
            icon_font: seasonInfo.icon_font,
            jp_title: '',
            link: seasonInfo.link.replace('bilibili://pgc/media/', 'http://www.bilibili.com/bangumi/media/md'),
            media_id: seasonInfo.media_id,
            mode: seasonInfo.mode,
            new_ep: seasonInfo.new_ep,
            payment: seasonInfo.payment,
            play_strategy: seasonInfo.play_strategy,
            // 没找到来源
            positive: {
              id: 97921,
              title: "正片"
            },
            publish: seasonInfo.publish,
            rating: seasonInfo.rating || {
              "count": 1,
              "score": 100
            },
            record: seasonInfo.record,
            rights: seasonInfo.rights,
            season_id: seasonInfo.season_id,
            season_title: seasonInfo.season_title,
            // 缺失
            seasons: [],
            // 缺失
            section: [],
            series: seasonInfo.series,
            share_copy: seasonInfo.share_copy,
            share_sub_title: seasonInfo.dynamic_subtitle,
            share_url: seasonInfo.share_url,
            show: {
              wide_screen: 0
            },
            show_season_type: seasonInfo.show_season_type,
            square_cover: seasonInfo.square_cover,
            staff: seasonInfo.staff.info,
            stat: seasonInfo.stat,
            status: seasonInfo.status,
            styles: seasonInfo.styles.map(e => e.name),
            subtitle: seasonInfo.subtitle,
            title: seasonInfo.title,
            total: seasonInfo.total,
            type: seasonInfo.type,
            // 缺失
            up_info: {},
            user_status: {
              ...seasonInfo.user_status,
              area_limit: 0,
              ban_area_show: 0,
            },
          }
        }
        req.responseText = JSON.stringify(result)
        return;
      }
      const server = serverList['th'] || ""
      if (server.length === 0) return;

      api.setServer(server)

      seasonInfo = await api.getSeasonInfoByEpSsIdOnThailand(params.ep_id || "", params.season_id || "")
      log.log('去th找:', seasonInfo)
      if (seasonInfo.code !== 0 || seasonInfo.result.modules.length === 0) return;
      AREA_MARK_CACHE[params.ep_id] = 'th'
      seasonInfo.result.episodes = seasonInfo.result.episodes || seasonInfo.result.modules[0].data.episodes
      delete seasonInfo.result.modules
      // title id
      seasonInfo.result.episodes.forEach(ep => {
        ep.title = ep.title || `第${ep.index}话 ${ep.index_title}`
        ep.id = ep.id || ep.ep_id
        ep.ep_id = ep.ep_id || ep.id
        ep.episode_type = 0
        ep.status = 2
        ep.duration = ep.duration || 0
        ep.index_title = ep.long_title
        delete ep.long_title
      })
      seasonInfo.result.status = seasonInfo.result.status || 2
      seasonInfo.result.user_status && (seasonInfo.result.user_status.login = seasonInfo.result.user_status?.login || 1)
      seasonInfo.result.rights.watch_platform = 0
      seasonInfo.result.rights.allow_download = 1
      seasonInfo.result.seasons = []
      log.log('seasonInfo2: ', seasonInfo)
      req.responseText = JSON.stringify(seasonInfo)

    } else {
      // 一些番剧可以获取到信息，但是内部有限制区域
      resp.result.episodes.forEach(ep => {
        ep.rights && (ep.rights.area_limit = 0, ep.rights.allow_dm = 0, ep.rights.allow_download = 1)
      })
      resp.result.rights.allow_download = 1
      req.responseText = JSON.stringify(resp)
    }
  },
  "https://api.bilibili.com/pgc/view/web/season/user/status": async (req) => {
    // log.log("解除区域限制")
    const resp = JSON.parse(req.responseText)
    resp.result && (resp.result.area_limit = 0)
    req.responseText = JSON.stringify(resp)
  },
  "https://api.bilibili.com/pgc/season/episode/web/info": async (req) => {
    // log.log("解除区域限制")
  },

  /**
   * 获取播放链接
   * @param {XMLHttpRequest} req 原请求结果
   * @returns {Promise<void>}
   */
  "//api.bilibili.com/pgc/player/web/v2/playurl": async (req) => {
    const resp = JSON.parse(req.responseText)

    // 默认pc，要referer
    UTILS.enableReferer()

    if (resp.code !== 0) {
      log.warn('[player]: 播放链接获取出现问题')
      const params = UTILS._params2obj(req._params)
      const serverList = JSON.parse(localStorage.serverList || "{}")
      const upos = localStorage.upos || ""
      const isReplaceAkamai = localStorage.replaceAkamai === "true"
      const accessKey = UTILS.getAccessToken()
      log.info('serverList:', serverList)

      // android，不要referer
      UTILS.disableReferer()

      const api = new BiliBiliApi()
      if (serverList[AREA_MARK_CACHE[params.ep_id]] && serverList[AREA_MARK_CACHE[params.ep_id]].length > 0) {
        api.setServer(serverList[AREA_MARK_CACHE[params.ep_id]])
        let playURL;
        if (AREA_MARK_CACHE[params.ep_id] !== "th")
          playURL = await api.getPlayURLApp(req, accessKey || "", AREA_MARK_CACHE[params.ep_id])
        else
          playURL = await api.getPlayURLThailand(req, accessKey || "", AREA_MARK_CACHE[params.ep_id])
        playURL.result.is_preview = 0
        playURL.result.status = 2
        if (playURL.code === 0) {
          log.log('playURL:', playURL)
          // 从cache的区域中取到了播放链接
          req.responseText = UTILS.replaceUpos(JSON.stringify(playURL), uposMap[upos], isReplaceAkamai, AREA_MARK_CACHE[params.ep_id])
          return;
        }
      }
      // 没有从cache的区域中取到播放链接，遍历漫游服务器
      for (let area in serverList) {
        const server = serverList[area] || ""
        log.log('getPlayURL from ', area, ' - ', server)
        if (server.length === 0) continue;
        api.setServer(server)

        let playURL
        if (area !== "th") {
          UTILS.enableReferer()
          playURL = await api.getPlayURLApp(req, accessKey || "", area)
        } else {
          UTILS.disableReferer()
          playURL = await api.getPlayURLThailand(req, accessKey || "", area)
        }
        log.log("已获取播放链接", playURL)
        if (playURL.code !== 0) continue
        playURL.result.is_preview = 0
        playURL.result.status = 2
        log.log('playURL:', playURL)
        // 解析成功
        AREA_MARK_CACHE[params.ep_id] = area

        // req.responseText = JSON.stringify(playURL)
        req.responseText = UTILS.replaceUpos(JSON.stringify(playURL), uposMap[upos], isReplaceAkamai, area)
        break
      }
    }
  },

  /**
   * 获取播放链接
   * @param {XMLHttpRequest} req 原请求结果
   * @returns {Promise<void>}
   */
  "//api.bilibili.com/x/player/playurl": async (req) => {
    // 默认pc，要referer
    UTILS.enableReferer()
  },

  /**
   * 获取播放链接
   * @param {XMLHttpRequest} req 原请求结果
   * @returns {Promise<void>}
   */
  '//api.bilibili.com/x/player/wbi/playurl': async (req) => {
    // 默认pc，要referer
    UTILS.enableReferer()
    const upos = localStorage.upos || ""
    const isReplaceAkamai = localStorage.replaceAkamai === "true"
    if (localStorage.uposApplyAll === 'true')
    {
      // 应用到所有视频
      req.responseText = UTILS.replaceUpos(req.responseText, uposMap[upos], isReplaceAkamai, '')
    }
  },

  /**
   * 用户信息
   * @param {XMLHttpRequest} req 原请求结果
   * @returns {Promise<void>}
   */
  "//api.bilibili.com/x/space/acc/info": async (req) => {
    const resp = JSON.parse(req.responseText)
    if (resp.code !== 0) {
      const params = UTILS._params2obj(req._params)
      const userInfo = space_account_info_map[params.mid]
      if (userInfo) req.responseText = JSON.stringify(userInfo)
    }
  },

  /**
   * 动态信息1
   * @param {XMLHttpRequest} req 原请求结果
   * @returns {Promise<void>}
   */
  "https://api.bilibili.com/x/polymer/web-dynamic/v1/feed/all": async (req) => {
    log.info('动态处理1...')
    const resp = JSON.parse(req.responseText)
    if (resp.code === 0) {
      try {
        const db = new DB()
        await db.open();
        const { items } = resp.data
        for (const item of items) {
          if (item.modules.module_author.mid === 11783021) {
            await db.putBvid2DynamicId({
              bvid: item.modules.module_dynamic.major.archive.bvid,
              dynamic_id: item.id_str
            })
          }
        }
      }catch (e) {
        console.error('动态信息1:', e)
      }

    }
  },

  /**
   * 动态信息2
   * @param {XMLHttpRequest} req 原请求结果
   * @returns {Promise<void>}
   */
  "//api.bilibili.com/x/polymer/web-dynamic/desktop/v1/feed/all": async (req) => {
    log.info('动态处理2...')
    const resp = JSON.parse(req.responseText)
    if (resp.code === 0) {
      try {
        const db = new DB()
        await db.open();
        const { items } = resp.data
        for (const item of items) {
          if (item.modules[0].module_author.user.mid === 11783021) {
            await db.putBvid2DynamicId({
              bvid: item.modules[1].module_dynamic.dyn_archive.bvid,
              dynamic_id: item.id_str
            })
          }
        }
      }catch (e) {
        console.error('动态信息2:', e)
      }

    }
  },

  /**
   * 搜索
   * @param {XMLHttpRequest} req 原请求结果
   * @returns {Promise<void>}
   */
  "https://api.bilibili.com/x/web-interface/search/type": async (req) => {
    // log.log('===搜索 HOOK: ', req)
    const params = UTILS._params2obj(req._params)
    if (params.search_type === 'media_bangumi') {
      // 搜索番剧
      const searchResult = JSON.parse(req.responseText)
      log.log('预期结果：', searchResult)
      searchResult.data.result = searchResult.data.result || []
      const api = new BiliBiliApi()
      const serverList = JSON.parse(localStorage.serverList || "{}")
      for (let area in serverList) {
        const server = serverList[area] || ""
        if (server.length === 0) continue

        api.setServer(server)
        try {
          // const buvid3 = await cookieStore.get('buvid3') || {}
          function sleep(d) {
            for (var t = Date.now(); Date.now() - t <= d;) {
            }
          }

          sleep(500); //当前方法暂停0.5秒
          // const result = await api.searchBangumi2(req._params, area, buvid3.value || '')
          const result = await api.searchBangumi(params, area)
          // log.log('searchResult:', result)
          result.forEach(s => {
            s.title = `[${area}]${s.title}`
          })
          searchResult.data.result.push(...result)
          req.responseText = JSON.stringify(searchResult)
        } catch (err) {

          console.error('搜索异常:', err)
        }
      }
    }
  },

  /**
   * 字幕
   * @param {XMLHttpRequest} req 原请求结果
   * @returns {Promise<void>}
   */
  "//api.bilibili.com/x/player/wbi/v2": async (req) => {
    if (!req._params) return;
    const resp = JSON.parse(req.responseText || "{}")
    const serverList = JSON.parse(localStorage.serverList || "{}")
    if ((resp.code === -400 || resp.code === -404 || resp.data.subtitle.subtitles.length === 0) && serverList.th) {
      log.log('处理字幕')
      // 字幕请求失败
      const api = new BiliBiliApi(serverList.th);
      const subtitles = await api.getSubtitleOnThailand(req._params);
      if (resp.code === 0) {
        resp.data.subtitle.subtitles.push(...subtitles)
      } else if (subtitles.length > 1) {
        const id = await cookieStore.get('DedeUserID') || {}
        resp.code = 0
        resp.message = "0"
        resp.data = {
          // 解决东南亚未登录
          login_mid: id?.value || 0,
          // login_mid_hash: "7874c463",
          subtitle: {
            allow_submit: false,
            lan: "",
            lan_doc: "",
            subtitles
          }
        }
      }
    }
    // 删除旧的规则
    for (const key in URL_HOOK) {
      if (key && key.endsWith('json.translate')){
        delete URL_HOOK[key]
      }
    }
    // 查找简体
    const zhHans = resp.data?.subtitle?.subtitles?.find(e=>e.lan === 'zh-Hans')
    if (!zhHans){
      // 没有简体，查找繁体
      const zhHant = resp.data?.subtitle?.subtitles?.find(e=>e.lan === 'zh-Hant')
      if (!!zhHant){
        // 有繁体，构造简体拦截器
        const zhHans = JSON.parse(JSON.stringify(zhHant))
        zhHans.lan = 'zh-Hans'
        zhHans.lan_doc = '中文（简体）'
        zhHans.id = 1145141919810
        zhHans.id_str = `${zhHans.id}`
        zhHans.subtitle_url = `${zhHans.subtitle_url}&translate=zh-Hans`
        URL_HOOK[zhHans.subtitle_url.split('?')[0]] = URL_HOOK.zhHansSubtitle
        resp.data.subtitle.subtitles.push(zhHans)
      }
    }
    // log.log('subtitle result:', resp)
    req.responseText = JSON.stringify(resp)
  },

  /**
   * 繁体字幕转简体字幕
   * @param {XMLHttpRequest} req 原请求结果
   * @returns {Promise<void>}
   */
  zhHansSubtitle: async (req) => {
    // log.log('繁体转简体', req)
    if (req._params.includes('zh-Hans')) {
      // log.log('繁体字幕数据: ', req.responseText)
      const tc2sc = window?.ChineseConversionAPI?.tc2sc
      if (!!tc2sc) {
        req.responseText = tc2sc(req.responseText)
        req.response = JSON.parse(req.responseText)
        req.status = 200
        // log.log('中文字幕数据: ', req.responseText)
      }
    }
  },

}
const URL_HOOK_FETCH = {
  /**
   * 搜索
   * @param {{urlInfo: [string, string], config: RequestInit, res: Response }} data 原请求结果
   * @returns {Promise<Response>}
   */
  "https://api.bilibili.com/x/web-interface/search/type": async (data) => {
    // log.log('===搜索 HOOK: ', req)
    const params = UTILS._params2obj(data.urlInfo[1])
    if (params.search_type === 'media_bangumi') {
      // 搜索番剧
      const searchResult = await data.res.json()
      log.log('预期结果：', searchResult)
      searchResult.data.result = searchResult.data.result || []
      const api = new BiliBiliApi()
      const serverList = JSON.parse(localStorage.serverList || "{}")
      for (let area in serverList) {
        const server = serverList[area] || ""
        if (server.length === 0) continue

        api.setServer(server)
        try {
          // const buvid3 = await cookieStore.get('buvid3') || {}
          function sleep(d) {
            for (var t = Date.now(); Date.now() - t <= d;) {
            }
          }

          sleep(500); //当前方法暂停0.5秒
          // const result = await api.searchBangumi2(req._params, area, buvid3.value || '')
          const result = await api.searchBangumi(params, area)
          // log.log('searchResult:', result)
          result.forEach(s => {
            s.title = `[${area}]${s.title}`
          })
          searchResult.data.result.push(...result)
          data.res.data = searchResult
        } catch (err) {

          console.error('搜索异常:', err)
        }
      }
    }
    return data.res
  },
  /**
   * 用户信息
   * @param {{urlInfo: [string, string], config: RequestInit, res: Response }} data 原请求结果
   * @returns {Promise<Response>}
   */
  "//api.bilibili.com/x/space/acc/info": async (data) => {
    const resp = await data.res.clone().json()
    try {
      if (resp.code !== 0) {
        const params = UTILS._params2obj(data.urlInfo[1])
        const userInfo = space_account_info_map[params.mid]
        if (userInfo) data.res = Response.json(userInfo)
      }
    }catch (e) {
      console.error('用户信息替换失败：', e)
    }
    return data.res
  },

  /**
   * 视频信息
   * @param {{urlInfo: [string, string], config: RequestInit, res: Response }} data 原请求结果
   * @returns {Promise<Response>}
   */
  "https://api.bilibili.com/x/web-interface/view/detail": async (data) => {
    const resp = await data.res.clone().json()
    log.info('request for dynamic detail', resp)
    try {
      if (resp.code !== 0) {
        const params = UTILS._params2obj(data.urlInfo[1])
        log.info('get dynamic id')
        // 获取dynamic_id
        const db = new DB()
        await db.open()
        const b2d = await db.getBvid2DynamicId(params.bvid)
        log.info('get dynamic id result:', b2d)
        // 获取动态详情
        const bili = new BiliBiliApi();
        const detail = await bili.getDynamicDetail(b2d.dynamic_id)
        const dynamicDetail = await biliBridgePc.callNative('roaming/queryDynamicDetail', b2d.dynamic_id, UTILS.getAccessToken())
        log.info('dynamic detail phone:', dynamicDetail)
        const dynamic = dynamicDetail.item.modules.find(e => e.module_type === 'module_dynamic')
        const epid = dynamic.module_dynamic.dyn_archive.uri.match(/ep\d+/)[0]
        // 构造数据
        const res = await UTILS.genVideoDetailByDynamicDetail(detail.data)
        res.View.redirect_url = `https://www.bilibili.com/bangumi/play/${epid}`
        log.info('dynamic detail:', res)
        data.res.data = {
          code: 0,
          message: '',
          msg: '',
          data: res
        }
        log.info('修復結果：', JSON.stringify(data.res))
        return data.res
      }
      data.res = Response.json(resp)
      // debugger
    }catch (e) {
      log.error('視頻信息修復失败：', e)
    }
    return data.res
  },

  /**
   * 视频列表
   * 
   * @param {{urlInfo: [string, string], config: RequestInit, res: Response }} data 原请求结果
   * @returns {Promise<Response>}
   */
  "https://api.bilibili.com/x/web-interface/wbi/index/top/feed/rcmd": async (data) => {
    const resp = await data.res.clone().json()
    // resp.data.item = resp.data.item.filter(e => e.goto !== 'ad')
    data.res = Response.json(resp)
    return data.res
  }

}

/*请求响应修改器1.0*/
window.getHookXMLHttpRequest = (win) => {
  if (win.XMLHttpRequest.isHooked) {
    return win.XMLHttpRequest
  }
  return class HttpRequest extends win.XMLHttpRequest {
    static get isHooked () {
      return true
    }
    constructor() {
      super(...arguments);
      this._url = "";
      this._params = "";
      this._status = 200
      this._responseText = ''
      this._response = null

      this._onreadystatechange = null;
      this._onloadend = null;
      this._onload = null;
      super.onloadend = async () => {
        if (this._onloadend) {
          if (URL_HOOK[this._url]) await URL_HOOK[this._url](this)
          this._onloadend();
        }
      };
      super.onload = async () => {
        if (this._onload) {
          // log.log('onload', this._url)
          if (URL_HOOK[this._url]) await URL_HOOK[this._url](this)
          this._onload();
        }
      };
      super.onreadystatechange = () => {
        log.log(...arguments)
        if (this.readyState === 4 && this.status === 200) {
          // log.log('onreadystatechange', this, super.responseType)
          switch (super.responseType) {
            case 'text':
            case '': {
              const responseText = super.responseText;
              if (responseText) {
                //   log.log(responseText)
                //   const res = null;
                //   if (res !== null) {
                //     this.responseText = res
                //   } else {
                //     this.responseText = super.responseText
                //   }
                // } else {
                this.responseText = responseText
              }
            }
              break;
            case 'json': {
              const response = super.response;
              if (response) {
                //   const res = null;
                //   if (res !== null) {
                //     this.response = res
                //   } else {
                //     this.response = super.response
                //   }
                // } else {
                this.response = response
              }
            }
              break;
            default:
              // console.warn('unsupported type:', super.responseType)
              break;
          }
        }
        // 用于arraybuffer等
        try {
          if (super.responseType === 'arraybuffer')
            this.response = super.response
        }catch (e) {
          console.error('响应体处理异常：', e)
        }
        try {
          if (this._onreadystatechange) {
            // debugger
            if (this.readyState === 4 && URL_HOOK[this._url]) URL_HOOK[this._url](this).then(() => this._onreadystatechange())
            else
              this._onreadystatechange();
          }
        } catch (err) {
          log.log('未处理的error: ', err)
        }
      };
    }
    get response () {
      if (this._response === null) return super.response
      return this._response
    }
    set response (v) {
      this._response = v
    }

    get responseText () {
      return this._responseText
    }
    set responseText (v) {
      this._responseText = v
    }

    get status () {
      return this._status
    }
    set status (v) {
      this._status = v
    }

    send() {
      // log.log('send:', ...arguments)
      const arr = [...arguments];
      // if (arr[0]) {
      // const params = null;
      // if (params !== null) {
      //   arr[0] = params
      // }
      // }
      return super.send(...arr)
    }

    open() {
      const arr = [...arguments];
      const url = arr[1];
      // log.log('request for: ', ...arr)
      if (url) {
        const [path, params] = url.split(/\?/);
        this._url = path;
        this._params = params;
        // if (this._params) {
        // const params = null;
        // if (params !== null) {
        //   arr[1] = this._url + "?" + params
        // }
        // }
      }
      return super.open(...arr)
    }

    set onreadystatechange(v) {
      this._onreadystatechange = v
    }
    set onloadend(v) {
      this._onloadend = v
    }
    set onload(v) {
      this._onload = v
    }

    // onload(){
    //   log.log('onload', ...arguments)
    // }
  }

}

const originalFetch = window.fetch
if (fetch.toString().includes('[native code]')) {
  window.fetch = async (url, config) => {
    log.log('fetch:', url, config)
    const res = await originalFetch(url, config)
    // const u = new URL(url.startsWith('//') ? `https:${url}` : url)
    // log.log('u.pathname:', u.pathname)
    log.log('res:', res)
    const [path, params] = url.split(/\?/);
    if (URL_HOOK_FETCH[path]) {
      // debugger
      try {
        return await URL_HOOK_FETCH[path]({
          urlInfo: [path, params],
          config,
          res
        })
      }catch (e) {
        console.error(e)
      }
    }
    return res
  }
}

function _deCode(params) {
  return params.split("&").map((a) => {
    const [key, value] = a.split("=");
    if (!key) return "";
    return decodeURIComponent(key) + "=" + decodeURIComponent(value)
  })
}

log.log('替换XMLHttpRequest')
if (!location.href.includes('live.bilibili')) {
  window.XMLHttpRequest = getHookXMLHttpRequest(window);
}

function __awaiter(thisArg, _arguments, P, generator) {
  function adopt(value) {
    return value instanceof P ? value : new P(function (resolve) {
      resolve(value);
    });
  }

  return new (P || (P = Promise))(function (resolve, reject) {
    function fulfilled(value) {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    }

    function rejected(value) {
      try {
        step(generator["throw"](value));
      } catch (e) {
        reject(e);
      }
    }

    function step(result) {
      result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
    }

    step((generator = generator.apply(thisArg, _arguments || [])).next());
  });
}

const UTILS = {
  getAccessToken() {
    const tokenInfo = JSON.parse(localStorage.bili_accessToken_hd || '{}')
    return tokenInfo.access_token
  },
  enableReferer() {
    const referrerEle = document.getElementById('referrerMark')
    if (!referrerEle) return;

    referrerEle.content = "strict-origin-when-cross-origin"
  },
  disableReferer() {
    const referrerEle = document.getElementById('referrerMark');
    if (!referrerEle) {
      let meta = document.createElement('meta')
      meta.id = "referrerMark"
      meta.name = "referrer"
      meta.content = "no-referrer"
      document.head.appendChild(meta);
    } else {
      referrerEle.content = "no-referrer"
    }
  },
  replaceUpos(playURL, host, replaceAkamai = false, area = "") {
    log.log('replaceUpos:', host, replaceAkamai)
    if (host && (!playURL.includes("akamaized.net") || replaceAkamai)) {
      playURL = playURL.replace(/:\\?\/\\?\/[^\/]+\\?\//g, `://${host}/`);

    }
    return playURL
  },
  handleTHSearchResult(itemList) {
    log.log('th:', itemList)
    const result = []
    for (let item of itemList) {
      result.push({
        type: "media_bangumi",
        title: item.title.replace(/\u003c.*?\u003e/g, ""),
        goto_url: item.uri.replace('bstar://bangumi/season/', 'https://www.bilibili.com/bangumi/play/ss'),
        media_type: 1,
        season_id: item.season_id,
        pgc_season_id: item.season_id,
        "season_type": 1,
        "season_type_name": "番剧",
        "selection_style": "horizontal",
        "media_mode": 2,
        "fix_pubtime_str": "",
        cover: item.cover.replace(/@.*?webp/, '').replace('https://pic.bstarstatic.com', 'roaming-thpic://pic.bstarstatic.com') + '?123',
        url: item.uri.replace('bstar://bangumi/season/', 'https://www.bilibili.com/bangumi/play/ss'),
        is_avid: false,
      })
    }
    return result
  },
  handleAppSearchResult(itemList) {
    const result = []
    for (let item of itemList) {
      const eps = (item.episodes || []).map(e => {
        return {
          id: e.param,
          title: e.index,
          url: e.uri,
          index_title: e.index
        }
      })
      result.push({
        type: "media_bangumi",
        media_id: item.season_id,
        title: item.title.replace(/\u003c.*?\u003e/g, ""),
        org_title: 'org_title',
        media_type: 1,
        cv: item.cv,
        staff: item.staff,
        season_id: item.season_id,
        is_avid: false,
        season_type: item.season_type,
        season_type_name: "番剧",
        selection_style: item.selection_style, //"horizontal",
        ep_size: eps.length,
        url: item.uri,
        button_text: '立即观看',
        is_follow: item.is_atten || 0,
        is_selection: item.is_selection || 1,
        eps: eps,
        badges: [],
        cover: item.cover,
        areas: item.area || "",
        styles: item.style,
        goto_url: item.uri,
        "desc": "",
        "pubtime": item.ptime,
        "media_mode": 2,
        "fix_pubtime_str": "",
        "media_score": {
          "score": item.rating,
          "user_count": item.vote
        },
        "pgc_season_id": item.season_id,
        "corner": 13,
        "index_show": "全0话"
      })
    }
    return result
  },
  generateMobiPlayUrlParams(originUrl, area) {
    // 提取参数为数组
    let a = originUrl.split('?')[1].split('&');
    // 参数数组转换为对象
    let theRequest = {};
    for (let i = 0; i < a.length; i++) {
      let key = a[i].split("=")[0];
      let value = a[i].split("=")[1];
      // 给对象赋值
      theRequest[key] = value;
    }
    // 追加 mobi api 需要的参数
    theRequest.access_key = UTILS.getAccessToken();
    if (area === 'th') {
      theRequest.area = 'th';
      theRequest.appkey = '7d089525d3611b1c';
      theRequest.build = '1001310';
      theRequest.mobi_app = 'bstar_a';
      theRequest.platform = 'android';
    } else {
      theRequest.area = area;
      theRequest.appkey = '07da50c9a0bf829f';
      theRequest.build = '5380700';
      theRequest.device = 'android';
      theRequest.mobi_app = 'android_b';
      theRequest.platform = 'android_b';
      theRequest.buvid = 'XY418E94B89774E201E22C5B709861B7712DD';
      theRequest.fnval = '976'; // 强制 FLV
      theRequest.track_path = '0';
    }
    theRequest.force_host = '2'; // 强制音视频返回 https
    theRequest.ts = `${~~(Date.now() / 1000)}`;
    // 所需参数数组
    let param_wanted = ['access_key', 'appkey', 'area', 'build', 'buvid', 'cid', 'device', 'ep_id', 'fnval', 'fnver', 'force_host', 'fourk', 'mobi_app', 'platform', 'qn', 's_locale', 'season_id', 'track_path', 'ts'];
    // 生成 mobi api 参数字符串
    let mobi_api_params = '';
    for (let i = 0; i < param_wanted.length; i++) {
      if (theRequest.hasOwnProperty(param_wanted[i])) {
        mobi_api_params += param_wanted[i] + `=` + theRequest[param_wanted[i]] + `&`;
      }
    }
    // 准备明文
    let plaintext = '';
    if (area === 'th') {
      plaintext = mobi_api_params.slice(0, -1) + `acd495b248ec528c2eed1e862d393126`;
    } else {
      plaintext = mobi_api_params.slice(0, -1) + `560c52ccd288fed045859ed18bffd973`;
    }
    // 生成 sign
    let ciphertext = hex_md5(plaintext);
    return `${mobi_api_params}sign=${ciphertext}`;
  },
  fixMobiPlayUrlJson(originJson) {
    return __awaiter(this, void 0, void 0, function* () {
      const codecsMap = {
        30112: 'avc1.640028',
        30102: 'hev1.1.6.L120.90',
        30080: 'avc1.640028',
        30077: 'hev1.1.6.L120.90',
        30064: 'avc1.64001F',
        30066: 'hev1.1.6.L120.90',
        30032: 'avc1.64001E',
        30033: 'hev1.1.6.L120.90',
        30011: 'hev1.1.6.L120.90',
        30016: 'avc1.64001E',
        30006: 'avc1.64001E',
        30005: 'avc1.64001E',
        30280: 'mp4a.40.2',
        30232: 'mp4a.40.2',
        30216: 'mp4a.40.2',
        'nb2-1-30016': 'avc1.64001E',
        'nb2-1-30032': 'avc1.64001F',
        'nb2-1-30064': 'avc1.640028',
        'nb2-1-30080': 'avc1.640032',
        'nb2-1-30216': 'mp4a.40.2',
        'nb2-1-30232': 'mp4a.40.2',
        'nb2-1-30280': 'mp4a.40.2' // APP源 高码音频
      };
      const resolutionMap = {
        30120: [1920, 1080],
        30112: [1920, 1080],
        30102: [1920, 1080],
        30080: [1920, 1080],
        30077: [1920, 1080],
        30064: [1280, 720],
        30066: [1280, 720],
        30032: [852, 480],
        30033: [852, 480],
        30011: [640, 360],
        30016: [640, 360],
        30006: [352, 240],
        30005: [352, 240],
      };
      const frameRateMap = {
        30120: '16000/672',
        30112: '16000/672',
        30102: '16000/672',
        30080: '16000/672',
        30077: '16000/656',
        30064: '16000/672',
        30066: '16000/656',
        30032: '16000/672',
        30033: '16000/656',
        30011: '16000/656',
        30016: '16000/672',
        30006: '16000/672',
        30005: '16000/672'
      };
      let segmentBaseMap = {};

      function getId(url, default_value, get_filename = false) {
        if (get_filename) {
          // 作为SegmentBaseMap的Key，在同一个页面下切换集数不至于出错
          let path = url.split('?')[0];
          let pathArr = path.split('/');
          return pathArr[pathArr.length - 1].replace('.m4s', ''); // 返回文件名
        }
        let i = /(nb2-1-)?\d{5}\.m4s/.exec(url);
        if (i !== null) {
          return i[0].replace('.m4s', '');
        } else {
          return default_value;
        }
      }

      function getSegmentBase(url, id, range = '5000') {
        return new Promise((resolve, reject) => {
          // 从 window 中读取已有的值
          if (window.__segment_base_map__) {
            if (window.__segment_base_map__.hasOwnProperty(id)) {
              // log.log('SegmentBase read from cache ', window.__segment_base_map__[id], 'id=', id)
              return resolve(window.__segment_base_map__[id]);
            }
          }
          let xhr = new XMLHttpRequest();
          xhr.open('GET', url, true);
          // TV 动画 range 通常在 4000~5000，剧场版动画大概 14000+
          xhr.setRequestHeader('Range', `bytes=0-${range}`); // 下载前 5000 字节数据用于查找 sidx 位置
          xhr.responseType = 'arraybuffer';
          let data;
          xhr.onload = function (oEvent) {
            data = new Uint8Array(xhr.response);
            let hex_data = Array.prototype.map.call(data, x => ('00' + x.toString(16)).slice(-2)).join(''); // 转换成 hex
            let indexRangeStart = hex_data.indexOf('73696478') / 2 - 4; // 73696478 是 'sidx' 的 hex ，前面还有 4 个字节才是 sidx 的开始
            let indexRagneEnd = hex_data.indexOf('6d6f6f66') / 2 - 5; // 6d6f6f66 是 'moof' 的 hex，前面还有 4 个字节才是 moof 的开始，-1为sidx结束位置
            let result = ['0-' + String(indexRangeStart - 1), String(indexRangeStart) + '-' + String(indexRagneEnd)];
            // 储存在 window，切换清晰度不用重新解析
            if (window.__segment_base_map__) {
              window.__segment_base_map__[id] = result;
            } else {
              window.__segment_base_map__ = {};
              window.__segment_base_map__[id] = result;
            }
            // log.log('get SegmentBase ', result, 'id=', id);
            resolve(result);
          };
          xhr.send(null); // 发送请求
        });
      }

      let result = JSON.parse(JSON.stringify(originJson));
      result.dash.duration = Math.round(result.timelength / 1000);
      result.dash.minBufferTime = 1.5;
      result.dash.min_buffer_time = 1.5;
      // 异步构建 segmentBaseMap
      let taskList = [];
      // SegmentBase 最大 range 和 duration 的比值大概在 2.5~3.2，保险这里取 3.5
      // let range = Math.round(result.dash.duration * 3.5).toString()
      // 乱猜 range 导致泡面番播不出
      result.dash.video.forEach((video) => {
        if (video.backupUrl.length > 0 && video.backupUrl[0].indexOf('akamaized.net') > -1) {
          // 有时候返回 bcache 地址, 直接访问 bcache CDN 会报 403，如果备用地址有 akam，替换为 akam
          video.baseUrl = video.backupUrl[0];
        }
        taskList.push(getSegmentBase(video.baseUrl, getId(video.baseUrl, '30080', true)));
      });
      result.dash.audio.forEach((audio) => {
        if (audio.backupUrl.length > 0 && audio.backupUrl[0].indexOf('akamaized.net') > -1) {
          audio.baseUrl = audio.backupUrl[0];
        }
        taskList.push(getSegmentBase(audio.baseUrl, getId(audio.baseUrl, '30080', true)));
      });
      yield Promise.all(taskList);
      if (window.__segment_base_map__)
        segmentBaseMap = window.__segment_base_map__;
      // 填充视频流数据
      result.dash.video.forEach((video) => {
        // log.log('video: ', video)
        let video_id = getId(video.baseUrl, '30280');
        if (!codecsMap.hasOwnProperty(video_id)) {
          // https://github.com/ipcjs/bilibili-helper/issues/775
          // 泰区的视频URL不包含 id 了
          video_id = (30000 + video.id).toString();
        }
        video.codecs = codecsMap[video_id];
        let segmentBaseId = getId(video.baseUrl, '30280', true);
        video.segment_base = {
          initialization: segmentBaseMap[segmentBaseId][0],
          index_range: segmentBaseMap[segmentBaseId][1]
        };
        video.SegmentBase = {
          Initialization: segmentBaseMap[segmentBaseId][0],
          indexRange: segmentBaseMap[segmentBaseId][1]
        };
        video_id = video_id.replace('nb2-1-', '');
        video.width = resolutionMap[video_id][0];
        video.height = resolutionMap[video_id][1];
        video.mimeType = 'video/mp4';
        video.mime_type = 'video/mp4';
        video.frameRate = frameRateMap[video_id];
        video.frame_rate = frameRateMap[video_id];
        video.sar = "1:1";
        video.startWithSAP = 1;
        video.start_with_sap = 1;
      });
      // 填充音频流数据
      result.dash.audio.forEach((audio) => {
        let audio_id = getId(audio.baseUrl, '30280');
        if (!codecsMap.hasOwnProperty(audio_id)) {
          // https://github.com/ipcjs/bilibili-helper/issues/775
          // 泰区的音频URL不包含 id 了
          audio_id = audio.id.toString();
        }
        let segmentBaseId = getId(audio.baseUrl, '30280', true);
        audio.segment_base = {
          initialization: segmentBaseMap[segmentBaseId][0],
          index_range: segmentBaseMap[segmentBaseId][1]
        };
        audio.SegmentBase = {
          Initialization: segmentBaseMap[segmentBaseId][0],
          indexRange: segmentBaseMap[segmentBaseId][1]
        };
        audio.codecs = codecsMap[audio_id];
        audio.mimeType = 'audio/mp4';
        audio.mime_type = 'audio/mp4';
        audio.frameRate = '';
        audio.frame_rate = '';
        audio.height = 0;
        audio.width = 0;
      });
      return result;
    });
  },
  fixThailandPlayUrlJson(originJson) {
    return __awaiter(this, void 0, void 0, function* () {
      let origin = JSON.parse(JSON.stringify(originJson));
      let result = {
        'format': 'flv720',
        'type': 'DASH',
        'result': 'suee',
        'video_codecid': 7,
        'no_rexcode': 0,
        'code': origin.code,
        'message': +origin.message,
        'timelength': origin.data.video_info.timelength || 0,
        'quality': origin.data.video_info.quality,
        'accept_format': 'hdflv2,flv,flv720,flv480,mp4',
      };
      let dash = {
        'duration': 0,
        'minBufferTime': 0.0,
        'min_buffer_time': 0.0,
        'audio': []
      };
      // 填充音频流数据
      origin.data.video_info.dash_audio.forEach((audio) => {
        log.log('填充音频流数据:', audio)
        const backup_urls = audio.backup_url.filter(e => !e.includes('akamaized.net'))
        audio.base_url = backup_urls[0] || audio.base_url.replace('http://', 'https://');
        audio.baseUrl = backup_urls[0] || audio.base_url;
        audio.backupUrl = audio.backupUrl || [];
        audio.backup_url = audio.backup_url || [];
        dash.audio.push(audio);
      });
      // 填充视频流数据
      let accept_quality = [];
      let accept_description = [];
      let support_formats = [];
      let dash_video = [];
      origin.data.video_info.stream_list.forEach((stream) => {
        support_formats.push(stream.stream_info);
        accept_quality.push(stream.stream_info.quality);
        accept_description.push(stream.stream_info.new_description);
        // 只加入有视频链接的数据
        if (stream.dash_video && stream.dash_video.base_url) {
          const backup_urls = stream.dash_video.backup_url.filter(e => !e.includes('akamaized.net'))
          stream.dash_video.base_url = backup_urls[0] || stream.dash_video.base_url.replace('http://', 'https://');
          stream.dash_video.baseUrl = backup_urls[0] || stream.dash_video.base_url;
          stream.dash_video.backupUrl = stream.dash_video.backupUrl || [];
          stream.dash_video.backup_url = stream.dash_video.backup_url || [];
          stream.dash_video.id = stream.stream_info.quality;
          dash_video.push(stream.dash_video);
        }
      });
      dash['video'] = dash_video;
      result['accept_quality'] = accept_quality;
      result['accept_description'] = accept_description;
      result['support_formats'] = support_formats;
      result['dash'] = dash;
      // 下面参数取自安达(ep359333)，总之一股脑塞进去（
      result['fnval'] = 80;
      result['fnver'] = 0;
      result['status'] = 2;
      result['vip_status'] = 1;
      result['vip_type'] = 2;
      result['seek_param'] = 'start';
      result['seek_type'] = 'offset';
      result['bp'] = 0;
      result['from'] = 'local';
      result['has_paid'] = false;
      result['is_preview'] = 0;
      return UTILS.fixMobiPlayUrlJson(result);
    });
  },
  genSearchSign(params, area) {

    // 所需参数数组
    let param_wanted = ['access_key', 'appkey', 'area', 'build', 'buvid', 'c_locale', 'channel', 'cid', 'device', 'disable_rcmd', 'ep_id', 'fnval', 'fnver', 'force_host', 'fourk', 'highlight', 'keyword', 'lang', 'mobi_app', 'platform', 'pn', 'ps', 'qn', 's_locale', 'sim_code', 'statistics', 'season_id', 'track_path', 'ts', 'type'];
    // 生成 mobi api 参数字符串
    let mobi_api_params = '';
    for (let i = 0; i < param_wanted.length; i++) {
      if (params.hasOwnProperty(param_wanted[i])) {
        mobi_api_params += param_wanted[i] + `=` + params[param_wanted[i]] + `&`;
      }
    }
    // 准备明文
    let plaintext = '';
    if (area === 'th') {
      plaintext = mobi_api_params.slice(0, -1) + `acd495b248ec528c2eed1e862d393126`;
    } else {
      plaintext = mobi_api_params.slice(0, -1) + `560c52ccd288fed045859ed18bffd973`;
    }
    // log.log(plaintext)
    // 生成 sign
    return parent.hex_md5(plaintext)
  },
  genSearchParam(params, area) {
    const result = {
      // access_key: params.access_key,
      appkey: area === 'th' ? '7d089525d3611b1c' : '1d8b6e7d45233436',
      build: area === 'th' ? '1001310' : '6400000',
      c_locale: area === 'th' ? 'zh_SG' : 'zh_CN',
      channel: 'yingyongbao',
      device: 'android',
      disable_rcmd: 0,
      fnval: 976,
      fnver: 0,
      fourk: 1,
      highlight: 1,
      keyword: params.keyword,
      lang: 'hans',
      mobi_app: area === 'th' ? 'bstar_a' : 'android',
      platform: 'android',
      pn: 1,
      ps: 20,
      qn: 80,
      // force_host: 0,
      s_locale: area === 'th' ? 'zh_SG' : 'zh_CN',
      sim_code: 52004,
      statistics: encodeURIComponent('{"appId":1,"platform":3,"version":"6.85.0","abtest":""}'),
      ts: parseInt(new Date().getTime() / 1000),
      type: 7,
      sign: ''
    }
    if(area === 'th'){
      result.access_key = params.access_key
      result.sign = UTILS.genSearchSign(result, area)
    }else{
      result.area = area
    }
    let a = ''
    for (const k in result) {
      a += `${k}=${result[k]}&`
    }
    return a.substring(0, a.length - 1)

  },
  _params2obj(params) {
    const arr = params.split('&')
    const result = {}
    for (let param of arr) {
      const [key, value] = param.split('=')
      result[key] = value
    }
    return result
  },
  async genVideoDetailByDynamicDetail(dynamicDetail) {
    const res = {
      View: {},
      /**
       * 作者的信息
       */
      Card: {},
      Tags: [],
      Reply: {},
      Related: [],
      Spec: null,
      hot_share: {
        show: false,
        list: [],
      },
      /**
       * 充电数据
       */
      elec: {},
      recommend: null,
      view_addit: {},
      guide: null,
      query_tags: null,
      is_old_user: false,
    }
    const card = JSON.parse(dynamicDetail.card.card)
    log.log('dynamic card:', card)
    if (card.rights)
    {
      card.rights.download = 1
    }
    res.View = card
    const resp = await new BiliBiliApi().getUserCard(card.owner.mid)
    res.Card = resp.data
    return res
  }
}

