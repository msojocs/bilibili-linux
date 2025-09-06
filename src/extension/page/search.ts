import { createRoot } from "react-dom/client"
import { createLogger, Logger } from "../../common/log"
import { sleep } from "../../common/utils"
import { replaceFetch, replaceXMLHttpRequest } from "../document/replace"
import SettingButton from "../ui/main"

export const initSearchPage = () => {
  Logger.moduleName = 'Search'
  const log = createLogger('Entry')
  log.info('replace XMLHttpRequest...')
  replaceXMLHttpRequest()
  log.info('replace fetch...')
  replaceFetch()

  window.addEventListener('load', async () => {
    while(true) {
      const buttonArea = document.querySelector("#app > div > div.search_layout.i_page_wrapper > div.fixed_buttons > div > div")
      if (!buttonArea) {
        log.error('area not found!')
        await sleep(1000)
        continue
      }
      const root = document.createElement('div')
      buttonArea.prepend(root)
      createRoot(root).render(SettingButton())
      break
    }
  })
}