import { createRoot } from "react-dom/client"
import SettingButton from "../setting/main"
import { createLogger, Logger } from "../common/log"

export const initHomePage = () => {
  Logger.moduleName = 'Home'
  const log = createLogger('Entry')
  window.addEventListener('load', () => {
    const buttonArea = document.querySelector("#app > div > div.app_layout.ov_hidden.flex_start.bg_bg1.gpu-enabled > div.app_layout--content.flex_col > div > div.fixed_buttons > div > div")
    if (!buttonArea) {
      log.error('area not found!')
      return
    }
    const root = document.createElement('div')
    buttonArea.prepend(root)
    createRoot(root).render(SettingButton())
  })
}