import { createLogger } from "./common/log"
import { getPageType } from "./common/page"
import { PageType } from "./common/types"
import { loginPageInit } from "./page/login"

(() => {
    const log = createLogger('Content')
    const pageType = getPageType()
    log.info('content:', pageType)
    switch(pageType) {
        case PageType.Login:
            loginPageInit()
            break
    }
})()