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
cd "$res_dir"
asar e app.asar app

notice "解密"
"$root_dir/tools/app-decrypt.js" "$res_dir/app/main/.biliapp" "$res_dir/app/main/app.orgi.js"
"$root_dir/tools/js-decode.js" "$res_dir/app/main/app.orgi.js" "$res_dir/app/main/app.js"
"$root_dir/tools/bridge-decode.js" "$res_dir/app/main/assets/bili-bridge.js" "$res_dir/app/main/assets/bili-bridge.js"

notice "====index.js===="
# 修复新版不能启动的问题
notice "修复新版不能启动的问题 index.js"
# 从app.js加载 ok
grep -lr '!import_electron2' --exclude="app.asar" .
sed -i 's#!import_electron2#import_electron2#' app/main/index.js
grep -lr 'global;import_electron2' --exclude="app.asar" .
sed -i 's#global;import_electron2#global;!import_electron2#' app/main/index.js
notice "====app.js===="

notice "屏蔽检测"
grep -lr 'if(!h8){' --exclude="app.asar" .
sed -i 's#if(!h8){#if(false\&\&!h8){#' app/main/app.js
grep -lr '}BG.app' --exclude="app.asar" .
sed -i 's#}BG.app#}false\&\&BG.app#' app/main/app.js
grep -lr 'if(!BQ){' --exclude="app.asar" .
sed -i 's#if(!BQ){#if(false\&\&!BQ){#' app/main/app.js
grep -lr ';!h8' --exclude="app.asar" .
sed -i 's#;!h8#;false\&\&!h8#' app/main/app.js

notice "路由"
grep -lr 'case"SettingsPage":return r.push({name:"Settings"});c' --exclude="app.asar" .
sed -i 's#case"SettingsPage":return r.push({name:"Settings"});c#case"SettingsPage":return r.push({name:"Settings"});default:if(a)return r.push({name:a.page});c#' app/render/assets/index.*.js

notice "添加主页菜单" # ok
grep -lr "emplate'](\[{'label':'设置" --exclude="app.asar" .
sed -i "s#emplate'](\[{'label':'设置#emplate'](\[{'label':'首页','click':()=>this.openMainWindowPage$.next({'page':'Root'})},{'label':'设置#" app/main/app.js

# 任务栏菜单
notice "去除标题栏"
grep -lr ']}});this\[' --exclude="app.asar" .
sed -i "s#]}});this\\[#]},frame:false});this[#g" app/main/app.js
sed -i "s#]}}),this\\[#]},frame:false}),this[#g" app/main/app.js
# splash
sed -i "s#erence']}})#erence']},frame:false})#g" app/main/app.js

notice "检查更新"
# 检查更新
grep -lr "// noinspection SuspiciousTypeOfGuard" --exclude="app.asar" .
sed -i 's#// noinspection SuspiciousTypeOfGuard#runtimeOptions.platform="win32";// noinspection SuspiciousTypeOfGuard#' app/node_modules/electron-updater/out/providerFactory.js
sed -i 's#process.resourcesPath#path.dirname(this.app.getAppPath())#' app/node_modules/electron-updater/out/ElectronAppAdapter.js

notice "====Bili Bridge===="
notice "inject"
cat "$root_dir/res/scripts/injectBridge.js" > "app/main/assets/temp.js"
cat "app/main/assets/bili-bridge.js" >> "app/main/assets/temp.js"
rm "app/main/assets/bili-bridge.js"
mv "app/main/assets/temp.js" "app/main/assets/bili-bridge.js"

asar p app app.asar
rm -rf app
