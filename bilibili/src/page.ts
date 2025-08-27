import { createLogger, Logger } from "./common/log"
import { getPageType } from "./common/page"
import { Page } from "./common/types"
import { registerMessagePage } from "./document/communication"
import { initHomePage } from "./page/home"
import { initLoginPage } from "./page/login"
import { initPlayerPage } from "./page/player"
import { initSearchPage } from "./page/search"

(() => {
  Logger.moduleName = 'Page'
  const log = createLogger('Entry')
  const pt = getPageType()
  log.info('page:', pt)
  registerMessagePage()
  switch(pt) {
    case Page.Login:
      initLoginPage()
      break
    case Page.Home:
      initHomePage()
      break
    case Page.Search:
      initSearchPage()
      break
    case Page.Player:
      initPlayerPage()
      break
  }
})()