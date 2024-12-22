
const url = new URL(location.href)
const fileName = url.pathname.substring(0, url.pathname.lastIndexOf('.'))
console.log("[hook]: hook.js", fileName)
const runtiime = chrome.runtime
const URLS = {
  md5: runtiime.getURL(`utils/md5.js`),
  login: runtiime.getURL(`hook/login.js`),
  search: runtiime.getURL(`hook/search.js`),
  player: runtiime.getURL(`hook/player.js`),
  index: runtiime.getURL(`hook/index.js`),
  commonJS: runtiime.getURL(`hook/common.js`),
  commonCSS: runtiime.getURL(`hook/common.css`),
  RoamingPage: runtiime.getURL(`hook/RoamingPage.html`),
  PlayerEnhance: runtiime.getURL(`hook/PlayerEnhance.html`),
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

