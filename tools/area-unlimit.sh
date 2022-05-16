#!/bin/bash

SOURCE="${BASH_SOURCE[0]}"
while [ -h "$SOURCE" ]; do # resolve $SOURCE until the file is no longer a symlink
  DIR="$( cd -P "$( dirname "$SOURCE" )" >/dev/null 2>&1 && pwd )"
  SOURCE="$(readlink "$SOURCE")"
  [[ $SOURCE != /* ]] && SOURCE="$DIR/$SOURCE" # if $SOURCE was a relative symlink, we need to resolve it relative to the path where the symlink file was located
done
root_dir="$( cd -P "$( dirname "$SOURCE" )"/.. >/dev/null 2>&1 && pwd )"

set -e

notice() {
    echo -e "\033[36m $1 \033[0m "
}

mkdir -p "$root_dir/app"

notice "复制拓展"
cp -r "$root_dir/extensions" "$root_dir/app"

cd "$root_dir/app"

tmp_dir="app"
asar e "app.asar" "$tmp_dir"

notice "area_limit 强制设为 0"
sed -i 's#HA(n.result)).#(n.result.area_limit=0,HA(n.result))).#' $tmp_dir/render/assets/vd_menu.*.js

notice "扩展注入"
cat "$root_dir/res/scripts/injectExt.js" > "$tmp_dir/main/temp.js"
cat "$tmp_dir/main/index.js" >> "$tmp_dir/main/temp.js"
sed -i 's#\[jq(0x89b)]=P,this#[jq(0x89b)]=P,injectExtensions(P),this#' "$tmp_dir/main/temp.js"
rm -f "$tmp_dir/main/index.js"
mv "$tmp_dir/main/temp.js" "$tmp_dir/main/index.js"

notice "拦截season请求"
sed -i 's#NA(t.result):null);func#NA(t.result):null).catch(err=>{if(window.__HOOK__["pgc/view/pc/season"]){const doIt=window.__HOOK__["pgc/view/pc/season"]({error:err,config:Xe,resultHandle:NA,request:Pe,params:e});return doIt}return Promise.reject(err)});func#' $tmp_dir/render/assets/vd_menu.*.js

notice "播放链接"
sed -i 's#then((function(t){var e=performance\.now(#then(((t)=>{var e=performance.now(#' $tmp_dir/render/assets/lib/core.js
sed -i 's#var e=performance.now()-r,o=i.parse(t.data,i.config,n);return #var e=performance.now()-r,o=i.parse(t.data,i.config,n);if(t.data.message==="抱歉您所在地区不可观看！"){const API="api.qiu.moe";this.fragmentUrl=`\${API}/pgc/player/web/playurl`;this.params.access_key=window.access_key||"";this.params.area=window.area||"hk";return i.track.o(j.b.API_PlayUrl_Fail_Time,{val:e.toFixed()}),(t||"http:"===location.protocol)?(i.retried++,i.log.i(i.tag,"Retry: "+i.retried+"/"+i.config.retryCount),t?i.getRemoteResponse(--t,e):i.getRemoteResponse(0,!0)):Promise.reject({code:0,message:o.response\&\&o.response.status\&\&o.response.status.toString()||"",url:n})}return #' $tmp_dir/render/assets/lib/core.js

notice "拦截用户信息请求"
sed -i 's#acc/info",{params:e}).then(resToObj)}#acc/info",{params:e}).then(resToObj).catch(err=>{if(window.__HOOK__["x/space/acc/info"]){return window.__HOOK__["x/space/acc/info"](resToObj,e,err)}return Promise.reject(err)})}#' $tmp_dir/render/assets/index.*.js

asar p $tmp_dir app.asar
rm -rf $tmp_dir
