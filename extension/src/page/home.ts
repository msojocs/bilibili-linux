import { createRoot } from "react-dom/client"
import SettingButton from "../ui/main"
import { createLogger, Logger } from "../common/log"
import { replaceXMLHttpRequest } from "../document/replace"
import { sleep } from "../common/utils"

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
      buttonArea.prepend(root)
      createRoot(root).render(SettingButton())
      break
    }
  })
}