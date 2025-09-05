#!/bin/bash
root_dir=$(cd `dirname $0`/.. && pwd -P)

set -ex
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
cd "$res_dir"
asar e app.asar app

notice "解密"
"$root_dir/tools/app-decrypt.js" "$res_dir/app/main/.biliapp" "$res_dir/app/main/app.orgi.js"
"$root_dir/tools/js-decode.js" "$res_dir/app/main/app.orgi.js" "$res_dir/app/main/app.js"
"$root_dir/tools/bridge-decode.js" "$res_dir/app/main/assets/bili-bridge.js" "$res_dir/app/main/assets/bili-bridge.js"

notice "====app.js===="

notice "屏蔽检测"
# grep -lr 'if (!dj' --exclude="app.asar" .
# sed -i 's#if (!dj#if(false\&\&!dj#g' "app/main/app.js"
# ==='win';if(! 警告11
grep -lr 'if (!jp)' --exclude="app.asar" .
sed -i 's#if (!jp)#if(false\&\&!jp)#' "app/main/app.js"
# global['bootstrapApp']();
# grep -lr 'if (dj)' --exclude="app.asar" .
# sed -i 's#if (dj)#if(!dj)#' "app/main/app.js"
#grep -lr '};!fb' --exclude="app.asar" .
#sed -i 's#};!fb#};false\&\&!fb#' "app/main/app.js"

# notice "路由"
# cat "$root_dir/res/scripts/inject-biliapp.js" >> app/render/assets/biliapp.*.js

notice "检查更新"
# 检查更新
grep -lr "// noinspection SuspiciousTypeOfGuard" --exclude="app.asar" .
sed -i 's#// noinspection SuspiciousTypeOfGuard#runtimeOptions.platform="win32";// noinspection SuspiciousTypeOfGuard#' app/node_modules/electron-updater/out/providerFactory.js
sed -i 's#process.resourcesPath#path.dirname(this.app.getAppPath())#' app/node_modules/electron-updater/out/ElectronAppAdapter.js

notice "====Bili Bridge===="
notice "inject"
# inject
cat "$root_dir/res/scripts/inject-bridge.js" > "app/main/assets/temp.js"
cat "app/main/assets/bili-inject.js" >> "app/main/assets/temp.js"
rm "app/main/assets/bili-inject.js"
mv "app/main/assets/temp.js" "app/main/assets/bili-inject.js"
# core
cat "$root_dir/res/scripts/inject-core.js" > "app/render/assets/lib/temp.js"
cat "app/render/assets/lib/core.js" >> "app/render/assets/lib/temp.js"
rm "app/render/assets/lib/core.js"
mv "app/render/assets/lib/temp.js" "app/render/assets/lib/core.js"
# preload
cat "$root_dir/res/scripts/inject-bridge.js" > "app/main/assets/temp.js"
cat "app/main/assets/bili-preload.js" >> "app/main/assets/temp.js"
rm "app/main/assets/bili-preload.js"
mv "app/main/assets/temp.js" "app/main/assets/bili-preload.js"

asar p app app.asar
rm -rf app

notice "Download cursor-tool"
wget -c https://github.com/msojocs/bilibili-linux/releases/download/tools/cursor-tool -Ocursor-tool
chmod +x cursor-tool