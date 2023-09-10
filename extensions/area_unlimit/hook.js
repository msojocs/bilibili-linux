
const url = new URL(location.href)
const fileName = url.pathname.substring(1).split('.')[0]
console.log("[hook]: hook.js", fileName)
const ext = chrome.extension
const URLS = {
  md5: chrome.extension.getURL(`utils/md5.js`),
  load: chrome.extension.getURL(`hook/load.js`),
  index: chrome.extension.getURL(`hook/index.js`),
  search: chrome.extension.getURL(`hook/search.js`),
  player: chrome.extension.getURL(`hook/player.js`),
  biliapp: chrome.extension.getURL(`hook/biliapp.js`),
  commonJS: chrome.extension.getURL(`hook/common.js`),
  commonCSS: chrome.extension.getURL(`hook/common.css`),
  RoamingPage: chrome.extension.getURL(`hook/RoamingPage.html`),
  PlayerEnhance: chrome.extension.getURL(`hook/PlayerEnhance.html`),
}

// 首页搜索iframe
window.onload = () => {

  // const appIframe = document.getElementById('bili-app')
  // if (appIframe == null) {
  //   console.warn('应用主界面元素未找到！')
  //   return
  // }
  // const appWindow = appIframe.contentWindow
  // console.log('search:', 'appIframe.onload')
  // let t = setInterval(() => {
  //   console.log('try to find app_search iframe')
  //   const searchIframe = appWindow.document.querySelector(".app_search")?.querySelector('iframe')
  //   if (searchIframe) {
  //     console.log('search:', 'searchIframe')
  //     const win = searchIframe.contentWindow
  //     console.log(win.location.href)
  //     const searchDocument = win.document
  //     var commonJS = searchDocument.createElement('script');
  //     commonJS.src = URLS.commonJS;
  //     if (searchDocument.head || searchDocument.documentElement) {
  //       (searchDocument.head || searchDocument.documentElement).appendChild(commonJS);
  //       commonJS.onload = function () {
  //         commonJS.remove();
  //       };
  //       clearInterval(t)
  //     }
  //   } else {
  //     console.warn('search iframe not found')
  //   }
  // }, 500)

}

// var loadJS = document.createElement('script');
// loadJS.src = URLS.load;
// (document.head || document.documentElement).appendChild(loadJS);
// loadJS.onload = function () {
//   loadJS.remove();
// };
var commonJS = document.createElement('script');
commonJS.src = URLS.commonJS;
(document.head || document.documentElement).appendChild(commonJS);
// commonJS.onload = function () {
//   commonJS.remove();
// };
var md5JS = document.createElement('script');
md5JS.src = URLS.md5;
(document.head || document.documentElement).appendChild(md5JS);
// md5JS.onload = function () {
//   md5JS.remove();
// };

// var s = document.createElement('script');
// s.src = chrome.extension.getURL(`hook/${fileName}.js`);
// (document.head || document.documentElement).appendChild(s);
// s.onload = function () {
//   s.remove();
// };

// var css = document.createElement('link');
// css.rel = "stylesheet"
// css.href = URLS.commonCSS;
// (document.head || document.documentElement).appendChild(css);

// Event listener
document.addEventListener('ROAMING_getURL', function (e) {
  // e.detail contains the transferred data (can be anything, ranging
  // from JavaScript objects to strings).
  // Do something, for example:
  console.log('hook ROAMING_getURL:', e.detail);
  let data = null
  switch (e.detail) {
    case 'URLS':
      data = URLS
      break;
    default:
      data = URLS[e.detail];
      break
  }
  document.dispatchEvent(new CustomEvent('ROAMING_sendURL', {
    detail: data // Some variable from Gmail.
  }));
});

