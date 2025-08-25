import md5 from "md5";
import { GET, POST } from "./http";
import { createLogger, Logger } from "./log";
import { UTILS } from "./utils";
import type { BiliResponseType, BiliSeasonInfoType } from "./types";
export type AreaType = 'hk' | 'th' | 'tw'

export class BiliBiliApi {
  appKey: string;
  appSecret: string;
  server: string;
  log: Logger;
  constructor(server = 'api.bilibili.com') {
    this.appKey = 'dfca71928277209b'
    this.appSecret = 'b5475a8825547a4fc26c7d518eaaa02e'
    this.server = server;
    this.log = createLogger('BiliBiliApi')
  }

  genSignParam(p: Record<string, string | number>) {
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
    const sign = md5(str + this.appSecret)
    return `${str}&sign=${sign}`
  }

  setServer(server: string) {
    this.server = server
  }

  getSeasonInfoByEpId(ep_id: string) {
    return GET(`//${this.server}/pgc/view/web/season?ep_id=${ep_id}`);
  }

  getSeasonInfo(season_id: string) {
    return GET(`//${this.server}/pgc/view/web/season?season_id=${season_id}`);
  }


  getSeasonInfoByEpSsIdOnBangumi(epId: string, seasonId: string) {
    this.log.info('get season info: ', epId, seasonId)
    const sId = window.epId2seasonId[epId]
    return GET(`https://api.bilibili.com/pgc/web/season/section?season_id=${seasonId || sId}`).then(res => {
      return Promise.resolve(JSON.parse(res.responseText))
    });
  }

  getSeasonInfoByEpSsIdOnThailand(ep_id: string, season_id: string) {
    const params = '?' + (ep_id !== '' ? `ep_id=${ep_id}` : `season_id=${season_id}`) + `&mobi_app=bstar_a&s_locale=zh_SG`;
    const newParams = UTILS.generateMobiPlayUrlParams(params, 'th');
    return GET(`//${this.server}/intl/gateway/v2/ogv/view/app/season?` + newParams).then(res => {
      return Promise.resolve(JSON.parse(res.responseText || "{}"))
    });
  }

  getSubtitleOnThailand(params: string) {
    return GET(`//${this.server}/intl/gateway/v2/app/subtitle?${params}`).then(res => {
      const resp = JSON.parse(res.responseText || "{}")
      const subtitles = []
      if (resp.code === 0 && resp.data.subtitles) {
        for (const subtitle of resp.data.subtitles) {
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

  getPlayURL(params: string, ak: string, area: AreaType) {
    return GET(`//${this.server}/pgc/player/web/playurl?${params}&access_key=${ak}&area=${area}`).then(res => {
      return Promise.resolve(JSON.parse(res.responseText || "{}"))
    });
  }

  getPlayURLApp(params: string, ak: string, area: AreaType) {
    const _p = params.split('&')
    const p: Record<string, string> = {}
    for (const _pp of _p) {
      const t = _pp.split('=')
      p[t[0]] = t[1]
    }
    this.log.info('origin param:', p)
    const url = `https://${this.server}/pgc/player/api/playurl`
    const param: Record<string, string | number> = {
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
      ts: (Date.now() / 1000).toFixed(0),
    }
    const queryParam = this.genSignParam(param)
    return GET(`${url}?${queryParam}`).then(res => {
      return Promise.resolve(JSON.parse(res.responseText || "{}"))
    });
  }
  async getSeasonInfoPgcByEpId(seasonId: string, epId: string, ak: string): Promise<BiliResponseType<BiliSeasonInfoType>> {
    const url = `https://${this.server}/pgc/view/v2/app/season`
    const param: Record<string, string | number> = {
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
      ts: (Date.now() / 1000).toFixed(0),
      ugc_ogv_unity_exp: 1
    }
    if (seasonId) {
      param.season_id = seasonId
    }
    else if (epId) {
      param.ep_id = epId
    }
    const queryParam = this.genSignParam(param)
    const res = await GET(`${url}?${queryParam}`)
    return JSON.parse(res.responseText || "{}")
  }
  getPlayURLThailand(params: string, _ak: string, _area: AreaType) {
    params = `?${params}&mobi_app=bstar_a&s_locale=zh_SG`;
    const newParams = UTILS.generateMobiPlayUrlParams(params, 'th');
    return GET(`//${this.server}/intl/gateway/v2/ogv/playurl?${newParams}`).then(res => {
      // 参考：哔哩漫游 油猴插件
      // const upos = localStorage.upos||""
      // const isReplaceAkamai = localStorage.replaceAkamai === "true"
      // const _params = UTILS._params2obj(params)
      // const responseText = UTILS.replaceUpos(res.responseText, uposMap[upos], isReplaceAkamai, 'th')
      const result = JSON.parse(res.responseText || "{}")
      if (result.code !== 0) return Promise.reject(result);
      return Promise.resolve(UTILS.fixThailandPlayUrlJson(result));
    })
  }

  async searchBangumi(params: Record<string, string>, area: AreaType) {
    let path = "x/v2/search/type"
    try {
      params.access_key = UTILS.getAccessToken()
    } catch (e) {
      this.log.error('获取access token异常：', e)
    }
    if (area === 'th') {
      path = "intl/gateway/v2/app/search/type"
      // let a = 'area=th'
      // for (let k in params) {
      //   a += `&${k}=${params[k]}`
      // }
      // params = a
    }
    const searchParams = UTILS.genSearchParam(params, area)
    const url = `https://${this.server}/${path}?${searchParams}`
    const res = await GET(url)
    const resp = JSON.parse(res.responseText)
    this.log.info("searchBangumi: ", resp)
    if (area === "th")
      return UTILS.handleTHSearchResult(resp.data?.items || [])
    else {
      if (resp.data?.items) {
        return UTILS.handleAppSearchResult(resp.data?.items || [])
      } else
        return resp.data?.result || []
    }
  }

  /**
   * 获取动态详情
   *
   * @param {string} dynamicId
   */
  getDynamicDetail(dynamicId: string) {
    const url = `https://api.vc.bilibili.com/dynamic_svr/v1/dynamic_svr/get_dynamic_detail?dynamic_id=${dynamicId}`
    return GET(url).then(res => {
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
  getUserCard(userId: string) {
    const url = `https://api.bilibili.com/x/web-interface/card?mid=${userId}`
    return GET(url).then(res => {
      const resp = JSON.parse(res.responseText)
      // log.log('dynamicDetail:', resp)
      if (resp.code === 0) {
        return Promise.resolve(resp)
      }
      return Promise.reject(resp)
    })
  }

  genDeviceId(): string {
    let deviceId = localStorage.getItem('device_id')
    if (deviceId != null) return deviceId
    deviceId = md5(`${Math.random()}`) + md5(`${Math.random()}`)
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
      ts: (Date.now() / 1000).toFixed(0)
    }
    const _resp = await POST(url, this.genSignParam(param), {
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
  async HD_pollCheckLogin(authCode: string) {
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
      ts: (Date.now() / 1000).toFixed(0),
    }
    const _resp = await POST(url, this.genSignParam(param), {
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