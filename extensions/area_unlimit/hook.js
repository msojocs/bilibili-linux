console.log("=====HOOK=====")
const url = new URL(location.href)
const fileName = url.pathname.substring(1).split('.')[0]

const URLS = {
  commonJS: chrome.extension.getURL(`hook/common.js`),
  commonCSS: chrome.extension.getURL(`hook/common.css`),
  RoamingPage: chrome.extension.getURL(`hook/RoamingPage.html`),
  PlayerEnhance: chrome.extension.getURL(`hook/PlayerEnhance.html`),
}
const commonJSURL = chrome.extension.getURL(`hook/common.js`);
var s = document.createElement('script');
s.src = chrome.extension.getURL(`hook/${fileName}.js`);
(document.head || document.documentElement).appendChild(s);
s.onload = function () {
  s.remove();
};

// 首页搜索iframe
window.onload = () => {
  console.log('search:', 'hook prepare')
  const appIframe = document.getElementById('bili-app')
  if (appIframe == null) {
    console.warn('搜索框元素未找到！')
    return
  }
  const appWindow = appIframe.contentWindow
  console.log('search:', 'appIframe.onload')
  let t = setInterval(() => {

    const searchIframe = appWindow.document.querySelector(".app_search").querySelector('iframe')
    if (searchIframe) {
      console.log('search:', 'searchIframe')
      const win = searchIframe.contentWindow
      console.log(win.location.href)
      const searchDocument = win.document
      var commonJS = searchDocument.createElement('script');
      commonJS.src = URLS.commonJS;
      if (searchDocument.head || searchDocument.documentElement) {
        (searchDocument.head || searchDocument.documentElement).appendChild(commonJS);
        commonJS.onload = function () {
          commonJS.remove();
        };
        clearInterval(t)
      }
    } else {
      console.warn('search iframe not found')
    }
  }, 500)

}

var commonJS = document.createElement('script');
commonJS.src = commonJSURL;
(document.head || document.documentElement).appendChild(commonJS);
commonJS.onload = function () {
  commonJS.remove();
};
var md5JS = document.createElement('script');
md5JS.src = chrome.extension.getURL(`utils/md5.js`);
(document.head || document.documentElement).appendChild(md5JS);
md5JS.onload = function () {
  md5JS.remove();
};

var css = document.createElement('link');
css.rel = "stylesheet"
css.href = chrome.extension.getURL(`/hook/common.css`);
(document.head || document.documentElement).appendChild(css);

// Event listener
document.addEventListener('ROAMING_getURL', function (e) {
  // e.detail contains the transferred data (can be anything, ranging
  // from JavaScript objects to strings).
  // Do something, for example:
  console.log('hook ROAMING_getURL:', e.detail);
  const roamingPageURL = URLS[e.detail];
  document.dispatchEvent(new CustomEvent('ROAMING_sendURL', {
    detail: roamingPageURL // Some variable from Gmail.
  }));
});

