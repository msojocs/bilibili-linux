const HTTP = {
  get(url){
    return new Promise((resolve, reject)=>{
      const Http = new XMLHttpRequest()
      Http.open('GET', url)
      Http.send()
      Http.onloadend = e=>{
        console.log('URL: ', Http.responseURL)
        const access_key = new URL(Http.responseURL).searchParams.get('access_key')

        resolve(access_key)
      }
      Http.onerror = e=>reject
    })
  }
}
class BiliBiliApi {
  constructor(request, server = '//api.bilibili.com') {
      this.server = server;
      this.request = request;
  }
  setServer(server){
    this.server = server
  }
  getSeasonInfoByEpId(ep_id) {
      return this.request.get(`${this.server}/pgc/view/web/season?ep_id=${ep_id}`);
  }
  getSeasonInfo(season_id) {
      return this.request.get(`${this.server}/pgc/view/web/season?season_id=${season_id}`);
  }
  getSeasonInfoByEpSsIdOnBangumi(ep_id, season_id) {
      return this.request.get('//bangumi.bilibili.com/view/web_api/season?' + (ep_id != '' ? `ep_id=${ep_id}` : `season_id=${season_id}`));
  }
  getSeasonInfoByEpSsIdOnThailand(ep_id, season_id) {
      const params = '?' + (ep_id != '' ? `ep_id=${ep_id}` : `season_id=${season_id}`) + `&mobi_app=bstar_a&s_locale=zh_SG`;
      const newParams = generateMobiPlayUrlParams(params, 'th');
      return this.request.get(`${this.server}/intl/gateway/v2/ogv/view/app/season?` + newParams);
  }
  getAccessToken(){
    const url = "https://passport.bilibili.com/login/app/third?appkey=27eb53fc9058f8c3&api=https%3A%2F%2Fwww.mcbbs.net%2Ftemplate%2Fmcbbs%2Fimage%2Fspecial_photo_bg.png&sign=04224646d1fea004e79606d3b038c84a"
    return this.request.get(url).then(res=>{
      console.log("---hook--AT", res)
      return HTTP.get(res.data.confirm_uri)
    })
  }
}

window.__HOOK__ = {}
window.__HOOK__["pgc/view/pc/season"] = async (obj)=>{
  const {request, params, config, resultHandle} = obj
  try{
    const api = new BiliBiliApi(request)
    window.access_key = window.access_key || await api.getAccessToken()
    console.log('upos: ', localStorage.upos)
    const serverList = JSON.parse(localStorage.serverList || "{}")
    console.log('serverList: ', serverList)
    let seasonInfo = null;
    for(let area in serverList){
      console.log("for ")
      const server = serverList[area] || ""
      if(server.length === 0)continue

      api.setServer(server)

      seasonInfo = await api.getSeasonInfoByEpSsIdOnBangumi(params.ep_id || "", params.season_id || "")
      console.log('area: ', area, ', seasonInfo: ', seasonInfo)
      if(seasonInfo.code !== 0)continue;
      // title id
      seasonInfo.result.episodes.forEach(ep=>{
        ep.title = ep.title || `第${ep.index}话 ${ep.index_title}`
        ep.id = ep.id || ep.ep_id
      })
      break;
    }

    if(seasonInfo?.code??-1 !== 0)return Promise.reject(obj.error)
    
    return resultHandle(seasonInfo.result)
  }catch(err){
    console.error('HOOK ERROR: ', err)
    return Promise.reject(obj.error)
  }
}
