import { Page, type PageType } from "./types"
export const getPageType = (): PageType => {
    const url = new URL(location.href)
    const fileName = url.pathname.substring(url.pathname.lastIndexOf('/') + 1, url.pathname.lastIndexOf('.'))
    if (fileName === 'login')
        return Page.Login
    if (fileName === 'index')
        return Page.Home
    if (fileName === 'search')
        return Page.Search
    if (fileName === 'player')
        return Page.Player
    return Page.Unknown
}

export const loadJS = (src: string) => {
    const loadJS = document.createElement('script');
    loadJS.src = src;
    (document.head || document.documentElement).appendChild(loadJS);
}

export const loadCSS = (src: string) => {
    const loadCSS = document.createElement('link');
    loadCSS.rel = 'stylesheet';
    loadCSS.href = src;
    (document.head || document.documentElement).appendChild(loadCSS);
}