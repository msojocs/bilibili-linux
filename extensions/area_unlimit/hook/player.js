const pacLink = localStorage.pacLink || ""
let result = ""
if(pacLink.length > 0)
  result = biliBridgePc.callNativeSync('config/roamingPAC', pacLink);
if(result === 'error')localStorage.pacLink = ""
