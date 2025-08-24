import { Page, type PageType } from "./types"
export const getPageType = (): PageType => {
    const url = new URL(location.href)
    const fileName = url.pathname.substring(url.pathname.lastIndexOf('/') + 1, url.pathname.lastIndexOf('.'))
    if (fileName === 'login')
        return Page.Login
    if (fileName === 'index')
        return Page.Home
    return Page.Unknown
}

export const loadJS = (src: string) => {
    const loadJS = document.createElement('script');
    loadJS.src = src;
    (document.head || document.documentElement).appendChild(loadJS);
}