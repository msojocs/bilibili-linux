#!/bin/bash

root_dir=$(cd `dirname $0`/.. && pwd -P)

set -e

notice() {
    echo -e "\033[36m $1 \033[0m "
}

mkdir -p "$root_dir/app"

notice "复制拓展"
rm -rf "$root_dir/app/extensions"
cp -r "$root_dir/extensions" "$root_dir/app"

cd "$root_dir/app"

tmp_dir="app"
asar e "app.asar" "$tmp_dir"

notice "扩展注入"
cat "$root_dir/res/scripts/injectExt.js" > "$tmp_dir/main/temp.js"
cat "$tmp_dir/main/index.js" >> "$tmp_dir/main/temp.js"
sed -i 's#\[pa(0x363)]=P,this#[pa(0x363)]=P,injectExtensions(P),this#' "$tmp_dir/main/temp.js" # PlayerWindow
sed -i 's#\[oY(0x717)]=M,this#[oY(0x717)]=M,injectExtensions(M),this#' "$tmp_dir/main/temp.js" # MainWindow
rm -f "$tmp_dir/main/index.js"
mv "$tmp_dir/main/temp.js" "$tmp_dir/main/index.js"

notice "添加PAC设置channel"
sed -i "s#'window/isLiveRoomWindowVisible']#'window/isLiveRoomWindowVisible','config/roamingPAC']#" "$tmp_dir/main/assets/bili-bridge.js"

# notice "更新MD5"
# md5=$(md5sum app/main/index.js|cut -d ' ' -f1)
# echo ${md5[0]} > app/.appkey
asar p $tmp_dir app.asar
rm -rf $tmp_dir
