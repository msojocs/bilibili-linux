console.log("=====HOOK=====")
const url = new URL(location.href)
const fileName = url.pathname.substring(1).split('.')[0]

var s = document.createElement('script');
s.src = chrome.extension.getURL(`hook/${fileName}.js`);
(document.head || document.documentElement).appendChild(s);
s.onload = function () {
  s.remove();
};

// 首页搜索iframe
window.onload = ()=>{
  const searchIframe = document.querySelector("#app > div > div > div.app_layout--content.flex_col > div > div.app_search.i_page_wrapper.app_container--search.p_cover > div > iframe")
  if(searchIframe){
    const searchDocument = searchIframe.contentWindow.document
    var commonJS = document.createElement('script');
    commonJS.src = chrome.extension.getURL(`hook/common.js`);
    (searchDocument.head || searchDocument.documentElement).appendChild(commonJS);
    commonJS.onload = function () {
      commonJS.remove();
    };
  }
}

var commonJS = document.createElement('script');
commonJS.src = chrome.extension.getURL(`hook/common.js`);
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
css.href = chrome.extension.getURL(`hook/common.css`);
(document.head || document.documentElement).appendChild(css);

// Event listener
document.addEventListener('ROAMING_getURL', function (e) {
  // e.detail contains the transferred data (can be anything, ranging
  // from JavaScript objects to strings).
  // Do something, for example:
  console.log(e.detail);
  const roamingPageURL = chrome.extension.getURL(`hook/${e.detail}.html`);
  document.dispatchEvent(new CustomEvent('ROAMING_sendURL', {
    detail: roamingPageURL // Some variable from Gmail.
  }));
});

