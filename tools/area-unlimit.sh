#!/bin/bash

root_dir=$(cd `dirname $0`/.. && pwd -P)

set -e
trap 'catchError $LINENO "$BASH_COMMAND"' ERR # 捕获错误情况
catchError() {
    exit_code=$?
    if [ $exit_code -ne 0 ]; then
        fail "\033[31mcommand: $2\n  at $0:$1\n  at $STEP\033[0m"
    fi
    exit $exit_code
}

notice() {
    echo -e "\033[36m $1 \033[0m "
}
fail() {
    echo -e "\033[41;37m 失败 \033[0m $1"
}

res_dir="$root_dir/tmp/bili/resources"
mkdir -p "$root_dir/app"

notice "构建拓展"
rm -rf "$root_dir/app/extensions"
cd "$root_dir/extension"
pnpm install
pnpm run build
notice "复制拓展"
mkdir -p "$root_dir/app/extensions"
cp -r "$root_dir/extension/dist" "$root_dir/app/extensions/bilibili"

cd "$res_dir"

asar e "app.asar" app

# notice "暴露弹幕管理接口"
# grep -lr "this.initDanmaku(),this" --exclude="app.asar" .
# sed -i 's#this.initDanmaku(),this#this.initDanmaku(),window.danmakuManage = this,this#' "app/render/assets/lib/core.js"


asar p app app.asar
rm -rf app
