const pacLink = localStorage.pacLink || ""
let result = ""
if(pacLink.length > 0)
  result = biliBridgePc.callNativeSync('config/roamingPAC', pacLink);
if(result === 'error')localStorage.pacLink = ""
console.log("====HOOK===PLAYER====");

(()=>{

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
    }
  }
  const BilibiliAPI = {
    getEpDetails: (seasonId, epId)=>{
      const api = new BiliBiliApi()
      return api.getSeasonInfoByEpSsIdOnBangumi(epId || "", seasonId || "")
      .then(seasonInfo=>{
        console.log('seasonInfo: ', seasonInfo)
        if(seasonInfo.code !==0)return Promise.reject(seasonInfo)

        const ep = seasonInfo.result.episodes.filter(ep=>ep.ep_id===epId)
        if(ep.length === 0)return Promise.reject("剧集查找失败")
        return Promise.resolve(ep[0])
      })
    }
  }
  const SearchAPI = {
    bilibili: (str)=>{
      const url = `http://api.bilibili.com/x/web-interface/search/type?keyword=${str}&search_type=media_bangumi`
      return HTTP.get(url).then(res=>{
        const resp = JSON.parse(res.responseText)
        console.log('bilibili: ', resp)
        const bangumiList = []
        const result = resp.data?.result ?? []
        console.log('result: ', result)
        for(let bangumi of result){
          let children = []
          for(let ep of bangumi.eps){
            const title = ep.title.length < 5 ? `${ep.title}-${ep.long_title.replace(/<.*?>/g, '')}` : ep.title.replace(/<.*?>/g, '')
            children.push({
              label: title,
              value: ep.id
            })
          }
          bangumiList.push({
            label: bangumi.title.replace(/<.*?>/g, ''),
            value: bangumi.pgc_season_id,
            children
          })
        }
        return Promise.resolve(bangumiList)
      })
    }
  }
  const HandleResult = {
    bilibili: async (options)=>{
      console.log('bilibili options: ', options)
      const epDetails = await BilibiliAPI.getEpDetails(...options)
      console.log('getEpDetails: ', epDetails)

      // 弹幕池操作
      danmakuManage.rootStore.configStore.reload.cid = epDetails.cid
      // danmakuManage.rootStore.configStore.reload.aid = epDetails.aid
      danmakuManage.danmaku.danmakuArray = []
      danmakuManage.danmaku.clear()
      danmakuManage.danmakuStore.loadDmPbAll(true)
    }
  }
  const UI = (()=>{
    const init = ()=>{
      console.log("init")
      const appContainer = document.querySelector("#app > div > div.app_player--content.flex_end.ov_hidden")
      const page = document.createElement('div')
      page.className = "msojocs-player-settings"
      page.id = "msojocs-player-settings"
      page.style.display = "none"
      appContainer.appendChild(page)
      const loadStatus = document.createElement('span')
      loadStatus.style.color = "red"
      loadStatus.style.fontSize = "xxx-large"
      page.appendChild(loadStatus)

      function createVueJS() {
        let ele = document.createElement('script');
        ele.src = "https://lib.baomitu.com/vue/3.2.31/vue.global.prod.min.js";
        return ele
      }
    
      function createElementPlusJS() {
        let ele = document.createElement('script');
        ele.src = "https://lib.baomitu.com/element-plus/2.1.4/index.full.min.js";
        return ele
      }
      let vue = createVueJS()
      loadStatus.textContent = "[1/2]加载vue"
      vue.onerror = (e) => {
        const reload = document.createElement('button')
        reload.textContent = "重载vue"
        reload.className = "vui_button about-button mr_sm"
        reload.onclick = () => {
          vue.remove()
          let vueNew = createVueJS()
          vueNew.onload = vue.onload
          vueNew.onerror = vue.onerror
          page.prepend(vueNew)
          reload.remove()
        }
        loadStatus.append(reload)
      }
      page.prepend(vue)
    
      let ele = createElementPlusJS()
      ele.onerror = () => {
        const reload = document.createElement('button')
        reload.textContent = "重载ele"
        reload.className = "vui_button about-button mr_sm"
        reload.onclick = function () {
          ele.remove()
          let eleNew = createElementPlusJS()
          eleNew.onload = ele.onload
          eleNew.onerror = ele.onerror
          reload.remove()
          page.prepend(eleNew)
        }
    
        loadStatus.children.length === 0 && loadStatus.append(reload)
      }
      vue.onload = (e) => {
        loadStatus.textContent = "[2/2]加载element-plus"
        loadStatus.children.length === 1 && loadStatus.children[0].remove()
        ele.onerror()
        page.prepend(ele)
      }
    
      document.addEventListener('ROAMING_sendURL', async function (e) {
        // e.detail contains the transferred data (can be anything, ranging
        // from JavaScript objects to strings).
        // Do something, for example:
        console.log('ROAMING_sendURL: ', e.detail);
        if(e.detail.includes("PlayerEnhance")){
          const roamingHTML = await HTTP.get(e.detail)
          const container = document.createElement('div')
      
          container.innerHTML = roamingHTML.responseText
          ele.onload = () => {
            loadStatus.textContent = ""
            page.className = ""
            loadPage()
          }
          page.appendChild(container)
        }
      });
      document.dispatchEvent(new CustomEvent('ROAMING_getURL', {
        detail: 'PlayerEnhance' // Some variable from Gmail.
      }));
    }
    let changeShow = ()=>{
      const page = document.getElementById("msojocs-player-settings")
      if(page){
        page.style.display = page.style.display === "none" ? "" : "none"
      }
    }
    const loadPage = ()=>{
      console.log("Vue Start")
      const App = {
        data() {
          return {
            activeName: "bilibili",
            searchStr: "",
            searchResult: [],
            selectOptions: null,
            settingsVisible: false
          };
        },
        created() {
          console.log('vue created')
          document.getElementById("player-ext-settings").onclick = ()=>{
            this.settingsVisible = !this.settingsVisible
          }
          this.settingsVisible = document.getElementById("msojocs-player-settings").style.display !== "none"
          document.getElementById("msojocs-player-settings").style.display = ""
        },
        methods: {
          doSearch: function(){
            SearchAPI[this.activeName](this.searchStr)
            .then(resp=>{
              this.searchResult = resp || []
            })
          },
          doConfirm: function(){
            console.log('selectOptions', this.selectOptions)
            HandleResult[this.activeName](this.selectOptions)
          }
        }
      };
      const app = Vue.createApp(App);
      app.use(ElementPlus);
      app.mount("#player-settings-ext");
    }
    return {
      init,
      changeShow,
    }
  })()

  window.onload = ()=>{
    const headerLeft = document.querySelector("#app > div > div.app_player--header.flex_between.draggable > div.app_player--header-left.mt_2")

    // 创建菜单元素
    const playerExtPage = document.createElement('span')
    playerExtPage.textContent = "弹幕Ext"
    playerExtPage.id = "player-ext-settings"
    playerExtPage.className = "app_player--header-home no_drag"
    playerExtPage.onclick = ()=>{
      UI.changeShow()
    }
    UI.init()
    // 添加按钮到页面
    headerLeft.appendChild(playerExtPage)
  }
})()