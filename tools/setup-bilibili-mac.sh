#!/bin/bash
# macOS 版的完整取源 + 打补丁流程，产出可直接交给 electron-builder 的 app/ 目录。
#
# 与 tools/setup-bilibili.sh 的差别只有两处：
# 1. 取源用官方 mac dmg（tools/update-bilibili-mac.sh），不用 Windows 安装包。
#    原因：asar 内置 nut.js 等原生模块，按平台分发，Windows 包里的 PE/ELF 在 mac 上加载不了。
# 2. 不跑 tools/update-electron.sh。打包时 electron 由 electron-builder 自行下载；
#    只有本地开发调试（bin/bilibili-mac）才需要先下 electron/。

root_dir=$(cd `dirname $0`/.. && pwd -P)
set -e
trap 'catchError $LINENO "$BASH_COMMAND"' ERR
catchError() {
    exit_code=$?
    if [ $exit_code -ne 0 ]; then
        fail "command: $2\n  at $0:$1\n  at $STEP"
    fi
    exit $exit_code
}

notice() {
    printf '\033[36m %s\033[0m \n' "$1"
}
fail() {
    printf '\033[41;37m 失败 \033[0m %s\n' "$1"
}

cd "$root_dir"

STEP="安装依赖"
pnpm install

STEP="取应用本体（mac dmg）"
BILIBILI_TARGET_PLATFORM=mac "$root_dir/tools/update-bilibili-mac.sh" $@

STEP="打补丁"
BILIBILI_TARGET_PLATFORM=mac "$root_dir/tools/fix-other.sh"

STEP="构建扩展"
BILIBILI_TARGET_PLATFORM=mac "$root_dir/tools/extension.sh"

res_dir="$root_dir/tmp/bili/resources"
STEP="汇总 app/"
# 这里不要 rm -rf app：extension.sh 刚把扩展与 transcribe.py 放进 app/，
# 删掉会让运行期 loadExtension 找不到扩展。app/ 由取源脚本重建为空目录，
# 这一步只是把 res_dir 里打好补丁的产物并进去。
mv "$res_dir/"* "$root_dir/app"

notice "完成，app/ 内容："
ls -la "$root_dir/app"
