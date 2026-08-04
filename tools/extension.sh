#!/usr/bin/env bash

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
if [ ! -f "$res_dir/app.asar" ]; then
  res_dir="$root_dir/app"
fi
if [ ! -f "$res_dir/app.asar" ]; then
  fail "未找到 app.asar；请先运行 tools/setup-bilibili.sh"
  exit 1
fi
mkdir -p "$root_dir/app"

notice "构建拓展"
rm -rf "$root_dir/app/extensions"

pnpm install
pnpm run build
notice "复制拓展"
mkdir -p "$root_dir/app/extensions"
cp -r "$root_dir/dist/extension" "$root_dir/app/extensions/bilibili"

notice "复制AI脚本"
cp "$root_dir/res/scripts/transcribe.py" "$root_dir/app"
cd "$res_dir"
rm -rf "$res_dir/app"
pnpm exec asar e "$res_dir/app.asar" "$res_dir/app"
cp "$root_dir/dist/inject/index.js" "$res_dir/app/index.js"
pnpm exec asar p "$res_dir/app" "$res_dir/app.asar"
