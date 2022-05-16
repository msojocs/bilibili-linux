console.log("index")
var space_account_info_map = {
  "11783021": { "code": 0, "message": "0", "ttl": 1, "data": { "mid": 11783021, "name": "哔哩哔哩番剧出差", "sex": "保密", "face": "http://i0.hdslb.com/bfs/face/9f10323503739e676857f06f5e4f5eb323e9f3f2.jpg", "sign": "", "rank": 10000, "level": 6, "jointime": 0, "moral": 0, "silence": 0, "coins": 0, "fans_badge": false, "fans_medal": { "show": false, "wear": false, "medal": null }, "official": { "role": 3, "title": "哔哩哔哩番剧出差 官方账号", "desc": "", "type": 1 }, "vip": { "type": 0, "status": 0, "due_date": 0, "vip_pay_type": 0, "theme_type": 0, "label": { "path": "", "text": "", "label_theme": "", "text_color": "", "bg_style": 0, "bg_color": "", "border_color": "" }, "avatar_subscript": 0, "nickname_color": "", "role": 0, "avatar_subscript_url": "" }, "pendant": { "pid": 0, "name": "", "image": "", "expire": 0, "image_enhance": "", "image_enhance_frame": "" }, "nameplate": { "nid": 0, "name": "", "image": "", "image_small": "", "level": "", "condition": "" }, "user_honour_info": { "mid": 0, "colour": null, "tags": [] }, "is_followed": true, "top_photo": "http://i2.hdslb.com/bfs/space/cb1c3ef50e22b6096fde67febe863494caefebad.png", "theme": {}, "sys_notice": {}, "live_room": { "roomStatus": 1, "liveStatus": 0, "url": "https://live.bilibili.com/931774", "title": "「梦之祭！部」 社团活动最终回", "cover": "http://i0.hdslb.com/bfs/live/c89c499096fa6527765de1fcaa021c9e2db7fbf8.jpg", "online": 0, "roomid": 931774, "roundStatus": 0, "broadcast_type": 0 }, "birthday": "", "school": { "name": "" }, "profession": { "name": "" }, "tags": null, "series": { "user_upgrade_status": 3, "show_upgrade_window": false } } },
  "1988098633": { "code": 0, "message": "0", "ttl": 1, "data": { "mid": 1988098633, "name": "b站_戲劇咖", "sex": "保密", "face": "http://i0.hdslb.com/bfs/face/member/noface.jpg", "sign": "提供bilibili港澳台地區專屬戲劇節目。", "rank": 10000, "level": 2, "jointime": 0, "moral": 0, "silence": 0, "coins": 0, "fans_badge": false, "fans_medal": { "show": false, "wear": false, "medal": null }, "official": { "role": 0, "title": "", "desc": "", "type": -1 }, "vip": { "type": 0, "status": 0, "due_date": 0, "vip_pay_type": 0, "theme_type": 0, "label": { "path": "", "text": "", "label_theme": "", "text_color": "", "bg_style": 0, "bg_color": "", "border_color": "" }, "avatar_subscript": 0, "nickname_color": "", "role": 0, "avatar_subscript_url": "" }, "pendant": { "pid": 0, "name": "", "image": "", "expire": 0, "image_enhance": "", "image_enhance_frame": "" }, "nameplate": { "nid": 0, "name": "", "image": "", "image_small": "", "level": "", "condition": "" }, "user_honour_info": { "mid": 0, "colour": null, "tags": [] }, "is_followed": true, "top_photo": "http://i0.hdslb.com/bfs/space/cb1c3ef50e22b6096fde67febe863494caefebad.png", "theme": {}, "sys_notice": {}, "live_room": { "roomStatus": 0, "liveStatus": 0, "url": "", "title": "", "cover": "", "online": 0, "roomid": 0, "roundStatus": 0, "broadcast_type": 0 }, "birthday": "01-01", "school": { "name": "" }, "profession": { "name": "" }, "tags": null, "series": { "user_upgrade_status": 3, "show_upgrade_window": false } } },
  "2042149112": { "code": 0, "message": "0", "ttl": 1, "data": { "mid": 2042149112, "name": "b站_綜藝咖", "sex": "保密", "face": "http://i0.hdslb.com/bfs/face/member/noface.jpg", "sign": "提供bilibili港澳台地區專屬綜藝節目。", "rank": 10000, "level": 3, "jointime": 0, "moral": 0, "silence": 0, "coins": 0, "fans_badge": false, "fans_medal": { "show": false, "wear": false, "medal": null }, "official": { "role": 0, "title": "", "desc": "", "type": -1 }, "vip": { "type": 0, "status": 0, "due_date": 0, "vip_pay_type": 0, "theme_type": 0, "label": { "path": "", "text": "", "label_theme": "", "text_color": "", "bg_style": 0, "bg_color": "", "border_color": "" }, "avatar_subscript": 0, "nickname_color": "", "role": 0, "avatar_subscript_url": "" }, "pendant": { "pid": 0, "name": "", "image": "", "expire": 0, "image_enhance": "", "image_enhance_frame": "" }, "nameplate": { "nid": 0, "name": "", "image": "", "image_small": "", "level": "", "condition": "" }, "user_honour_info": { "mid": 0, "colour": null, "tags": [] }, "is_followed": true, "top_photo": "http://i0.hdslb.com/bfs/space/cb1c3ef50e22b6096fde67febe863494caefebad.png", "theme": {}, "sys_notice": {}, "live_room": { "roomStatus": 0, "liveStatus": 0, "url": "", "title": "", "cover": "", "online": 0, "roomid": 0, "roundStatus": 0, "broadcast_type": 0 }, "birthday": "", "school": { "name": "" }, "profession": { "name": "" }, "tags": null, "series": { "user_upgrade_status": 3, "show_upgrade_window": false } } },
};
window.__HOOK__ = {}
window.__HOOK__["x/space/acc/info"] = async (resToObj, params, err)=>{
  const mid = params.mid
  console.log('mid: ', mid)
  if(space_account_info_map[mid])
  return resToObj(space_account_info_map[mid])
  else
  return Promise.reject(err)
}


