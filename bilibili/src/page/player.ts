import { createRoot } from "react-dom/client"
import { createLogger, Logger } from "../common/log"
import { sleep } from "../common/utils"
import { replaceFetch, replaceXMLHttpRequest } from "../document/replace"
import SettingButton from "../setting/main"
import { getPageType } from "../common/page"
import { Page } from "../common/types"

export const initPlayerPage = () => {
  Logger.moduleName = 'Player'
  const log = createLogger('Entry')
  log.info('replace XMLHttpRequest...')
  replaceXMLHttpRequest()
  log.info('replace fetch...')
  replaceFetch()
  window.addEventListener('load', async () => {
    let headerLeft: Element | null = null

    for (let i = 0; ; i++) {
      headerLeft = document.querySelector("#app > div > div.app_player--header.flex_between.draggable.db_click_max > div.app_player--header-left")
      if (headerLeft !== null) break
      log.info('头部元素未找到！', i)
      await sleep(1000)
      if (i > 20) {
        return
      }
    }

    const root = document.createElement('div')
    const type = getPageType()
    if (type === Page.Home)
      headerLeft.prepend(root)
    else
      headerLeft.append(root)
    createRoot(root).render(SettingButton())

  })
}