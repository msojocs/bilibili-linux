// 简易GET,POST请求封装
const HTTP = {
  get(url) {
    return new Promise((resolve, reject) => {
      const Http = new XMLHttpRequest()
      Http.open('GET', url)
      Http.send()
      Http.onloadend = e => {
        resolve(Http)
      }
      Http.onerror = e => reject
    })
  },
  post(url, body=null) {
    return new Promise((resolve, reject) => {
      const Http = new XMLHttpRequest()
      Http.open('POST', url)
      Http.send(body)
      Http.onloadend = e => {
        resolve(Http)
      }
      Http.onerror = e => reject
    })
  }
}

// 哔哩哔哩API
class BiliBiliApi {
  constructor(server = 'api.bilibili.com') {
    this.server = server;
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
  getSeasonInfoByEpSsIdOnBangumi(ep_id, season_id) {
    return HTTP.get('//bangumi.bilibili.com/view/web_api/season?' + (ep_id != '' ? `ep_id=${ep_id}` : `season_id=${season_id}`)).then(res=>{
      return Promise.resolve(JSON.parse(res.responseText))
    });
  }
  getSeasonInfoByEpSsIdOnThailand(ep_id, season_id) {
    const params = '?' + (ep_id != '' ? `ep_id=${ep_id}` : `season_id=${season_id}`) + `&mobi_app=bstar_a&s_locale=zh_SG`;
    const newParams = UTILS.generateMobiPlayUrlParams(params, 'th');
    return HTTP.get(`//${this.server}/intl/gateway/v2/ogv/view/app/season?` + newParams).then(res=>{
      return Promise.resolve(JSON.parse(res.responseText || "{}"))
    });
  }
  getSubtitleOnThailand(params) {
    return HTTP.get(`//${this.server}/intl/gateway/v2/app/subtitle?${params}`).then(res=>{
      const resp = JSON.parse(res.responseText || "{}")
      const subtitles = []
      if(resp.code === 0 && resp.data.subtitles){
        for(let subtitle of resp.data.subtitles){
          subtitles.push({
            id: subtitle.id,
            is_str: subtitle.id.toString(),
            lan: subtitle.key,
            lan_doc: subtitle.title,
            subtitle_url: subtitle.url.replace(/https?:\/\//, '//').replace('s.bstarstatic.com', this.server)
          })
        }
      }
      return Promise.resolve(subtitles)
    });
  }
  getPlayURL(req, ak, area) {
    return HTTP.get(`//${this.server}/pgc/player/web/playurl?${req._params}&access_key=${ak}&area=${area}`).then(res=>{
      return Promise.resolve(JSON.parse(res.responseText || "{}"))
    });
  }
  getPlayURLThailand(req, ak, area) {
    const params = `?${req._params}&mobi_app=bstar_a&s_locale=zh_SG`;
    const newParams = UTILS.generateMobiPlayUrlParams(params, 'th');
    return HTTP.get(`//${this.server}/intl/gateway/v2/ogv/playurl?${newParams}`).then(res=>{
      // 参考：哔哩漫游 油猴插件
      const upos = localStorage.upos||""
      const isReplaceAkamai = localStorage.replaceAkamai === "true"
      const _params = _params2obj(req._params)
      const responseText = UTILS.replaceUpos(res.responseText, uposMap[upos], isReplaceAkamai, 'th')
      let result = JSON.parse(responseText || "{}")
      return Promise.resolve(UTILS.fixThailandPlayUrlJson(result));
    })
  }
  getAccessToken() {
    const url = "https://passport.bilibili.com/login/app/third?appkey=27eb53fc9058f8c3&api=https%3A%2F%2Fwww.mcbbs.net%2Ftemplate%2Fmcbbs%2Fimage%2Fspecial_photo_bg.png&sign=04224646d1fea004e79606d3b038c84a"
    return HTTP.get(url).then(res => {
      const resp = JSON.parse(res.responseText)
      console.log("passport: ", resp)
      return HTTP.get(resp.data.confirm_uri)
    }).then(res=>{
      console.log('URL: ', res)
      const access_key = new URL(res.responseURL).searchParams.get('access_key')
      console.log("---hook--AT", access_key)
      return Promise.resolve(access_key)
    })
  }
  searchBangumi(params, area) {
    let path = "x/web-interface/search/type"
    if(area === "th")path = "intl/gateway/v2/app/search/type"
    const url = `https://${this.server}/${path}?${params}&area=${area}`
    return HTTP.get(url).then(res => {
      const resp = JSON.parse(res.responseText)
      console.log("searchBangumi: ", resp)
      if(area === "th")
      return Promise.resolve(UTILS.handleTHSearchResult(resp.data.items || []))
      else
      return Promise.resolve(resp.data.result || [])
    })
  }
}

var space_account_info_map = {
  "11783021": { "code": 0, "message": "0", "ttl": 1, "data": { "mid": 11783021, "name": "哔哩哔哩番剧出差", "sex": "保密", "face": "http://i0.hdslb.com/bfs/face/9f10323503739e676857f06f5e4f5eb323e9f3f2.jpg", "sign": "", "rank": 10000, "level": 6, "jointime": 0, "moral": 0, "silence": 0, "coins": 0, "fans_badge": false, "fans_medal": { "show": false, "wear": false, "medal": null }, "official": { "role": 3, "title": "哔哩哔哩番剧出差 官方账号", "desc": "", "type": 1 }, "vip": { "type": 0, "status": 0, "due_date": 0, "vip_pay_type": 0, "theme_type": 0, "label": { "path": "", "text": "", "label_theme": "", "text_color": "", "bg_style": 0, "bg_color": "", "border_color": "" }, "avatar_subscript": 0, "nickname_color": "", "role": 0, "avatar_subscript_url": "" }, "pendant": { "pid": 0, "name": "", "image": "", "expire": 0, "image_enhance": "", "image_enhance_frame": "" }, "nameplate": { "nid": 0, "name": "", "image": "", "image_small": "", "level": "", "condition": "" }, "user_honour_info": { "mid": 0, "colour": null, "tags": [] }, "is_followed": true, "top_photo": "http://i2.hdslb.com/bfs/space/cb1c3ef50e22b6096fde67febe863494caefebad.png", "theme": {}, "sys_notice": {}, "live_room": { "roomStatus": 1, "liveStatus": 0, "url": "https://live.bilibili.com/931774", "title": "「梦之祭！部」 社团活动最终回", "cover": "http://i0.hdslb.com/bfs/live/c89c499096fa6527765de1fcaa021c9e2db7fbf8.jpg", "online": 0, "roomid": 931774, "roundStatus": 0, "broadcast_type": 0 }, "birthday": "", "school": { "name": "" }, "profession": { "name": "" }, "tags": null, "series": { "user_upgrade_status": 3, "show_upgrade_window": false } } },
  "1988098633": { "code": 0, "message": "0", "ttl": 1, "data": { "mid": 1988098633, "name": "b站_戲劇咖", "sex": "保密", "face": "http://i0.hdslb.com/bfs/face/member/noface.jpg", "sign": "提供bilibili港澳台地區專屬戲劇節目。", "rank": 10000, "level": 2, "jointime": 0, "moral": 0, "silence": 0, "coins": 0, "fans_badge": false, "fans_medal": { "show": false, "wear": false, "medal": null }, "official": { "role": 0, "title": "", "desc": "", "type": -1 }, "vip": { "type": 0, "status": 0, "due_date": 0, "vip_pay_type": 0, "theme_type": 0, "label": { "path": "", "text": "", "label_theme": "", "text_color": "", "bg_style": 0, "bg_color": "", "border_color": "" }, "avatar_subscript": 0, "nickname_color": "", "role": 0, "avatar_subscript_url": "" }, "pendant": { "pid": 0, "name": "", "image": "", "expire": 0, "image_enhance": "", "image_enhance_frame": "" }, "nameplate": { "nid": 0, "name": "", "image": "", "image_small": "", "level": "", "condition": "" }, "user_honour_info": { "mid": 0, "colour": null, "tags": [] }, "is_followed": true, "top_photo": "http://i0.hdslb.com/bfs/space/cb1c3ef50e22b6096fde67febe863494caefebad.png", "theme": {}, "sys_notice": {}, "live_room": { "roomStatus": 0, "liveStatus": 0, "url": "", "title": "", "cover": "", "online": 0, "roomid": 0, "roundStatus": 0, "broadcast_type": 0 }, "birthday": "01-01", "school": { "name": "" }, "profession": { "name": "" }, "tags": null, "series": { "user_upgrade_status": 3, "show_upgrade_window": false } } },
  "2042149112": { "code": 0, "message": "0", "ttl": 1, "data": { "mid": 2042149112, "name": "b站_綜藝咖", "sex": "保密", "face": "http://i0.hdslb.com/bfs/face/member/noface.jpg", "sign": "提供bilibili港澳台地區專屬綜藝節目。", "rank": 10000, "level": 3, "jointime": 0, "moral": 0, "silence": 0, "coins": 0, "fans_badge": false, "fans_medal": { "show": false, "wear": false, "medal": null }, "official": { "role": 0, "title": "", "desc": "", "type": -1 }, "vip": { "type": 0, "status": 0, "due_date": 0, "vip_pay_type": 0, "theme_type": 0, "label": { "path": "", "text": "", "label_theme": "", "text_color": "", "bg_style": 0, "bg_color": "", "border_color": "" }, "avatar_subscript": 0, "nickname_color": "", "role": 0, "avatar_subscript_url": "" }, "pendant": { "pid": 0, "name": "", "image": "", "expire": 0, "image_enhance": "", "image_enhance_frame": "" }, "nameplate": { "nid": 0, "name": "", "image": "", "image_small": "", "level": "", "condition": "" }, "user_honour_info": { "mid": 0, "colour": null, "tags": [] }, "is_followed": true, "top_photo": "http://i0.hdslb.com/bfs/space/cb1c3ef50e22b6096fde67febe863494caefebad.png", "theme": {}, "sys_notice": {}, "live_room": { "roomStatus": 0, "liveStatus": 0, "url": "", "title": "", "cover": "", "online": 0, "roomid": 0, "roundStatus": 0, "broadcast_type": 0 }, "birthday": "", "school": { "name": "" }, "profession": { "name": "" }, "tags": null, "series": { "user_upgrade_status": 3, "show_upgrade_window": false } } },
};
const uposMap = {
  ks3: 'upos-sz-mirrorks3.bilivideo.com',
  ks3b: 'upos-sz-mirrorks3b.bilivideo.com',
  ks3c: 'upos-sz-mirrorks3c.bilivideo.com',
  ks32: 'upos-sz-mirrorks32.bilivideo.com',
  kodo: 'upos-sz-mirrorkodo.bilivideo.com',
  kodob: 'upos-sz-mirrorkodob.bilivideo.com',
  cos: 'upos-sz-mirrorcos.bilivideo.com',
  cosb: 'upos-sz-mirrorcosb.bilivideo.com',
  bos: 'upos-sz-mirrorbos.bilivideo.com',
  wcs: 'upos-sz-mirrorwcs.bilivideo.com',
  wcsb: 'upos-sz-mirrorwcsb.bilivideo.com',
  /** 不限CROS, 限制UA */
  hw: 'upos-sz-mirrorhw.bilivideo.com',
  hwb: 'upos-sz-mirrorhwb.bilivideo.com',
  upbda2: 'upos-sz-upcdnbda2.bilivideo.com',
  upws: 'upos-sz-upcdnws.bilivideo.com',
  uptx: 'upos-sz-upcdntx.bilivideo.com',
  uphw: 'upos-sz-upcdnhw.bilivideo.com',
  js: 'upos-tf-all-js.bilivideo.com',
  hk: 'cn-hk-eq-bcache-01.bilivideo.com',
  akamai: 'upos-hz-mirrorakam.akamaized.net',
};
const AREA_MARK_CACHE = {}
// HOOK
const URL_HOOK = {
  "https://api.bilibili.com/pgc/view/pc/season": async (req)=>{
    console.log('HOOK', req)
    const resp = JSON.parse(req.responseText || "{}")
    if(resp.code !== 0){
      // 状态码异常
      const api = new BiliBiliApi()
      sessionStorage.access_key = sessionStorage.access_key || await api.getAccessToken()
      console.log('upos: ', localStorage.upos)

      const serverList = JSON.parse(localStorage.serverList || "{}")
      console.log('serverList: ', serverList)

      let seasonInfo = null;
      const params = _params2obj(req._params)
      console.log('params: ', params)
      seasonInfo = await api.getSeasonInfoByEpSsIdOnBangumi(params.ep_id || "", params.season_id || "")
      if (seasonInfo.code === 0) {
        // title id
        seasonInfo.result.episodes.forEach(ep => {
          ep.title = ep.title || `第${ep.index}话 ${ep.index_title}`
          ep.id = ep.id || ep.ep_id
          ep.rights && (ep.rights.area_limit = 0)
        })
        // 处理部分番剧存在平台限制
        seasonInfo.result.rights.watch_platform = 0
        console.log('seasonInfo1: ', seasonInfo)
        req.responseText = JSON.stringify(seasonInfo)
        return;
      }
      const server = serverList['th'] || ""
      if (server.length === 0) return;

      api.setServer(server)

      seasonInfo = await api.getSeasonInfoByEpSsIdOnThailand(params.ep_id || "", params.season_id || "")
      if (seasonInfo.code !== 0 || seasonInfo.result.modules.length === 0) return;
      AREA_MARK_CACHE[params.ep_id] = 'th'
      seasonInfo.result.episodes = seasonInfo.result.episodes || seasonInfo.result.modules[0].data.episodes
      // title id
      seasonInfo.result.episodes.forEach(ep => {
        ep.title = ep.title || `第${ep.index}话 ${ep.index_title}`
        ep.id = ep.id || ep.ep_id
        delete ep.episode_type
      })
      seasonInfo.result.rights.watch_platform = 0
      console.log('seasonInfo2: ', seasonInfo)
      req.responseText = JSON.stringify(seasonInfo)

    }else{
      // 一些番剧可以获取到信息，但是内部有限制区域
      resp.result.episodes.forEach(ep => {
        ep.rights && (ep.rights.area_limit = 0,ep.rights.allow_dm = 0)
      })
      req.responseText = JSON.stringify(resp)
    }
  },
  "https://api.bilibili.com/pgc/view/web/season/user/status": async (req)=>{
    // console.log("解除区域限制")
    const resp = JSON.parse(req.responseText)
    resp.result && (resp.result.area_limit = 0)
    req.responseText = JSON.stringify(resp)
  },
  // 获取播放链接
  "//api.bilibili.com/pgc/player/web/playurl": async (req)=>{
    const resp = JSON.parse(req.responseText)
    if(resp.code !== 0){
      const params = _params2obj(req._params)
      const serverList = JSON.parse(localStorage.serverList||"{}")
      const upos = localStorage.upos||""
      const isReplaceAkamai = localStorage.replaceAkamai === "true"

      /**
       * 港澳台：替换 - 要referer
       * 东南亚：替换 - 不要referer
       */
      if(AREA_MARK_CACHE[params.ep_id] === 'th'){
        console.log('remove referer')
        UTILS.disableReferer()
      }else{
        console.log('add referer')
        UTILS.enableReferer()
      }
      const api = new BiliBiliApi()
      if(serverList[AREA_MARK_CACHE[params.ep_id]] && serverList[AREA_MARK_CACHE[params.ep_id]].length > 0){
        api.setServer(serverList[AREA_MARK_CACHE[params.ep_id]])
        let playURL;
        if(AREA_MARK_CACHE[params.ep_id] !== "th")
        playURL = await api.getPlayURL(req, sessionStorage.access_key || "", AREA_MARK_CACHE[params.ep_id])
        else
        playURL = await api.getPlayURLThailand(req, sessionStorage.access_key || "", AREA_MARK_CACHE[params.ep_id])
        if(playURL.code === 0){
          // 从cache的区域中取到了播放链接
          req.responseText = UTILS.replaceUpos(JSON.stringify(playURL), uposMap[upos], isReplaceAkamai, AREA_MARK_CACHE[params.ep_id])
          return;
        }
      }
      // 没有从cache的区域中取到播放链接
      for(let area in serverList){
        const server = serverList[area] || ""
        console.log('getPlayURL from ', area, ' - ', server)
        if(server.length === 0)continue;
        api.setServer(server)
        
        let playURL
        if(area !== "th"){
          playURL = await api.getPlayURL(req, sessionStorage.access_key || "", area)
        }else{
          UTILS.disableReferer()
          playURL = await api.getPlayURLThailand(req, sessionStorage.access_key || "", area)
        }
        console.log("已获取播放链接")
        if(playURL.code !== 0)continue
        // 解析成功
        AREA_MARK_CACHE[params.ep_id] = area

        // req.responseText = JSON.stringify(playURL)
        req.responseText = UTILS.replaceUpos(JSON.stringify(playURL), uposMap[upos], isReplaceAkamai, area)
        break
      }
    }
  },
  // 用户信息
  "//api.bilibili.com/x/space/acc/info": async (req)=>{
    const resp = JSON.parse(req.responseText)
    if(resp.code !== 0){
      const params = _params2obj(req._params)
      const userInfo = space_account_info_map[params.mid]
      if(userInfo)req.responseText = JSON.stringify(userInfo)
    }
  },
  // 搜索
  "https://api.bilibili.com/x/web-interface/search/type": async (req)=>{
    // console.log('===搜索 HOOK: ', req)
    const params = _params2obj(req._params)
    if(params.search_type === 'media_bangumi'){
      try{
        // 搜索番剧
        const searchResult = JSON.parse(req.responseText)
        searchResult.data.result = searchResult.data.result || []
        const api = new BiliBiliApi()
        const serverList = JSON.parse(localStorage.serverList||"{}")
        for(let area in serverList){
          const server = serverList[area] || ""
          if(server.length === 0)continue

          api.setServer(server)
          const result = await api.searchBangumi(req._params, area)
          console.log('searchResult:', result)
          result.forEach(s=>{
            s.title = `[${area}]${s.title}`
          })
          searchResult.data.result.push(...result)
          req.responseText = JSON.stringify(searchResult)
        }
      }catch(err){
        console.error(err)
      }
    }
  },
  // 东南亚字幕
  "//api.bilibili.com/x/player/v2": async (req)=>{
    if(!req._params)return;
    const resp = JSON.parse(req.responseText || "{}")
    const serverList = JSON.parse(localStorage.serverList || "{}")
    if((resp.code === -400 || resp.code === -404 || resp.data.subtitle.subtitles.length === 0) && serverList.th){
      console.log('处理字幕')
      // 字幕请求失败
      const api = new BiliBiliApi(serverList.th);
      const subtitles = await api.getSubtitleOnThailand(req._params);
      if(resp.code === 0){
        resp.data.subtitle.subtitles.push(...subtitles)
      }else if(subtitles.length > 1){
        resp.code = 0
        resp.message = "0"
        resp.data = {
          subtitle:{
            allow_submit: false,
            lan: "",
            lan_doc: "",
            subtitles
          }
        }
      }
      req.responseText = JSON.stringify(resp)
    }
  },
}

/*请求响应修改器1.0*/
class HttpRequest extends window.XMLHttpRequest {
  constructor() {
    super(...arguments);
    this._url = "";
    this._params = "";
    this.onreadystatechange = null;
    this.onloadend = null;
    let responseText = "";
    let response = null
    Object.defineProperty(this, "responseText", {
      get() {
        return responseText
      },
      set(v) {
        responseText = v
      }
    })
    Object.defineProperty(this, "response", {
      get() {
        return response
      },
      set(v) {
        response = v
      }
    })
  }
  send() {
    const arr = [...arguments];
    if (arr[0]) {
      const params = null;
      if (params !== null) {
        arr[0] = params
      }
    }
    return super.send(...arr)
  }
  open() {
    const arr = [...arguments];
    const url = arr[1];
    // console.log('request for: ', url)
    if (url) {
      const [path, params] = url.split(/\?/);
      this._url = path;
      this._params = params;
      if (this._params) {
        const params = null;
        if (params !== null) {
          arr[1] = this._url + "?" + params
        }
      }
    }
    let fn = this.onreadystatechange;
    Object.defineProperty(this, "onreadystatechange", {
      set(v) {
        fn = v;
      }
    });
    super.onreadystatechange = () => {
      if (this.readyState === 4 && this.status === 200) {
        // console.log('onreadystatechange', this)
        switch (super.responseType) {
          case 'text':
          case '': {
            const responseText = super.responseText;
            if (responseText) {
              // console.log(responseText)
              const res = null;
              if (res !== null) {
                this.responseText = res
              } else {
                this.responseText = super.responseText
              }
            } else {
              this.responseText = super.responseText
            }
          }
          break;
        case 'json': {
          const response = super.response;
          if (response) {
              const res = null;
              if (res !== null) {
                  this.response = res
              } else {
                  this.response = super.response
              }
          } else {
              this.response = super.response
          }
        }
        break;
        default:
          break;
        }
      }
      // 用于arraybuffer等
      if(super.responseType === "arraybuffer")
        this.response = super.response
      try{
        if (fn) {
          if(this.readyState === 4 && URL_HOOK[this._url]) URL_HOOK[this._url](this).then(()=>fn())
          else
          fn();
        }
      }catch(err){
        console.log('为处理的error: ', err)
      }
    };

    let fn1 = this.onloadend;
    Object.defineProperty(this, "onloadend", {
      set(v) {
        fn1 = v;
      }
    });
    super.onloadend = async () => {
      // console.log('onloadend', this)
      if (fn1) {
        if(URL_HOOK[this._url])await URL_HOOK[this._url](this)
        fn1();
      }
    };

    let fn2 = this.onload;
    Object.defineProperty(this, "onload", {
      set(v) {
        fn2 = v;
      }
    });
    super.onload = async () => {
      if (fn2) {
        // console.log('onload', this)
        if(URL_HOOK[this._url])await URL_HOOK[this._url](this)
        fn2();
      }
    };
    return super.open(...arr)
  }
  // onload(){
  //   console.log('onload', ...arguments)
  // }
}

function _deCode(params) {
  return params.split("&").map((a) => {
    const [key, value] = a.split("=");
    if (!key) return "";
    return decodeURIComponent(key) + "=" + decodeURIComponent(value)
  })
}

function _params2obj(params){
  const arr = params.split('&')
  const result = {}
  for(let param of arr){
    const [key, value] = param.split('=')
    result[key] = value
  }
  return result
}
window.XMLHttpRequest = HttpRequest;

function __awaiter(thisArg, _arguments, P, generator) {
  function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
  return new (P || (P = Promise))(function (resolve, reject) {
      function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
      function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
      function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
      step((generator = generator.apply(thisArg, _arguments || [])).next());
  });
}
const UTILS = {
  enableReferer(){
    document.getElementById('refererMark') && document.getElementById('refererMark').remove()
  },
  disableReferer(){
    if(!document.getElementById('refererMark')){
      let meta = document.createElement('meta')
      meta.id = "refererMark"
      meta.name = "referrer"
      meta.content = "no-referrer"
      document.head.appendChild(meta);
    }
  },
  replaceUpos(playURL, host, replaceAkamai = false, area=""){
    console.log('replaceUpos:', host, replaceAkamai)
    if (host && (!playURL.includes("akamaized.net") || replaceAkamai)) {
      playURL = playURL.replace(/:\\?\/\\?\/[^\/]+\\?\//g, `://${host}/`);
      
    }
    return playURL
  },
  handleTHSearchResult(itemList){
    const result = []
    for(let item of itemList){
      result.push({
        type: "media_bangumi",
        title: item.title.replace(/\u003c.*?\u003e/g, ""),
        media_type: 1,
        season_id: item.season_id,
        "season_type": 1,
        "season_type_name": "番剧",
        "selection_style": "horizontal",
        "media_mode": 2,
        "fix_pubtime_str": "",
        cover: item.cover.replace(/\?x.*?webp/, '').replace('https://pic.bstarstatic.com', 'http://localhost:22332'),
        url: item.uri.replace('bstar://bangumi/season/', 'https://www.bilibili.com/bangumi/play/ss'),
        "is_avid": false,
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
    theRequest.access_key = sessionStorage.access_key;
    if (area === 'th') {
        theRequest.area = 'th';
        theRequest.appkey = '7d089525d3611b1c';
        theRequest.build = '1001310';
        theRequest.mobi_app = 'bstar_a';
        theRequest.platform = 'android';
    }
    else {
        theRequest.area = area;
        theRequest.appkey = '07da50c9a0bf829f';
        theRequest.build = '5380700';
        theRequest.device = 'android';
        theRequest.mobi_app = 'android_b';
        theRequest.platform = 'android_b';
        theRequest.buvid = 'XY418E94B89774E201E22C5B709861B7712DD';
        // theRequest.fnval = '0'; // 强制 FLV
        theRequest.track_path = '0';
    }
    theRequest.force_host = '2'; // 强制音视频返回 https
    theRequest.ts = `${~~(Date.now() / 1000)}`;
    // 所需参数数组
    let param_wanted = ['area', 'access_key', 'appkey', 'build', 'buvid', 'cid', 'device', 'ep_id', 'fnval', 'fnver', 'force_host', 'fourk', 'mobi_app', 'platform', 'qn', 's_locale', 'season_id', 'track_path', 'ts'];
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
    }
    else {
        plaintext = mobi_api_params.slice(0, -1) + `25bdede4e1581c836cab73a48790ca6e`;
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
          };
          const frameRateMap = {
              30112: '16000/672',
              30102: '16000/672',
              30080: '16000/672',
              30077: '16000/656',
              30064: '16000/672',
              30066: '16000/656',
              30032: '16000/672',
              30033: '16000/656',
              30011: '16000/656',
              30016: '16000/672'
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
              }
              else {
                  return default_value;
              }
          }
          function getSegmentBase(url, id, range = '5000') {
              return new Promise((resolve, reject) => {
                  // 从 window 中读取已有的值
                  if (window.__segment_base_map__) {
                      if (window.__segment_base_map__.hasOwnProperty(id)) {
                          // console.log('SegmentBase read from cache ', window.__segment_base_map__[id], 'id=', id)
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
                      }
                      else {
                          window.__segment_base_map__ = {};
                          window.__segment_base_map__[id] = result;
                      }
                      // console.log('get SegmentBase ', result, 'id=', id);
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
              'timelength': origin.data.video_info.timelength,
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
              audio.backupUrl = [];
              audio.backup_url = [];
              audio.base_url = audio.base_url.replace('http://', 'https://');
              audio.baseUrl = audio.base_url;
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
                  stream.dash_video.backupUrl = [];
                  stream.dash_video.backup_url = [];
                  stream.dash_video.base_url = stream.dash_video.base_url.replace('http://', 'https://');
                  stream.dash_video.baseUrl = stream.dash_video.base_url;
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
  }
}