const HTTP = {
  get(url) {
    return new Promise((resolve, reject) => {
      const Http = new XMLHttpRequest()
      Http.open('GET', url)
      Http.send()
      Http.onloadend = e => {
        resolve(e)
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
    h3.style.cssText = h3.dataset.hash === hash ? "color:black!important" : "color:gray!important";
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

  let vue = document.createElement('script');
  vue.src = "https://unpkg.com/vue@next";
  loadStatus.textContent="[1/2]加载vue"
  appSettingDiv.prepend(vue)
  
  let ele = document.createElement('script');
  ele.src = "https://unpkg.com/element-plus";
  vue.onload = ()=>{
    loadStatus.textContent="[2/2]加载element-plus"
    appSettingDiv.prepend(ele)
  }

  document.addEventListener('ROAMING_sendURL', async function (e) {
    // e.detail contains the transferred data (can be anything, ranging
    // from JavaScript objects to strings).
    // Do something, for example:
    console.log(e.detail);
    const roamingHTML = await HTTP.get(e.detail)
    const container = document.createElement('div')
    
    container.innerHTML = roamingHTML.currentTarget.responseText
    areaLimitPage.appendChild(container)

    ele.onload = ()=>{
      loadStatus.textContent = ""
      createRoamingPage()
    }
  });
  document.dispatchEvent(new CustomEvent('ROAMING_getURL', {
    detail: 'RoamingPage' // Some variable from Gmail.
  }));
}

// vue
function createRoamingPage(e){
  console.log('RoamingPage HTML')
  const App = {
    data() {
      return {
        message: "Hello Element Plus",
        uposList: [
          {
            value: 'none',
            label: '不替换'
          },
          {
            value: 'k3s',
            label: 'k3s(金山)'
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
        serverList: {
          default: '',
          mainLand: '',
          hk: '',
          tw: '',
          th: ''
        },
        serverRule: {
          default: [
            {
              validator: this.checkDomain,
              trigger: 'blur',
            },
          ],
          mainLand: [
            {
              validator: this.checkDomain,
            },
          ],
          hk: [
            {
              validator: this.checkDomain,
              trigger: 'blur',
            },
          ],
          tw: [
            {
              validator: this.checkDomain,
              trigger: 'blur',
            },
          ],
          th: [
            {
              validator: this.checkDomain,
              trigger: 'blur',
            },
          ]
        }
      };
    },
    created(){
      console.log('vue created')
      const serverList = JSON.parse(localStorage.serverList || "{}")
      for(let area in serverList){
        this.serverList[area] = serverList[area]
      }
    },
    methods:{
      changeUPOS: function(upos){
        console.log('upos change: ', upos)
        localStorage.upos = upos
      },
      saveServer: function(formEl){
        if (!formEl) return
        console.log('saveServer: ', formEl, this.$refs)
        this.$refs.serverFormRef.validate((valid) => {
          if (valid) {
            console.log(this.serverList)
            this.$notify({
              title: 'Success',
              message: "成功",
              type:'success'
            })
            localStorage.serverList = JSON.stringify(this.serverList)
          } else {
            console.log('error submit!')
            return false
          }
        })
      },
      checkDomain: (rule, value, callback)=>{
        console.log(rule, value)
        if((value || "") === "")
          callback()
        else if(!/^(?=^.{3,255}$)[a-zA-Z0-9][-a-zA-Z0-9]{0,62}(\.[a-zA-Z0-9][-a-zA-Z0-9]{0,62})+$/.test(value)){
          callback(new Error("域名校验失败"))
        }
        callback()
      },
      resetForm: function(formEl) {
        console.log('resetForm: ', formEl)
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
if (url.hash === "#/page/settings") {
  addAreaLimit()
}

