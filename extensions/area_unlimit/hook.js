console.log("=====HOOK=====")
const url = new URL(location.href)
const fileName = url.pathname.substring(1).split('.')[0]

var s = document.createElement('script');
s.src = chrome.extension.getURL(`hook/${fileName}.js`);
(document.head || document.documentElement).appendChild(s);
s.onload = function () {
  s.remove();
};

var commonJS = document.createElement('script');
commonJS.src = chrome.extension.getURL(`hook/common.js`);
(document.head || document.documentElement).appendChild(commonJS);
commonJS.onload = function () {
  commonJS.remove();
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
  const roamingPageURL = chrome.extension.getURL(`hook/RoamingPage.html`);
  document.dispatchEvent(new CustomEvent('ROAMING_sendURL', {
    detail: roamingPageURL // Some variable from Gmail.
  }));
});