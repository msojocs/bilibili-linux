/* eslint-disable @typescript-eslint/no-explicit-any */
import md5 from "md5"
import { BiliBiliApi, type AreaType } from "./bilibili-api"
import { createLogger } from "./log"
import type { BiliAppSearchResultType, BiliWebSearchResultType, THSearchResultType } from "./types"

const log = createLogger('Utils')
export const UTILS = {
  getAccessToken() {
    const tokenInfo = JSON.parse(localStorage.bili_accessToken_hd || '{}')
    return tokenInfo.access_token
  },
  enableReferer() {
    const referrerEle = document.getElementById('referrerMark')
    if (!referrerEle) return;
    referrerEle.setAttribute('content', "strict-origin-when-cross-origin")
  },
  disableReferer() {
    const referrerEle = document.getElementById('referrerMark');
    if (!referrerEle) {
      const meta = document.createElement('meta')
      meta.id = "referrerMark"
      meta.name = "referrer"
      meta.content = "no-referrer"
      document.head.appendChild(meta);
    } else {
      referrerEle.setAttribute('content', "no-referrer")
    }
  },
  replaceUpos(playURL: string, host: string, replaceAkamai: boolean = false, _area: AreaType = "hk") {
    log.info('replaceUpos:', host, replaceAkamai)
    if (host && (!playURL.includes("akamaized.net") || replaceAkamai)) {
      playURL = playURL.replace(/:\\?\/\\?\/[^/]+\\?\//g, `://${host}/`);
    }
    return playURL
  },
  handleTHSearchResult(itemList: THSearchResultType[]) {
    log.info('th:', itemList)
    const result: BiliWebSearchResultType[] = []
    for (const item of itemList) {
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
        url: item.uri.replace('bstar://pgc/season/', 'https://www.bilibili.com/bangumi/play/ss'),
        is_avid: false,
        areas: "",
        cv: "",
        ep_size: 0,
        eps: [],
        is_follow: 0,
        is_selection: 0,
        media_id: 0,
        media_score: {
          score: 0,
          user_count: 0
        },
        org_title: "",
        pubtime: "",
        staff: "",
        styles: ""
      })
    }
    return result
  },
  handleAppSearchResult(itemList: BiliAppSearchResultType[]) {
    const result = []
    for (const item of itemList) {
      const eps = (item.episodes || []).map((e) => {
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
  generateMobiPlayUrlParams(originUrl: string, area: AreaType) {
    // 提取参数为数组
    const a = originUrl.split('?')[1].split('&');
    // 参数数组转换为对象
    const theRequest: Record<string, string> = {};
    for (let i = 0; i < a.length; i++) {
      const key = a[i].split("=")[0];
      const value = a[i].split("=")[1];
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
    const param_wanted = ['access_key', 'appkey', 'area', 'build', 'buvid', 'cid', 'device', 'ep_id', 'fnval', 'fnver', 'force_host', 'fourk', 'mobi_app', 'platform', 'qn', 's_locale', 'season_id', 'track_path', 'ts'];
    // 生成 mobi api 参数字符串
    let mobi_api_params = '';
    for (let i = 0; i < param_wanted.length; i++) {
      if (Object.prototype.hasOwnProperty.call(theRequest, param_wanted[i])) {
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
    const ciphertext = md5(plaintext);
    return `${mobi_api_params}sign=${ciphertext}`;
  },
  async fixMobiPlayUrlJson(originJson: Record<string, any>) {
      const codecsMap: Record<string, string> = {
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
      const resolutionMap: Record<string, number[]> = {
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
      const frameRateMap: Record<string, string> = {
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
      let segmentBaseMap: Record<string, any> = {};

      function getId(url: string, default_value: string, get_filename = false) {
        if (get_filename) {
          // 作为SegmentBaseMap的Key，在同一个页面下切换集数不至于出错
          const path = url.split('?')[0];
          const pathArr = path.split('/');
          return pathArr[pathArr.length - 1].replace('.m4s', ''); // 返回文件名
        }
        const i = /(nb2-1-)?\d{5}\.m4s/.exec(url);
        if (i !== null) {
          return i[0].replace('.m4s', '');
        } else {
          return default_value;
        }
      }

      function getSegmentBase(url: string, id: string, range = '5000') {
        return new Promise((resolve, _reject) => {
          // 从 window 中读取已有的值
          if (window.__segment_base_map__) {
            if (Object.prototype.hasOwnProperty.call(window.__segment_base_map__, id)) {
              // log.log('SegmentBase read from cache ', window.__segment_base_map__[id], 'id=', id)
              return resolve(window.__segment_base_map__[id]);
            }
          }
          const xhr = new XMLHttpRequest();
          xhr.open('GET', url, true);
          // TV 动画 range 通常在 4000~5000，剧场版动画大概 14000+
          xhr.setRequestHeader('Range', `bytes=0-${range}`); // 下载前 5000 字节数据用于查找 sidx 位置
          xhr.responseType = 'arraybuffer';
          let data;
          xhr.onload = function (_oEvent) {
            data = new Uint8Array(xhr.response);
            const hex_data = Array.prototype.map.call(data, x => ('00' + x.toString(16)).slice(-2)).join(''); // 转换成 hex
            const indexRangeStart = hex_data.indexOf('73696478') / 2 - 4; // 73696478 是 'sidx' 的 hex ，前面还有 4 个字节才是 sidx 的开始
            const indexRagneEnd = hex_data.indexOf('6d6f6f66') / 2 - 5; // 6d6f6f66 是 'moof' 的 hex，前面还有 4 个字节才是 moof 的开始，-1为sidx结束位置
            const result = ['0-' + String(indexRangeStart - 1), String(indexRangeStart) + '-' + String(indexRagneEnd)];
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

      const result = JSON.parse(JSON.stringify(originJson));
      result.dash.duration = Math.round(result.timelength / 1000);
      result.dash.minBufferTime = 1.5;
      result.dash.min_buffer_time = 1.5;
      // 异步构建 segmentBaseMap
      const taskList: unknown[] = [];
      // SegmentBase 最大 range 和 duration 的比值大概在 2.5~3.2，保险这里取 3.5
      // let range = Math.round(result.dash.duration * 3.5).toString()
      // 乱猜 range 导致泡面番播不出
      result.dash.video.forEach((video: any) => {
        if (video.backupUrl.length > 0 && video.backupUrl[0].indexOf('akamaized.net') > -1) {
          // 有时候返回 bcache 地址, 直接访问 bcache CDN 会报 403，如果备用地址有 akam，替换为 akam
          video.baseUrl = video.backupUrl[0];
        }
        taskList.push(getSegmentBase(video.baseUrl, getId(video.baseUrl, '30080', true)));
      });
      result.dash.audio.forEach((audio: any) => {
        if (audio.backupUrl.length > 0 && audio.backupUrl[0].indexOf('akamaized.net') > -1) {
          audio.baseUrl = audio.backupUrl[0];
        }
        taskList.push(getSegmentBase(audio.baseUrl, getId(audio.baseUrl, '30080', true)));
      });
      await Promise.all(taskList);
      if (window.__segment_base_map__)
        segmentBaseMap = window.__segment_base_map__;
      // 填充视频流数据
      result.dash.video.forEach((video: any) => {
        // log.log('video: ', video)
        let video_id = getId(video.baseUrl, '30280');
        if (!Object.prototype.hasOwnProperty.call(codecsMap, video_id)) {
          // https://github.com/ipcjs/bilibili-helper/issues/775
          // 泰区的视频URL不包含 id 了
          video_id = (30000 + video.id).toString();
        }
        video.codecs = codecsMap[video_id];
        const segmentBaseId = getId(video.baseUrl, '30280', true);
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
      result.dash.audio.forEach((audio: any) => {
        let audio_id = getId(audio.baseUrl, '30280');
        if (!Object.prototype.hasOwnProperty.call(codecsMap, audio_id)) {
          // https://github.com/ipcjs/bilibili-helper/issues/775
          // 泰区的音频URL不包含 id 了
          audio_id = audio.id.toString();
        }
        const segmentBaseId = getId(audio.baseUrl, '30280', true);
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
  },
  async fixThailandPlayUrlJson(originJson: string) {
      const origin = JSON.parse(JSON.stringify(originJson));
      const result: Record<string, any> = {
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
      const dash: Record<string, any> = {
        'duration': 0,
        'minBufferTime': 0.0,
        'min_buffer_time': 0.0,
        'audio': []
      };
      // 填充音频流数据
      origin.data.video_info.dash_audio.forEach((audio: any) => {
        log.info('填充音频流数据:', audio)
        const backup_urls = audio.backup_url.filter((e: string) => !e.includes('akamaized.net'))
        audio.base_url = backup_urls[0] || audio.base_url.replace('http://', 'https://');
        audio.baseUrl = backup_urls[0] || audio.base_url;
        audio.backupUrl = audio.backupUrl || [];
        audio.backup_url = audio.backup_url || [];
        dash.audio.push(audio);
      });
      // 填充视频流数据
      const accept_quality: any[] = [];
      const accept_description: any[] = [];
      const support_formats: any[] = [];
      const dash_video: any[] = [];
      origin.data.video_info.stream_list.forEach((stream: any) => {
        support_formats.push(stream.stream_info);
        accept_quality.push(stream.stream_info.quality);
        accept_description.push(stream.stream_info.new_description);
        // 只加入有视频链接的数据
        if (stream.dash_video && stream.dash_video.base_url) {
          const backup_urls = stream.dash_video.backup_url.filter((e: string) => !e.includes('akamaized.net'))
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
      return await UTILS.fixMobiPlayUrlJson(result);
  },
  genSearchSign(params: Record<string, string | number>, area: AreaType) {

    // 所需参数数组
    const param_wanted = ['access_key', 'appkey', 'area', 'build', 'buvid', 'c_locale', 'channel', 'cid', 'device', 'disable_rcmd', 'ep_id', 'fnval', 'fnver', 'force_host', 'fourk', 'highlight', 'keyword', 'lang', 'mobi_app', 'platform', 'pn', 'ps', 'qn', 's_locale', 'sim_code', 'statistics', 'season_id', 'track_path', 'ts', 'type'];
    // 生成 mobi api 参数字符串
    let mobi_api_params = '';
    for (let i = 0; i < param_wanted.length; i++) {
      if (Object.prototype.hasOwnProperty.call(params, param_wanted[i])) {
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
    return md5(plaintext)
  },
  genSearchParam(params: Record<string, string>, area: AreaType) {
    const result: Record<string, string | number> = {
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
      ts: new Date().getTime() / 1000,
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
  _params2obj(params: string) {
    const arr = params.split('&')
    const result: Record<string, string> = {}
    for (const param of arr) {
      const [key, value] = param.split('=')
      result[key] = value
    }
    return result
  },
  async genVideoDetailByDynamicDetail(dynamicDetail: Record<string, any>) {
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
    log.info('dynamic card:', card)
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

/**
 * 动态添加JavaScript
 * @param {*} url 资源地址
 * @param {*} callback 回调方法
 */
export const getScript = (url: string) => {
  const script = document.createElement('script');// 创建script元素
  script.type = "text/javascript"; // 定义script元素的类型(可省略)
  script.src = url; // js地址
  document.body.appendChild(script);// 插入body可改为head
}

export const sleep = (time: number) => new Promise((resolve) => setTimeout(resolve, time))