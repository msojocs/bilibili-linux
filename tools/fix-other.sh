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

notice "====index.js===="
# 修复新版不能启动的问题
notice "修复不能启动的问题 index.js -- $root_dir"
cat "$root_dir/res/scripts/injectIndex.js" > "app/index.js"
# 从app.js加载 ok
# grep -lr '!import_electron2' --exclude="app.asar" .
# sed -i 's#!import_electron2#import_electron2#' app/main/index.js
# grep -lr 'global;import_electron2' --exclude="app.asar" .
# sed -i 's#global;import_electron2#global;!import_electron2#' app/main/index.js
notice "====app.js===="

notice "屏蔽检测"
# grep -lr 'if (!dj' --exclude="app.asar" .
# sed -i 's#if (!dj#if(false\&\&!dj#g' "app/main/app.js"
# ==='win';if(! 警告11
grep -lr 'if (!iT)' --exclude="app.asar" .
sed -i 's#if (!iT)#if(false\&\&!iT)#' "app/main/app.js"
# global['bootstrapApp']();
# grep -lr 'if (dj)' --exclude="app.asar" .
# sed -i 's#if (dj)#if(!dj)#' "app/main/app.js"
#grep -lr '};!fb' --exclude="app.asar" .
#sed -i 's#};!fb#};false\&\&!fb#' "app/main/app.js"

notice "路由"
cat "$root_dir/res/scripts/inject-biliapp.js" >> app/render/assets/biliapp.*.js

notice "检查更新"
# 检查更新
grep -lr "// noinspection SuspiciousTypeOfGuard" --exclude="app.asar" .
sed -i 's#// noinspection SuspiciousTypeOfGuard#runtimeOptions.platform="win32";// noinspection SuspiciousTypeOfGuard#' app/node_modules/electron-updater/out/providerFactory.js
sed -i 's#process.resourcesPath#path.dirname(this.app.getAppPath())#' app/node_modules/electron-updater/out/ElectronAppAdapter.js

notice "====Bili Bridge===="
notice "inject"
cat "$root_dir/res/scripts/injectBridge.js" > "app/main/assets/temp.js"
cat "app/main/assets/bili-inject.js" >> "app/main/assets/temp.js"
rm "app/main/assets/bili-inject.js"
mv "app/main/assets/temp.js" "app/main/assets/bili-inject.js"
cp "$root_dir/res/protos/dynamic.proto" "app/main/assets/protos/dynamic.proto"
mkdir tmp
cd tmp
echo "{}" > package.json
npm install @grpc/grpc-js
cd ..
cp -rf tmp/node_modules/* app/node_modules
rm -rf tmp
asar p app app.asar
rm -rf app
