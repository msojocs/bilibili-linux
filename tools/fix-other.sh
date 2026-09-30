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
npx -y asar e app.asar app

notice "解密"
"$root_dir/tools/app-decrypt.js" "$res_dir/app/main/.biliapp" "$res_dir/app/main/app.orgi.js"
"$root_dir/tools/js-decode.js" "$res_dir/app/main/app.orgi.js" "$res_dir/app/main/app.js"
"$root_dir/tools/bridge-decode.js" "$res_dir/app/main/assets/bili-bridge.js" "$res_dir/app/main/assets/bili-bridge.js"

notice "====app.js===="

notice "屏蔽检测"
# grep -lr 'if (!dj' --exclude="app.asar" .
# sed -i 's#if (!dj#if(false\&\&!dj#g' "app/main/app.js"
# ==='win';if(! 警告11
grep -lr 'if (!k0' --exclude="app.asar" .
sed -i 's#if (!k0#if(false\&\&!k0#' "app/main/app.js"
# if (!jT
sed -i 's#if (!jT#if (false\&\&!jT#' "app/main/app.js"

# notice "路由"
# cat "$root_dir/res/scripts/inject-biliapp.js" >> app/render/assets/biliapp.*.js

notice "检查更新"
# 检查更新已由 src/inject/common/update.ts 接管（数据源改成 GitHub Release），
# 这里不再需要给 electron-updater 打「强制 win32 平台」之类的补丁：官方 autoUpdater
# 根本不会被实例化。app-update.yml 仍然照原样打进包里，但已不会被读取。

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

npx -y asar p app app.asar
rm -rf app

notice "cursor-tool"
# 使用旧 glibc 环境重新编译，避免预编译版本要求 GLIBC_2.34（见 tools/build-cursor-tool.sh）
if command -v docker >/dev/null 2>&1 && "$root_dir/tools/build-cursor-tool.sh" "$res_dir/cursor-tool"; then
    notice "cursor-tool 编译完成（旧 glibc）"
else
    notice "回退到预编译 cursor-tool"
    wget -c https://github.com/msojocs/bilibili-linux/releases/download/tools/cursor-tool -Ocursor-tool
fi
chmod +x cursor-tool
