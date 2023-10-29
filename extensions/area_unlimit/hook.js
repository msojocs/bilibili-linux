
const url = new URL(location.href)
const fileName = url.pathname.substring(1).split('.')[0]
console.log("[hook]: hook.js", fileName)
const ext = chrome.extension
const URLS = {
  md5: chrome.extension.getURL(`utils/md5.js`),
  index: chrome.extension.getURL(`hook/index.js`),
  login: chrome.extension.getURL(`hook/login.js`),
  search: chrome.extension.getURL(`hook/search.js`),
  player: chrome.extension.getURL(`hook/player.js`),
  biliapp: chrome.extension.getURL(`hook/biliapp.js`),
  commonJS: chrome.extension.getURL(`hook/common.js`),
  commonCSS: chrome.extension.getURL(`hook/common.css`),
  RoamingPage: chrome.extension.getURL(`hook/RoamingPage.html`),
  PlayerEnhance: chrome.extension.getURL(`hook/PlayerEnhance.html`),
}

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

