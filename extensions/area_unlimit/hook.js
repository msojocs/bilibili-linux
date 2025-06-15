
// extension context
const url = new URL(location.href)
const fileName = url.pathname.substring(0, url.pathname.lastIndexOf('.'))
console.log("[hook]: hook.js", fileName)
const runtime = chrome.runtime
const URLS = {
  md5: runtime.getURL(`utils/md5.js`),
  login: runtime.getURL(`hook/login.js`),
  search: runtime.getURL(`hook/search.js`),
  player: runtime.getURL(`hook/player.js`),
  index: runtime.getURL(`hook/index.js`),
  translation: runtime.getURL(`hook/translation.js`),
  commonJS: runtime.getURL(`hook/common.js`),
  commonCSS: runtime.getURL(`hook/common.css`),
  RoamingPage: runtime.getURL(`hook/RoamingPage.html`),
  PlayerEnhance: runtime.getURL(`hook/PlayerEnhance.html`),
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

const storage = chrome.storage.local
document.addEventListener('ROAMING_request', async function (e) {
  // e.detail contains the transferred data (can be anything, ranging
  // from JavaScript objects to strings).
  // Do something, for example:
  console.log('hook ROAMING_request:', e.detail);
  const request = e.detail
  let data = null
  switch (e.detail.action) {
    case 'getStorage':
      data = await storage.get(e.detail.data.key);
      data = data[e.detail.data.key] || null;
      break;
    case 'setStorage':
      data = await storage.set({[e.detail.data.key]: e.detail.data.value});
      break;
  }
  console.log('hook ROAMING_response:', data)
  document.dispatchEvent(new CustomEvent('ROAMING_response', {
    detail: {
      id: request.id,
      data: data // Some variable from Gmail.
    } // Some variable from Gmail.
  }));
});
