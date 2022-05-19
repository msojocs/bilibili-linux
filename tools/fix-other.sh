#!/bin/bash
root_dir=$(cd `dirname $0`/.. && pwd -P)

set -e

notice() {
    echo -e "\033[36m $1 \033[0m "
}

cd "$root_dir/app"
asar e app.asar app
notice "路由"
# 路由
sed -i 's#case"SettingsPage":return r.push({name:"Settings"})}}#case"SettingsPage":return r.push({name:"Settings"});default:if(a)return r.push({name:a.page})}}#' app/render/assets/index.*.js
notice "添加主页菜单"
# 添加主页菜单
sed -i "s#\\[eQ(0x34d)](\\[{'\\\x6c\\\x61\\\x62\\\x65\\\x6c':'\\\u8bbe\\\u7f6e'#[eQ(0x34d)]([{'label':'首页','click':()=>this[eQ(0x47e)][eQ(0x228)]({'page':'Root'})},{'\\\x6c\\\x61\\\x62\\\x65\\\x6c':'\\\u8bbe\\\u7f6e'#" app/main/index.js

# 修复新版不能启动的问题
notice "修复新版不能启动的问题"
sed -i 's#||b4&&dV!==e7(0x8b1)##' app/main/index.js

# 任务栏菜单
sed -i 's#\\x77\\x69\\x6e\\x33\\x32#linux#' app/main/index.js
# 去除标题栏
# ]}});this[
sed -i "s#]}});this\\[#]},frame:false});this[#g" app/main/index.js
sed -i "s#]}}),this\\[#]},frame:false}),this[#g" app/main/index.js
# 降低窗口大小限制，处理小分辨率屏幕无法全屏的问题
# resizable
sed -i "s#\\\x72\\\x65\\\x73\\\x69\\\x7a\\\x61\\\x62\\\x6c\\\x65':!\\[]#\\\x72\\\x65\\\x73\\\x69\\\x7a\\\x61\\\x62\\\x6c\\\x65':true#g" app/main/index.js
# Width
sed -i "s#\\\x57\\\x69\\\x64\\\x74\\\x68':0x[0-9a-z]\+#\\\x57\\\x69\\\x64\\\x74\\\x68':800#g" app/main/index.js
# Height
sed -i "s#\\\x48\\\x65\\\x69\\\x67\\\x68\\\x74':0x[0-9a-z]\+#\\\x48\\\x65\\\x69\\\x67\\\x68\\\x74':400#g" app/main/index.js
# 检查更新
sed -i 's#// noinspection SuspiciousTypeOfGuard#runtimeOptions.platform="win32";// noinspection SuspiciousTypeOfGuard#' app/node_modules/electron-updater/out/providerFactory.js
sed -i 's#process.resourcesPath#path.dirname(this.app.getAppPath())#' app/node_modules/electron-updater/out/ElectronAppAdapter.js
asar p app app.asar
rm -rf app
