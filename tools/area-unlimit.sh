#!/bin/bash

root_dir=$(cd `dirname $0`/.. && pwd -P)

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

notice "扩展注入"
cat "$root_dir/res/scripts/injectExt.js" > "$tmp_dir/main/temp.js"
cat "$tmp_dir/main/index.js" >> "$tmp_dir/main/temp.js"
sed -i 's#\[jq(0x89b)]=P,this#[jq(0x89b)]=P,injectExtensions(P),this#' "$tmp_dir/main/temp.js"
rm -f "$tmp_dir/main/index.js"
mv "$tmp_dir/main/temp.js" "$tmp_dir/main/index.js"

asar p $tmp_dir app.asar
rm -rf $tmp_dir
