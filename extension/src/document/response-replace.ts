/* eslint-disable @typescript-eslint/no-explicit-any */
import { BiliBiliApi, type AreaType } from "../common/bilibili-api";
import { ChineseConversionAPI } from "../common/chinese-conversion";
import { CustomIndexedDB } from "../common/db";
import type { BiliPlayUrlResult } from "../common/interface/bili-playurl/playurl.type";
import { createLogger } from "../common/log";
import { getSegments } from "../common/sponsor-block";
import type { BiliResponseData, BiliResponseResult, BiliSeasonInfoType } from "../common/types";
import { UTILS } from "../common/utils";
import type { FetchReplaceType } from "./types";
import type { CustomXMLHttpRequest } from "./xml-http-request";
const log = createLogger('Replace')


const space_account_info_map: Record<string, any> = {
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
      "fans_medal": { "show": false, "wear": false, "medal": null },
      "official": { "role": 3, "title": "哔哩哔哩番剧出差 官方账号", "desc": "", "type": 1 },
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
      "pendant": { "pid": 0, "name": "", "image": "", "expire": 0, "image_enhance": "", "image_enhance_frame": "" },
      "nameplate": { "nid": 0, "name": "", "image": "", "image_small": "", "level": "", "condition": "" },
      "user_honour_info": { "mid": 0, "colour": null, "tags": [] },
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
      "school": { "name": "" },
      "profession": { "name": "" },
      "tags": null,
      "series": { "user_upgrade_status": 3, "show_upgrade_window": false }
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
      "fans_medal": { "show": false, "wear": false, "medal": null },
      "official": { "role": 0, "title": "", "desc": "", "type": -1 },
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
      "pendant": { "pid": 0, "name": "", "image": "", "expire": 0, "image_enhance": "", "image_enhance_frame": "" },
      "nameplate": { "nid": 0, "name": "", "image": "", "image_small": "", "level": "", "condition": "" },
      "user_honour_info": { "mid": 0, "colour": null, "tags": [] },
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
      "school": { "name": "" },
      "profession": { "name": "" },
      "tags": null,
      "series": { "user_upgrade_status": 3, "show_upgrade_window": false }
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
      "fans_medal": { "show": false, "wear": false, "medal": null },
      "official": { "role": 0, "title": "", "desc": "", "type": -1 },
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
      "pendant": { "pid": 0, "name": "", "image": "", "expire": 0, "image_enhance": "", "image_enhance_frame": "" },
      "nameplate": { "nid": 0, "name": "", "image": "", "image_small": "", "level": "", "condition": "" },
      "user_honour_info": { "mid": 0, "colour": null, "tags": [] },
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
      "school": { "name": "" },
      "profession": { "name": "" },
      "tags": null,
      "series": { "user_upgrade_status": 3, "show_upgrade_window": false }
    }
  },
};
const uposMap: Record<string, string> = {
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
const AREA_MARK_CACHE: Record<string, AreaType> = {}

export const ResponseReplaceXMLHttpRequest = {

  /**
   * 番剧信息
   * @param {XMLHttpRequest} req 原请求结果
   * @returns {Promise<void>}
   */
  "https://api.bilibili.com/pgc/view/pc/season": async (req: CustomXMLHttpRequest) => {
    UTILS.enableReferer();
    log.info('HOOK', req)
    const resp = JSON.parse(req.responseText || "{}")
    log.info('season result:', resp)
    if (resp.code !== 0) {
      // 状态码异常
      const api = new BiliBiliApi()
      log.info('upos: ', localStorage.upos)

      const serverList = JSON.parse(localStorage.serverList || "{}")
      log.info('serverList: ', serverList)

      const params = UTILS._params2obj(req._params)
      log.info('params: ', params)
      if (!params.season_id) {
        params.season_id = window.epId2seasonId[params.ep_id]
      }

      let seasonResp: BiliResponseData<BiliSeasonInfoType> = await api.getSeasonInfoPgcByEpId(params.season_id, params.ep_id, UTILS.getAccessToken())

      if (seasonResp.code !==0 ){
        seasonResp = await api.getSeasonInfoByEpSsIdOnBangumi(params.ep_id || "", params.season_id || "")
      }
      log.info('getSeasonInfo:', seasonResp)
      if (seasonResp.code === 0) {
        const seasonInfo = seasonResp.data
        const eps = seasonInfo.modules[0].data.episodes
        for (const ep of eps) {
          ep.rights.area_limit = 0
          ep.badge_info.text = ''
          ep.rights.allow_dm = 1
          window.epId2seasonId[`${ep.ep_id}`] = `${seasonInfo.season_id}`
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
            styles: seasonInfo.styles.map((e) => e.name),
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

      const seasonResp2 = await api.getSeasonInfoByEpSsIdOnThailand(params.ep_id || "", params.season_id || "")
      log.info('去th找:', seasonResp2)
      if (seasonResp2.code !== 0 || seasonResp2.result.modules.length === 0) return;
      AREA_MARK_CACHE[params.ep_id] = 'th'
      seasonResp2.result.episodes = seasonResp2.result.episodes || seasonResp2.result.modules[0].data.episodes
      delete seasonResp2.result.modules
      // title id
      seasonResp2.result.episodes.forEach((ep: any) => {
        ep.title = ep.title || `第${ep.index}话 ${ep.index_title}`
        ep.id = ep.id || ep.ep_id
        ep.ep_id = ep.ep_id || ep.id
        ep.episode_type = 0
        ep.status = 2
        ep.duration = ep.duration || 0
        ep.index_title = ep.long_title
        delete ep.long_title
        window.epId2seasonId[ep.ep_id] = seasonResp2.result.season_id
      })
      seasonResp2.result.status = seasonResp2.result.status || 2
      if (seasonResp2.result.user_status) {
        seasonResp2.result.user_status.login = seasonResp2.result.user_status?.login || 1
      }
      seasonResp2.result.rights.watch_platform = 0
      seasonResp2.result.rights.allow_download = 1
      seasonResp2.result.seasons = []
      log.info('seasonInfo2: ', seasonResp2)
      req.responseText = JSON.stringify(seasonResp2)

    } else {
      // 一些番剧可以获取到信息，但是内部有限制区域
      resp.result.episodes.forEach((ep: { rights: { area_limit: number; allow_dm: number; allow_download: number; }; }) => {
        if (ep.rights) {
          ep.rights.area_limit = 0
          ep.rights.allow_dm = 0
          ep.rights.allow_download = 1
        }
      })
      resp.result.rights.allow_download = 1
      req.responseText = JSON.stringify(resp)
    }
  },
  "https://api.bilibili.com/pgc/view/web/season/user/status": async (req: CustomXMLHttpRequest) => {
    // log.info("解除区域限制")
    const resp = JSON.parse(req.responseText)
    if (resp.result)
      resp.result.area_limit = 0
    req.responseText = JSON.stringify(resp)
  },
  "https://api.bilibili.com/pgc/season/episode/web/info": async (_req: CustomXMLHttpRequest) => {
    // log.info("解除区域限制")
  },

  /**
   * 获取播放链接
   * @param {XMLHttpRequest} req 原请求结果
   * @returns {Promise<void>}
   */
  "//api.bilibili.com/pgc/player/web/v2/playurl": async (req: CustomXMLHttpRequest) => {
    const resp = JSON.parse(req.responseText)

    // 默认pc，要referer
    UTILS.enableReferer()

    if (resp.code !== 0) {
      log.warn('[player]: 播放链接获取出现问题，尝试替换')
      const params = UTILS._params2obj(req._params)
      const serverList: Record<AreaType, string> = JSON.parse(localStorage.serverList || "{}")
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
          playURL = await api.getPlayURLApp(req._params, accessKey || "", AREA_MARK_CACHE[params.ep_id])
        else
          playURL = await api.getPlayURLThailand(req._params, accessKey || "", AREA_MARK_CACHE[params.ep_id])
        playURL.result.is_preview = 0
        playURL.result.status = 2
        if (playURL.code === 0) {
          log.info('playURL:', playURL)
          // 从cache的区域中取到了播放链接
          req.responseText = UTILS.replaceUpos(JSON.stringify(playURL), uposMap[upos], isReplaceAkamai, AREA_MARK_CACHE[params.ep_id])
          return;
        }
      }
      // 没有从cache的区域中取到播放链接，遍历漫游服务器
      for (const area in serverList) {
        const server = serverList[area as AreaType] || ""
        log.info('getPlayURL from ', area, ' - ', server)
        if (server.length === 0) continue;
        api.setServer(server)

        let playURL: BiliResponseResult<BiliPlayUrlResult>
        if (area !== "th") {
          UTILS.enableReferer()
          playURL = await api.getPlayURLApp(req._params, accessKey || "", area as AreaType)
        } else {
          UTILS.disableReferer()
          playURL = await api.getPlayURLThailand(req._params, accessKey || "", area)
        }
        log.info("已获取播放链接", playURL)
        if (playURL.code !== 0) continue
        log.info('playURL:', playURL)
        // 解析成功
        AREA_MARK_CACHE[params.ep_id] = area as AreaType

        // req.responseText = JSON.stringify(playURL)
        req.responseText = UTILS.replaceUpos(JSON.stringify(playURL), uposMap[upos], isReplaceAkamai, area as AreaType)
        break
      }
    }
  },

  /**
   * 获取播放链接
   * @param {XMLHttpRequest} req 原请求结果
   * @returns {Promise<void>}
   */
  "//api.bilibili.com/x/player/playurl": async (_req: CustomXMLHttpRequest) => {
    // 默认pc，要referer
    UTILS.enableReferer()
  },

  /**
   * 获取播放链接
   * @param {XMLHttpRequest} req 原请求结果
   * @returns {Promise<void>}
   */
  '//api.bilibili.com/x/player/wbi/playurl': async (req: CustomXMLHttpRequest) => {
    // 默认pc，要referer
    UTILS.enableReferer()
    const upos = localStorage.upos || ""
    const isReplaceAkamai = localStorage.replaceAkamai === "true"
    if (localStorage.uposApplyAll === 'true') {
      // 应用到所有视频
      req.responseText = UTILS.replaceUpos(req.responseText, uposMap[upos], isReplaceAkamai, undefined)
    }
  },

  /**
   * 用户信息
   * @param {XMLHttpRequest} req 原请求结果
   * @returns {Promise<void>}
   */
  "//api.bilibili.com/x/space/acc/info": async (req: CustomXMLHttpRequest) => {
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
  "https://api.bilibili.com/x/polymer/web-dynamic/v1/feed/all": async (req: CustomXMLHttpRequest) => {
    log.info('动态处理1...')
    const resp = JSON.parse(req.responseText)
    if (resp.code === 0) {
      try {
        const db = new CustomIndexedDB()
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
      } catch (e) {
        log.error('动态信息1:', e)
      }

    }
  },

  /**
   * 动态信息2
   * @param {XMLHttpRequest} req 原请求结果
   * @returns {Promise<void>}
   */
  "//api.bilibili.com/x/polymer/web-dynamic/desktop/v1/feed/all": async (req: CustomXMLHttpRequest) => {
    log.info('动态处理2...')
    const resp = JSON.parse(req.responseText)
    if (resp.code === 0) {
      try {
        const db = new CustomIndexedDB()
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
      } catch (e) {
        log.error('动态信息2:', e)
      }

    }
  },

  /**
   * 搜索
   * @param {XMLHttpRequest} req 原请求结果
   * @returns {Promise<void>}
   */
  "https://api.bilibili.com/x/web-interface/search/type": async (req: CustomXMLHttpRequest) => {
    // log.info('===搜索 HOOK: ', req)
    const params = UTILS._params2obj(req._params)
    if (params.search_type === 'media_bangumi') {
      // 搜索番剧
      const searchResult = JSON.parse(req.responseText)
      log.info('预期结果：', searchResult)
      searchResult.data.result = searchResult.data.result || []
      const api = new BiliBiliApi()
      const serverList = JSON.parse(localStorage.serverList || "{}")
      for (const k in serverList) {
        const area = k as AreaType
        const server = serverList[area] || ""
        if (server.length === 0) {
          log.info('skip area:', area)
          continue
        }

        api.setServer(server)
        try {
          // const buvid3 = await cookieStore.get('buvid3') || {}
          function sleep(d: number) {
            for (let t = Date.now(); Date.now() - t <= d;) { /* empty */ }
          }

          sleep(500); //当前方法暂停0.5秒
          const result: any = await api.searchBangumi(params, area)
          // log.info('searchResult:', result)
          result.forEach((s: any) => {
            s.title = `[${area}]${s.title}`
          })
          searchResult.data.result.push(...result)
          req.responseText = JSON.stringify(searchResult)
        } catch (err) {
          log.error('搜索异常:', err)
        }
      }
    }
  },

  /**
   * 字幕
   * @param {XMLHttpRequest} req 原请求结果
   * @returns {Promise<void>}
   */
  "//api.bilibili.com/x/player/wbi/v2": async (req: CustomXMLHttpRequest) => {
    if (!req._params) return;
    const resp = JSON.parse(req.responseText || "{}")
    const serverList = JSON.parse(localStorage.serverList || "{}")
    if ((resp.code === -400 || resp.code === -404 || !resp.data || resp.data.subtitle.subtitles.length === 0)
      && serverList.th) {
      log.info('处理字幕')
      // 字幕请求失败
      const api = new BiliBiliApi(serverList.th);
      const subtitles = await api.getSubtitleOnThailand(req._params);
      if (resp.code === 0) {
        resp.data.subtitle.subtitles.push(...subtitles)
      } else if (subtitles.length > 1) {
        const id = await window.cookieStore.get('DedeUserID') || {}
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
    for (const key in ResponseReplaceXMLHttpRequest) {
      if (key && key.endsWith('json.translate')) {
        delete (ResponseReplaceXMLHttpRequest as any)[key]
      }
    }
    // 查找简体
    const zhHans = resp.data?.subtitle?.subtitles?.find((e: { lan: string; }) => e.lan === 'zh-Hans')
    if (!zhHans) {
      // 没有简体，查找繁体
      const zhHant = resp.data?.subtitle?.subtitles?.find((e: { lan: string; }) => e.lan === 'zh-Hant')
      if (zhHant) {
        // 有繁体，构造简体拦截器
        const zhHans = JSON.parse(JSON.stringify(zhHant))
        zhHans.lan = 'zh-Hans'
        zhHans.lan_doc = '中文（简体）'
        zhHans.id = 1145141919810
        zhHans.id_str = `${zhHans.id}`
        zhHans.subtitle_url = `${zhHans.subtitle_url}&translate=zh-Hans`;
        (ResponseReplaceXMLHttpRequest as any)[zhHans.subtitle_url.split('?')[0]] = ResponseReplaceXMLHttpRequest.zhHansSubtitle
        resp.data.subtitle.subtitles.push(zhHans)
      }
    }
    // SponsorBlock
    if (resp.code === 0) {
      try {
        const segments = await getSegments({
          videoID: resp.data.bvid,
          cid: resp.data.cid,
        })
        for (const segment of segments) {
          resp.data.view_points.push({
            type: 1,
            from: segment.segment[0],
            to: segment.segment[1],
            content: segment.category,
            sponsor_info: {
              actionType: segment.actionType,
              category: segment.category,
            }
          })
        }
      } catch (err) {
        log.error('获取SponsorBlock数据失败:', err)
      }
    }
    // log.info('subtitle result:', resp)
    req.responseText = JSON.stringify(resp)
  },

  /**
   * 繁体字幕转简体字幕
   * @param {XMLHttpRequest} req 原请求结果
   * @returns {Promise<void>}
   */
  zhHansSubtitle: async (req: CustomXMLHttpRequest) => {
    // log.info('繁体转简体', req)
    if (req._params.includes('zh-Hans')) {
      // log.info('繁体字幕数据: ', req.responseText)

      req.responseText = ChineseConversionAPI.tc2sc(req.responseText)
      req.response = JSON.parse(req.responseText)
      req.status = 200
      // log.info('中文字幕数据: ', req.responseText)
    }
  },
}

export const ResponseReplaceFetch: Record<string, (data: FetchReplaceType) => Promise<Response>> = {

  /**
   * 搜索
   * @param {{urlInfo: [string, string], config: RequestInit, res: Response }} data 原请求结果
   * @returns {Promise<Response>}
   */
  "https://api.bilibili.com/x/web-interface/search/type": async (data: FetchReplaceType) => {
    // log.info('===搜索 HOOK: ', req)
    const params = UTILS._params2obj(data.urlInfo.params)
    if (params.search_type === 'media_bangumi') {
      // 搜索番剧
      const searchResult = await data.res.json()
      log.info('预期结果：', searchResult)
      searchResult.data.result = searchResult.data.result || []
      const api = new BiliBiliApi()
      const serverList = JSON.parse(localStorage.serverList || "{}")
      for (const k in serverList) {
        const area = k as AreaType
        const server = serverList[area] || ""
        if (server.length === 0) continue

        api.setServer(server)
        try {
          // const buvid3 = await cookieStore.get('buvid3') || {}
          function sleep(d: number) {
            for (let t = Date.now(); Date.now() - t <= d;) { /* empty */ }
          }

          sleep(500); //当前方法暂停0.5秒
          const result: any = await api.searchBangumi(params, area)
          // log.info('searchResult:', result)
          result.forEach((s: { title: string; }) => {
            s.title = `[${area}]${s.title}`
          })
          searchResult.data.result.push(...result)
        } catch (err) {
          log.error('搜索异常:', err)
        }
      }
      (data.res as any).data = searchResult
    }
    return data.res
  },
  /**
   * 用户信息
   * @param {{urlInfo: [string, string], config: RequestInit, res: Response }} data 原请求结果
   * @returns {Promise<Response>}
   */
  "//api.bilibili.com/x/space/acc/info": async (data: FetchReplaceType) => {
    const resp = await data.res.clone().json()
    try {
      if (resp.code !== 0) {
        const params = UTILS._params2obj(data.urlInfo.params)
        const userInfo = space_account_info_map[params.mid]
        if (userInfo) data.res = Response.json(userInfo)
      }
    } catch (e) {
      log.error('用户信息替换失败：', e)
    }
    return data.res
  },

  /**
   * 视频信息
   * @param {{urlInfo: [string, string], config: RequestInit, res: Response }} data 原请求结果
   * @returns {Promise<Response>}
   */
  "https://api.bilibili.com/x/web-interface/view/detail": async (data: FetchReplaceType) => {
    const resp = await data.res.clone().json()
    log.info('request for dynamic detail', resp)
    try {
      if (resp.code !== 0) {
        const params = UTILS._params2obj(data.urlInfo.params)
        log.info('get dynamic id')
        // 获取dynamic_id
        const db = new CustomIndexedDB()
        await db.open()
        const b2d = await db.getBvid2DynamicId(params.bvid)
        log.info('get dynamic id result:', b2d)
        if (!b2d) return data.res
        // 获取动态详情
        const bili = new BiliBiliApi();
        const detail = await bili.getDynamicDetail(b2d.dynamic_id)
        const dynamicDetail: any = await window.biliBridgePc.callNative('roaming/queryDynamicDetail', b2d.dynamic_id, UTILS.getAccessToken())
        log.info('dynamic detail phone:', dynamicDetail)
        const dynamic = dynamicDetail.item.modules.find((e: { module_type: string; }) => e.module_type === 'module_dynamic')
        const epid = dynamic.module_dynamic.dyn_archive.uri.match(/ep\d+/)[0]
        // 构造数据
        const res: any = await UTILS.genVideoDetailByDynamicDetail(detail.data)
        res.View.redirect_url = `https://www.bilibili.com/bangumi/play/${epid}`
        log.info('dynamic detail:', res);
        (data.res as any).data = {
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
    } catch (e) {
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
  "https://api.bilibili.com/x/web-interface/wbi/index/top/feed/rcmd": async (data: FetchReplaceType) => {

    const resp = await data.res.clone().json()
    // resp.data.item = resp.data.item.filter(e => e.goto !== 'ad')
    data.res = Response.json(resp)
    return data.res
  }

}