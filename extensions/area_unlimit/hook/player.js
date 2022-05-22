const pacLink = localStorage.pacLink || ""
let result = ""
if(pacLink.length > 0)
  result = biliBridgePc.callNativeSync('config/roamingPAC', pacLink);
if(result === 'error')localStorage.pacLink = ""
console.log("====HOOK===PLAYER====");

(()=>{

  const HTTP_INDEX = {
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
  const UI = (()=>{
    const init = ()=>{
      console.log("init")
      const appContainer = document.querySelector("#app > div > div.app_player--content.flex_end.ov_hidden")
      const page = document.createElement('div')
      page.className = "msojocs-player-settings"
      page.id = "msojocs-player-settings"
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
    
        loadStatus.append(reload)
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
          const roamingHTML = await HTTP_INDEX.get(e.detail)
          const container = document.createElement('div')
      
          container.innerHTML = roamingHTML.responseText
          ele.onload = () => {
            loadStatus.textContent = ""
            loadPage()
          }
          page.appendChild(container)
        }
      });
      document.dispatchEvent(new CustomEvent('ROAMING_getURL', {
        detail: 'PlayerEnhance' // Some variable from Gmail.
      }));
    }
    const changeShow = ()=>{
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
            message: "1234",
            activeName: "bilibili",
            searchStr: "",
            searchResult: []
          };
        },
        created() {
          console.log('vue created')
        },
        methods: {
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
    playerExtPage.className = "app_player--header-home no_drag"
    playerExtPage.onclick = ()=>{
      UI.changeShow()
    }
    UI.init()
    // 添加按钮到页面
    headerLeft.appendChild(playerExtPage)
  }
})()