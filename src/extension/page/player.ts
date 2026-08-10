import { createRoot, type Root } from "react-dom/client"
import { createLogger, Logger } from "../../common/log"
import { sleep } from "../../common/utils"
import { replaceFetch, replaceXMLHttpRequest } from "../document/replace"
import SettingEntry from "../ui/main"
import { getPageType } from "../common/page"
import { Page } from "../common/types"
import { registerSponsorBlock } from "../document/sponsor-block"
import SvpControl from "../ui/player/SvpControl"
import store from "../ui/store"
import { Provider } from "react-redux"
import { createElement as reactCreateElement } from "react"
import { installSvpCodecProbe } from "../common/svp"

let svpControlElement: HTMLElement | undefined
let svpControlRoot: Root | undefined

export const initPlayerPage = () => {
  Logger.moduleName = 'Player'
  const log = createLogger('Entry')
  installSvpCodecProbe()
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
    createRoot(root).render(SettingEntry())

    for (let i=0;;i++){
      const danmakuManage = window.danmakuManage
      if (!danmakuManage){
        await sleep(1000)
        continue
      }
      log.info('找到弹幕管理器', danmakuManage)
      
      registerSponsorBlock()
      const unmountSvpControl = () => {
        svpControlRoot?.unmount()
        svpControlRoot = undefined
        svpControlElement?.remove()
        svpControlElement = undefined
      }
      const mountSvpControl = () => {
        try {
          const controlBars = Array.from(document.querySelectorAll<HTMLElement>('.bpx-player-control-bottom-right'))
          const fallbackBar = danmakuManage.nodes.controlBottomRight as HTMLElement | undefined
          if (fallbackBar && !controlBars.includes(fallbackBar)) controlBars.push(fallbackBar)
          const visibleBars = controlBars.filter(controlBar => {
            const rect = controlBar.getBoundingClientRect()
            const style = getComputedStyle(controlBar)
            return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden'
          })
          const fullscreenScope = document.fullscreenElement
            || document.querySelector('.bpx-state-fullscreen, .bpx-player-container[data-screen="full"]')
          const visibleBar = visibleBars.find(controlBar => fullscreenScope?.contains(controlBar)) || visibleBars[0]
          const quality = visibleBar?.querySelector('.bpx-player-ctrl-quality')
          if (!quality) return false
          if (!svpControlElement) {
            svpControlElement = document.createElement('div')
            svpControlElement.className = 'bpx-player-ctrl-btn bili-svp-root'
            quality.before(svpControlElement)
            svpControlRoot = createRoot(svpControlElement)
            svpControlRoot.render(reactCreateElement(Provider, { store, children: reactCreateElement(SvpControl) }))
          } else if (svpControlElement.parentElement !== visibleBar || svpControlElement.nextElementSibling !== quality) {
            quality.before(svpControlElement)
          }
          return true
        } catch (error) {
          log.error('挂载补帧控件失败', error)
          return false
        }
      }
      mountSvpControl()
      const controlObserver = new MutationObserver(() => {
        mountSvpControl()
      })
      controlObserver.observe(document.body, { childList: true, subtree: true })
      const controlPoller = window.setInterval(mountSvpControl, 1000)
      window.addEventListener('beforeunload', () => {
        controlObserver.disconnect()
        window.clearInterval(controlPoller)
        unmountSvpControl()
      }, { once: true })
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
