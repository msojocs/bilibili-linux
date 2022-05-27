#!/bin/bash

root_dir=$(cd `dirname $0`/.. && pwd -P)

set -e

notice() {
    echo -e "\033[36m $1 \033[0m "
}

res_dir="$root_dir/tmp/bili/resources"
mkdir -p "$root_dir/app"

notice "复制拓展"
rm -rf "$root_dir/app/extensions"
cp -r "$root_dir/extensions" "$root_dir/app"

cd "$res_dir"

asar e "app.asar" app

notice "扩展注入"
cat "$root_dir/res/scripts/injectExt.js" > "app/main/temp.js"
cat "app/main/app.js" >> "app/main/temp.js"
sed -i "s#(0x1852,'MAQ&')]=v,this#(0x1852,'MAQ\&')]=v,injectExtensions(v),this#" "app/main/temp.js" # MainWindow
sed -i "s#playerWindow']=j,this#playerWindow']=j,injectExtensions(j),this#" "app/main/temp.js" # PlayerWindow
rm -f "app/main/app.js"
mv "app/main/temp.js" "app/main/app.js"

notice "添加PAC设置channel"
sed -i "s#'window/isFocused',a2#'window/isFocused','config/roamingPAC',a2#" "app/main/assets/bili-bridge.js"

# 暴露弹幕管理接口
sed -i 's#this.initDanmaku(),this#this.initDanmaku(),window.danmakuManage = this,this#' "app/render/assets/lib/core.js"

# notice "更新MD5"
# md5=$(md5sum app/main/index.js|cut -d ' ' -f1)
# echo ${md5[0]} > app/.appkey
asar p app app.asar
rm -rf app
