import { createRoot } from "react-dom/client"
import SettingEntry from "../ui/main"
import { createLogger, Logger } from "../../common/log"
import { replaceXMLHttpRequest } from "../document/replace"
import { sleep } from "../../common/utils"

type HistoryStateMethod = 'pushState' | 'replaceState'
type HistoryStateArgs = Parameters<History['pushState']>
{
  const wrapHistory = (type: HistoryStateMethod) => {
    const orig = history[type]

    return function(this: History, ...args: HistoryStateArgs) {
      const rv = orig.apply(this, args)
      window.dispatchEvent(new CustomEvent<HistoryStateArgs>(type, { detail: args }))
      return rv
    }
  }

  history.pushState = wrapHistory('pushState')
  history.replaceState = wrapHistory('replaceState')
}

export const initHomePage = () => {
  Logger.moduleName = 'Home'
  const log = createLogger('Entry')
  log.info('replace XMLHttpRequest...')
  replaceXMLHttpRequest()
  window.addEventListener('load', async () => {
    while(true) {
      const buttonArea = document.querySelector("#app > div > div.app_layout.ov_hidden.flex_start.bg_bg1.gpu-enabled > div.app_layout--content.flex_col > div > div.fixed_buttons > div > div")
      if (!buttonArea) {
        log.error('area not found!')
        await sleep(1000)
        continue
      }
      const root = document.createElement('div')
      root.classList.add('custom-setting')
      buttonArea.prepend(root)
      createRoot(root).render(SettingEntry())
      if (window.location.href.endsWith('/selected')) {
        root.style.display = 'none'
      }
      window.addEventListener('replaceState', (e: Event) => {
        const args = (e as CustomEvent<HistoryStateArgs>).detail
        const target = args?.[0]?.forward
        if (typeof target === 'string' && target?.endsWith('/selected')) {
          root.style.display = 'none'
        } else {
          root.style.display = 'block'
        }
      })
      break
    }

  })
}
