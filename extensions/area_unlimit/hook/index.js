
(() => {
  console.log("===HOOK===INDEX===");
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
  function switchPage(hash, targetWindow = window) {
    console.log('switch to:', hash)
    // 菜单切换
    const menuDiv = targetWindow.document.querySelector("#app > div > div > div.app_layout--content.flex_col > div > div.app_settings.i_page_wrapper > div.header_slot.flex_start.drag").querySelector('.vui_tabs--nav-link')
    for (let h3 of menuDiv.children) {
      if (h3.dataset.hash === hash)
        h3.style.setProperty('color', 'var(--el-text-color-primary)', 'important')
      else
        h3.style.setProperty('color', 'gray', 'important')
    }

    // 界面切换
    const appSettingDiv = targetWindow.document.querySelector("#app > div > div > div.app_layout--content.flex_col > div > div.app_settings.i_page_wrapper")

    for (let page of appSettingDiv.children) {
      page.dataset.hash && (page.style.display = page.dataset.hash === hash ? "" : "none")
    }
  }

  function addAreaLimit(targetWindow = window) {
    console.log("addAreaLimit", targetWindow)
    const url = new URL(targetWindow.location.href)

    // 菜单
    const menuDiv = targetWindow.document.querySelector("#app > div > div > div.app_layout--content.flex_col > div > div.app_settings.i_page_wrapper > div.header_slot.flex_start.drag").querySelector('.vui_tabs--nav-link')
    if (menuDiv.children.length === 2) return;
    menuDiv.children[0].dataset.hash = url.hash
    const areaLimitH3 = targetWindow.document.createElement('h3');
    areaLimitH3.textContent = "漫游"
    areaLimitH3.dataset.hash = "#/page/areaLimit"
    areaLimitH3.style.setProperty('color', 'gray', 'important')
    areaLimitH3.style.marginLeft = '5px'
    areaLimitH3.classList.add(...menuDiv.children[0].classList)
    menuDiv.appendChild(areaLimitH3)
    for (let menu of menuDiv.children) {
      menu.classList.add('area_limit')
      menu.onclick = (e) => {
        console.log('click: ', e)
        switchPage(e.target.dataset.hash, targetWindow)
      }
    }

    // 界面
    const appSettingDiv = targetWindow.document.querySelector("#app > div > div > div.app_layout--content.flex_col > div > div.app_settings.i_page_wrapper")
    appSettingDiv.children[1].dataset.hash = url.hash
    const areaLimitPage = targetWindow.document.createElement('div')
    areaLimitPage.style.display = 'none'
    areaLimitPage.dataset.hash = "#/page/areaLimit"
    areaLimitPage.classList.add(...appSettingDiv.children[1].classList)
    appSettingDiv.appendChild(areaLimitPage);
    const loadStatus = targetWindow.document.createElement('span')
    loadStatus.style.color = "red"
    loadStatus.style.fontSize = "xxx-large"
    areaLimitPage.appendChild(loadStatus)

    function createVueJS() {
      let e = targetWindow.document.createElement('script');
      e.src = "https://lib.baomitu.com/vue/3.2.31/vue.global.prod.min.js";
      return e
    }

    function createElementPlusJS() {
      let e = targetWindow.document.createElement('script');
      e.src = "https://lib.baomitu.com/element-plus/2.2.0/index.full.min.js";
      return e
    }
    let vue = createVueJS()
    loadStatus.textContent = "[1/2]加载vue"
    vue.onerror = (e) => {
      console.error('vue加载失败', e)
      const reload = targetWindow.document.createElement('button')
      reload.textContent = "重载vue"
      reload.className = "vui_button about-button mr_sm"
      reload.onclick = () => {
        vue.remove()
        let vueNew = createVueJS()
        vueNew.onload = vue.onload
        vueNew.onerror = vue.onerror
        appSettingDiv.prepend(vueNew)
        reload.remove()
      }
      loadStatus.append(reload)
    }
    appSettingDiv.prepend(vue)

    let ele = createElementPlusJS()
    ele.onerror = (e) => {
      const reload = targetWindow.document.createElement('button')
      reload.textContent = "重载ele"
      reload.className = "vui_button about-button mr_sm"
      reload.onclick = function () {
        ele.remove()
        let eleNew = createElementPlusJS()
        eleNew.onload = ele.onload
        eleNew.onerror = ele.onerror
        reload.remove()
        appSettingDiv.prepend(eleNew)
      }

      loadStatus.append(reload)
    }
    vue.onload = (e) => {
      console.log('vue.onload', e)
      loadStatus.textContent = "[2/2]加载element-plus"
      loadStatus.children.length === 1 && loadStatus.children[0].remove()
      ele.onerror()
      appSettingDiv.prepend(ele)
    }

    document.addEventListener('ROAMING_sendURL', async function (e) {
      // e.detail contains the transferred data (can be anything, ranging
      // from JavaScript objects to strings).
      // Do something, for example:
      console.log('index ROAMING_sendURL:', e.detail);
      if(e.detail.includes("RoamingPage")){
        // 判断HTML为漫游页面
        const roamingHTML = await HTTP_INDEX.get(e.detail)
        const container = targetWindow.document.createElement('div')

        container.innerHTML = roamingHTML.responseText
        areaLimitPage.appendChild(container)

        ele.onload = () => {
          loadStatus.textContent = ""
          createRoamingPage(targetWindow)
        }
      }
    });
    // 获取漫游HTML
    console.log('获取漫游HTML')
    document.dispatchEvent(new CustomEvent('ROAMING_getURL', {
      detail: 'RoamingPage' // Some variable from Gmail.
    }));
  }

  // vue
  function createRoamingPage(targetWindow = window) {
    console.log('RoamingPage HTML')
    const App = {
      data() {
        return {
          message: "Hello Element Plus",
          uposList: [{
            value: 'none',
            label: '不替换'
          },
            {
              value: 'ks3',
              label: 'ks3(金山)'
            },
            {
              value: 'kodo',
              label: 'kodo（七牛）'
            },
            {
              value: 'cos',
              label: 'cos（腾讯）'
            },
            {
              value: 'bos',
              label: 'bos（百度）'
            },
            {
              value: 'wcs',
              label: 'wcs（网宿）'
            },
            {
              value: 'hw',
              label: 'hw（251）'
            },
          ],
          uposKey: localStorage.upos || 'none',
          replaceAkamai: localStorage.replaceAkamai === "true",
          pacLink: localStorage.pacLink || "",
          serverList: {
            default: '',
            mainLand: '',
            hk: '',
            tw: '',
            th: ''
          },
          serverRule: {
            default: [{
              validator: this.checkDomain,
              trigger: 'blur',
            }, ],
            mainLand: [{
              validator: this.checkDomain,
            }, ],
            hk: [{
              validator: this.checkDomain,
              trigger: 'blur',
            }, ],
            tw: [{
              validator: this.checkDomain,
              trigger: 'blur',
            }, ],
            th: [{
              validator: this.checkDomain,
              trigger: 'blur',
            }, ]
          }
        };
      },
      created() {
        console.log('vue created')
        const serverList = JSON.parse(localStorage.serverList || "{}")
        for (let area in serverList) {
          this.serverList[area] = serverList[area]
        }
      },
      methods: {
        changeUPOS: function (upos) {
          // console.log('upos change: ', upos)
          localStorage.upos = upos
          this.$notify({
            title: 'Success',
            message: "成功",
            type: 'success'
          })
        },
        changeReplaceAkamai: function () {
          this.$notify({
            title: 'Success',
            message: "成功",
            type: 'success'
          })
          localStorage.replaceAkamai = this.replaceAkamai ? 'true' : 'false'
        },
        changePACLink: function () {
          localStorage.pacLink = this.pacLink
          if (this.pacLink && this.pacLink.length > 0) {
            let result = biliBridgePc.callNativeSync('config/roamingPAC', this.pacLink)
            if (result === 'error')
              this.$notify({
                title: 'Success',
                message: "失败",
                type: 'error'
              })
            else
              this.$notify({
                title: 'Success',
                message: "成功",
                type: 'success'
              })
          } else
            this.$notify({
              title: 'Success',
              message: "成功",
              type: 'success'
            })
        },
        saveServer: function (formEl) {
          if (!formEl) return
          console.log('saveServer: ', formEl, this.$refs)
          this.$refs.serverFormRef.validate((valid) => {
            if (valid) {
              // console.log(this.serverList)
              this.$notify({
                title: 'Success',
                message: "成功",
                type: 'success'
              })
              localStorage.serverList = JSON.stringify(this.serverList)
            } else {
              console.log('error submit!')
              return false
            }
          })
        },
        checkDomain: (rule, value, callback) => {
          // console.log(rule, value)
          if ((value || "") === "")
            callback()
          else if (!/^(?=^.{3,255}$)[a-zA-Z0-9\u4e00-\u9fa5][-a-zA-Z0-9\u4e00-\u9fa5]{0,62}(\.[a-zA-Z0-9\u4e00-\u9fa5][-a-zA-Z0-9\u4e00-\u9fa5]{0,62})+$/.test(value)) {
            callback(new Error("域名校验失败"))
          }
          callback()
        },
        resetForm: function (formEl) {
          // console.log('resetForm: ', formEl)
          if (!formEl) return
          formEl.resetFields()
        }
      }
    };
    const app = targetWindow.Vue.createApp(App);
    app.use(targetWindow.ElementPlus);
    app.mount("#roamingApp");
  }
  // window.addEventListener('replaceState', function (e) {
  //   // console.log('change replaceState', e);
  //   if(e.arguments[0].current === "/page/settings"){
  //     addAreaLimit()
  //   }
  // });
  const targetOnload = (targetWindow = window)=>{
    const url = new URL(targetWindow.location.href)

    // 监听hash值变动
    const _historyWrap = function (type) {
      const orig = targetWindow.history[type];
      const e = new Event(type);
      return function () {
        const rv = orig.apply(this, arguments);
        e.arguments = arguments;
        targetWindow.dispatchEvent(e);
        return rv;
      };
    };
    targetWindow.history.pushState = _historyWrap('pushState');
    targetWindow.history.replaceState = _historyWrap('replaceState');

    /**
     * 前提：默认页面为「推荐」
     * 操作：切换到设置
     * pushState: 有响应，但太快，需要延时处理
     * replaceState：无响应，但之后的切换都有响应且能直接取到元素
     */
    targetWindow.addEventListener('pushState', function (e) {
      console.log('change pushState', e);
      if (e.arguments[0].current === "/page/settings") {
        // 延时，太快取不到页面元素
        setTimeout(addAreaLimit, 500, targetWindow)
      }
    });

    if (url.hash === "#/page/settings") {
      setTimeout(addAreaLimit, 500, targetWindow)
    }
  }
  // 获取App的Iframe
  const appFrame = document.getElementById('bili-app')
  const appWindow = appFrame.contentWindow
  if(appFrame.attachEvent){
    appFrame.attachEvent('onload', ()=>{
      console.log("appFrame.attachEvent 'onload'")
    })
  }else{
    appFrame.onload = ()=>{
      console.log('appWindow.onload')
      // console.log(window.XMLHttpRequest, targetWindow.XMLHttpRequest)
      appWindow.XMLHttpRequest = window.getHookXMLHttpRequest(appWindow)
      appWindow.hex_md5 = window.hex_md5
      targetOnload(appWindow)
      try {
        const appSearchEle = appWindow.document.querySelector('.app_search')
        const search = appSearchEle.querySelector('iframe')
        if (!window.hex_md5) {
          console.error('md5函数丢失！')
        }
        search.contentWindow.hex_md5 = window.hex_md5
        search.contentWindow.XMLHttpRequest = window.getHookXMLHttpRequest(search.contentWindow)
      }catch (e){
        console.error('搜索页面md5与XMLHttpRequest初始化异常', e)
      }
    }
  }
})();
