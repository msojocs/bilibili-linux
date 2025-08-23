import { getPageType } from "./common/page"
import { PageType } from "./common/types"
import { loginPageInit } from "./page/login"

(() => {
    console.info('content')
    const pageType = getPageType()
    switch(pageType) {
        case PageType.Login:
            loginPageInit()
            break
    }
})()