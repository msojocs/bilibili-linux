import { PageType } from "./types"
export const getPageType = () => {
    const url = new URL(location.href)
    const fileName = url.pathname.substring(url.pathname.lastIndexOf('/') + 1, url.pathname.lastIndexOf('.'))
    if (fileName === 'login')
        return PageType.Login
}