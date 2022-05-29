
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
  const _historyWrap = function (type) {
    const orig = history[type];
    const e = new Event(type);
    return function () {
      const rv = orig.apply(this, arguments);
      e.arguments = arguments;
      window.dispatchEvent(e);
      return rv;
    };
  };
  history.pushState = _historyWrap('pushState');
  history.replaceState = _historyWrap('replaceState');

  function switchPage(hash) {
    // 菜单切换
    const menuDiv = document.querySelector("#app > div > div > div.app_layout--content.flex_col > div > div.app_settings.i_page_wrapper > div.header_slot.flex_start.drag")
    for (let h3 of menuDiv.children) {
      h3.style.cssText = h3.dataset.hash === hash ? "color:var(--el-text-color-primary)!important" : "color:gray!important";
    }

    // 界面切换
    const appSettingDiv = document.querySelector("#app > div > div > div.app_layout--content.flex_col > div > div.app_settings.i_page_wrapper")
    let flag = false
    for (let page of appSettingDiv.children) {
      page.dataset.hash && (page.style.display = page.dataset.hash === hash ? "" : "none")
    }
  }

  function addAreaLimit() {
    console.log("addAreaLimit")
    const url = new URL(location.href)

    // 菜单
    const menuDiv = document.querySelector("#app > div > div > div.app_layout--content.flex_col > div > div.app_settings.i_page_wrapper > div.header_slot.flex_start.drag")
    if (menuDiv.children.length === 2) return;
    menuDiv.children[0].dataset.hash = url.hash
    const areaLimitH3 = document.createElement('h3');
    areaLimitH3.textContent = "漫游"
    areaLimitH3.dataset.hash = "#/page/areaLimit"
    areaLimitH3.style.cssText = "color:gray!important"
    areaLimitH3.classList.add(...menuDiv.children[0].classList)
    menuDiv.appendChild(areaLimitH3)
    for (let menu of menuDiv.children) {
      menu.classList.add('area_limit')
      menu.onclick = (e) => {
        console.log('click: ', e)
        switchPage(e.target.dataset.hash)
      }
    }

    // 界面
    const appSettingDiv = document.querySelector("#app > div > div > div.app_layout--content.flex_col > div > div.app_settings.i_page_wrapper")
    appSettingDiv.children[1].dataset.hash = url.hash
    const areaLimitPage = document.createElement('div')
    areaLimitPage.style.display = 'none'
    areaLimitPage.dataset.hash = "#/page/areaLimit"
    areaLimitPage.classList.add(...appSettingDiv.children[1].classList)
    appSettingDiv.appendChild(areaLimitPage);
    const loadStatus = document.createElement('span')
    loadStatus.style.color = "red"
    loadStatus.style.fontSize = "xxx-large"
    areaLimitPage.appendChild(loadStatus)

    function createVueJS() {
      let ele = document.createElement('script');
      ele.src = "https://lib.baomitu.com/vue/3.2.31/vue.global.prod.min.js";
      return ele
    }

    function createElementPlusJS() {
      let ele = document.createElement('script');
      ele.src = "https://lib.baomitu.com/element-plus/2.2.0/index.full.min.js";
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
        appSettingDiv.prepend(vueNew)
        reload.remove()
      }
      loadStatus.append(reload)
    }
    appSettingDiv.prepend(vue)

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
        appSettingDiv.prepend(eleNew)
      }

      loadStatus.append(reload)
    }
    vue.onload = (e) => {
      loadStatus.textContent = "[2/2]加载element-plus"
      loadStatus.children.length === 1 && loadStatus.children[0].remove()
      ele.onerror()
      appSettingDiv.prepend(ele)
    }

    document.addEventListener('ROAMING_sendURL', async function (e) {
      // e.detail contains the transferred data (can be anything, ranging
      // from JavaScript objects to strings).
      // Do something, for example:
      console.log(e.detail);
      if(e.detail.includes("RoamingPage")){
        const roamingHTML = await HTTP_INDEX.get(e.detail)
        const container = document.createElement('div')

        container.innerHTML = roamingHTML.responseText
        areaLimitPage.appendChild(container)

        ele.onload = () => {
          loadStatus.textContent = ""
          createRoamingPage()
        }
      }
    });
    document.dispatchEvent(new CustomEvent('ROAMING_getURL', {
      detail: 'RoamingPage' // Some variable from Gmail.
    }));
  }

  // vue
  function createRoamingPage(e) {
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
          else if (!/^(?=^.{3,255}$)[a-zA-Z0-9][-a-zA-Z0-9]{0,62}(\.[a-zA-Z0-9][-a-zA-Z0-9]{0,62})+$/.test(value)) {
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
    const app = Vue.createApp(App);
    app.use(ElementPlus);
    app.mount("#roamingApp");
  }
  /**
   * 前提：默认页面为「推荐」
   * 操作：切换到设置
   * pushState: 有响应，但太快，需要延时处理
   * replaceState：无响应，但之后的切换都有响应且能直接取到元素
   */
  window.addEventListener('pushState', function (e) {
    console.log('change pushState', e);
    if (e.arguments[0].current === "/page/settings") {
      // 延时，太快取不到页面元素
      setTimeout(addAreaLimit, 500)
    }
  });
  // window.addEventListener('replaceState', function (e) {
  //   // console.log('change replaceState', e);
  //   if(e.arguments[0].current === "/page/settings"){
  //     addAreaLimit()
  //   }
  // });
  const url = new URL(location.href)
  window.onload = () => {
    if (url.hash === "#/page/settings") {
      setTimeout(addAreaLimit, 500)
    }
  }
})();
