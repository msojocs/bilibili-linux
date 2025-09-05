import { createRoot } from "react-dom/client"
import { createLogger, Logger } from "../../common/log"
import { sleep } from "../../common/utils"
import { replaceFetch, replaceXMLHttpRequest } from "../document/replace"
import SettingButton from "../ui/main"
import { getPageType } from "../common/page"
import { Page } from "../common/types"
import { registerSponsorBlock } from "../document/sponsor-block"

export const initPlayerPage = () => {
  Logger.moduleName = 'Player'
  const log = createLogger('Entry')
  log.info('replace XMLHttpRequest...')
  replaceXMLHttpRequest()
  log.info('replace fetch...')
  replaceFetch()
  window.epId2seasonId = {}
  window.addEventListener('load', async () => {
    let headerLeft: Element | null = null

    for (let i = 0; ; i++) {
      headerLeft = document.querySelector("#app > div > div.app_player--header.flex_between.draggable.db_click_max > div.app_player--header-left")
      if (headerLeft === null) {
        log.error('头部元素未找到！', i)
        await sleep(1000)
        continue
      }
      break
    }

    const root = document.createElement('div')
    const type = getPageType()
    if (type === Page.Home)
      headerLeft.prepend(root)
    else
      headerLeft.append(root)
    createRoot(root).render(SettingButton())

    for (let i=0;;i++){
      const danmakuManage = window.danmakuManage
      if (!danmakuManage){
        await sleep(1000)
        continue
      }
      log.info('找到弹幕管理器', danmakuManage)
      
      registerSponsorBlock()
      {
        const createElement = (apeedRate: number) => {
          const rate = document.createElement('li')
          rate.className = "bpx-player-ctrl-playbackrate-menu-item"
          rate.dataset.value = `${apeedRate}`
          rate.textContent = `${apeedRate}x`
          return rate
        }
        const speedRate = danmakuManage.nodes.controlBottomRight.querySelector('.bpx-player-ctrl-playbackrate-menu > li:nth-child(1)')
        
        speedRate!.after(createElement(1.75))
        speedRate!.before(createElement(4.0))
        speedRate!.before(createElement(3.5))
        speedRate!.before(createElement(3.0))
        speedRate!.before(createElement(2.5))
      }
      {
        let originalFilter = danmakuManage.danmaku.config.fn.filter
        const customFilter = (t: {colorful: boolean, colorfulImg: string, weight: number}) => {
          log.info('filter....')
          if (originalFilter(t)){
            // log.info('default block:', t.weight)
            return true
          }
          if (localStorage.getItem('dm-filter-blockvip') === 'true')
          {
            // 屏蔽大会员彩色
            if (t.colorful || t.colorfulImg) {
              log.info('block vip', JSON.stringify(t, null, 4))
              return true
            }
            
          }
          const weight = parseInt(localStorage.getItem('dm-filter-weight') || '0')
          if (t.weight <= weight) {
            log.info('current weight:', weight)
            log.info('block weight:', JSON.stringify(t, null, 4))
            return true
          }
          return false
        }
        danmakuManage.danmaku.config.fn.filter = customFilter
        {
          const originalInitDanmaku = danmakuManage.initDanmaku
          danmakuManage.initDanmaku = function () {
            log.info('initDanmaku...')
            originalInitDanmaku.apply(this)
            log.info('update filter...')
            originalFilter = this.danmaku.config.fn.filter
            danmakuManage.danmaku.config.fn.filter = customFilter
          }
        }
      }
      break
    }
  })
}