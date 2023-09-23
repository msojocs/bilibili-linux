try {
  console.log('[hook]: search.js', window.XMLHttpRequest)
  window.hex_md5 = parent?.hex_md5
  if (parent?.getHookXMLHttpRequest)
    window.getHookXMLHttpRequest = parent?.getHookXMLHttpRequest
  if (window.getHookXMLHttpRequest && undefined === window.XMLHttpRequest.isHooked) {
    console.log('[hook]: search replace XMLHttpRequest')
    window.XMLHttpRequest = window.getHookXMLHttpRequest(window)
  }
  // debugger
}
catch (e) {

}