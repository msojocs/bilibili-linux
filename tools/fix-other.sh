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
grep -lr 'if(!_0x4bb4b2)' --exclude="app.asar" .
sed -i 's#if(!_0x4bb4b2)#if(_0x4bb4b2)#' app/main/index.js

notice "====app.js===="
notice "修复新版不能启动的问题 app.js"
# 从index启动!global[lA
# grep -lr "!global[lA" --exclude="app.asar" .
# sed -i 's#!global[lA#global[lA#' app/main/app.js

notice "屏蔽检测"
grep -lr 'if(!z2){' --exclude="app.asar" .
sed -i 's#if(!z2){#if(false\&\&!z2){#' app/main/app.js
grep -lr 'if(!ls){' --exclude="app.asar" .
sed -i 's#if(!ls){#if(false\&\&!ls){#' app/main/app.js

# package检测
grep -lr "}ll\\[lA(')\$6Z'" --exclude="app.asar" .
sed -i "s#}ll\\[lA(')\$6Z'#}false\&\&ll[lA(')\$6Z'#" app/main/app.js

# grep -lr "gE!=='\\\x6c\\\x69\\\x6e\\\x75\\\x78'" --exclude="app.asar" .
# sed -i "s#gE!=='\\\x6c\\\x69\\\x6e\\\x75\\\x78'#gE==='\\\x6c\\\x69\\\x6e\\\x75\\\x78'#" app/main/app.js

notice "路由"
grep -lr 'case"SettingsPage":return r.push({name:"Settings"})}}' --exclude="app.asar" .
sed -i 's#case"SettingsPage":return r.push({name:"Settings"})}}#case"SettingsPage":return r.push({name:"Settings"});default:if(a)return r.push({name:a.page})}}#' app/render/assets/index.*.js

notice "添加主页菜单" # ok
grep -lr "'emplate'](\[{'label':'设置" --exclude="app.asar" .
sed -i "s#'emplate'](\[{'label':'设置#'emplate'](\[{'label':'首页','click':()=>this.openMainWindowPage$.next({'page':'Root'})},{'label':'设置#" app/main/app.js

# 任务栏菜单
# sed -i 's#\\x77\\x69\\x6e\\x33\\x32#linux#' app/main/index.js
notice "去除标题栏"
grep -lr ']}});this\[' --exclude="app.asar" .
sed -i "s#]}});this\\[#]},frame:false});this[#g" app/main/app.js
sed -i "s#]}}),this\\[#]},frame:false}),this[#g" app/main/app.js
# splash
sed -i "s#erence']}})#erence']},frame:false})#g" app/main/app.js

notice "边框可调整，边框大小"
# 降低窗口大小限制，处理小分辨率屏幕无法全屏的问题
# resizable
grep -lr "'resizable':\!\\[]" --exclude="app.asar" .
sed -i "s#'resizable':\!\\[]#'resizable':true#g" app/main/app.js
# Width
grep -lr "Width':0x[0-9a-z]\+" --exclude="app.asar" .
sed -i "s#Width':0x[0-9a-z]\+#Width':800#g" app/main/app.js
# Height
grep -lr "Height':0x[0-9a-z]\+" --exclude="app.asar" .
sed -i "s#Height':0x[0-9a-z]\+#Height':600#g" app/main/app.js

notice "检查更新"
# 检查更新
grep -lr "// noinspection SuspiciousTypeOfGuard" --exclude="app.asar" .
sed -i 's#// noinspection SuspiciousTypeOfGuard#runtimeOptions.platform="win32";// noinspection SuspiciousTypeOfGuard#' app/node_modules/electron-updater/out/providerFactory.js
sed -i 's#process.resourcesPath#path.dirname(this.app.getAppPath())#' app/node_modules/electron-updater/out/ElectronAppAdapter.js

notice "====Bili Bridge===="
notice "hack debugger"
grep -lr "(ab(0x246,']nU]')+ab(0x24f,'tN&\!'))" --exclude="app.asar" .
sed -i "s#(ab(0x246,']nU]')+ab(0x24f,'tN&\!'))#(ab(0x246,']nU]')+ab(0x24f,'tN\&\!')+'123')#" "app/main/assets/bili-bridge.js"

grep -lr "('debu'+ab" --exclude="app.asar" .
sed -i "s#('debu'+ab#('123debu'+ab#" "app/main/assets/bili-bridge.js"

notice "直播间：isWin强制true"
grep -lr "G=(g,...h)=>{var" --exclude="app.asar" .
sed -i 's#G=(g,...h)=>{var#G=(g,...h)=>{if(g==="system/isWin")return true;var#' "app/main/assets/bili-bridge.js"

# notice "更新MD5"
# md5=$(md5sum app/main/index.js|cut -d ' ' -f1)
# echo ${md5[0]} > app/.appkey
asar p app app.asar
rm -rf app
