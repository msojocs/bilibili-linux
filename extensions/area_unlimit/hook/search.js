try {
  window.hex_md5 = parent?.hex_md5
  window.getHookXMLHttpRequest = parent?.getHookXMLHttpRequest
  if (window.getHookXMLHttpRequest && undefined === window.XMLHttpRequest.isHooked) {
    window.XMLHttpRequest = window.getHookXMLHttpRequest(window)
  }
  // debugger
}
catch (e) {

}