console.log("=====HOOK=====")
const url = new URL(location.href)
const fileName = url.pathname.substring(1).split('.')[0]

var s = document.createElement('script');
s.src = chrome.extension.getURL(`hook/${fileName}.js`);
(document.head || document.documentElement).appendChild(s);
s.onload = function () {
  s.remove();
};

var css = document.createElement('link');
css.rel = "stylesheet"
css.href = chrome.extension.getURL(`hook/common.css`);
(document.head || document.documentElement).appendChild(css);
css.onload = function () {
  css.remove();
};
console.log("=====", css)
