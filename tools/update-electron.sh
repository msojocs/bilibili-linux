#!/bin/bash

SOURCE="${BASH_SOURCE[0]}"
while [ -h "$SOURCE" ]; do # resolve $SOURCE until the file is no longer a symlink
  DIR="$( cd -P "$( dirname "$SOURCE" )" >/dev/null 2>&1 && pwd )"
  SOURCE="$(readlink "$SOURCE")"
  [[ $SOURCE != /* ]] && SOURCE="$DIR/$SOURCE" # if $SOURCE was a relative symlink, we need to resolve it relative to the path where the symlink file was located
done
root_dir="$( cd -P "$( dirname "$SOURCE" )"/.. >/dev/null 2>&1 && pwd )"

set -e

notice() {
  echo -e "\033[36m $1 \033[0m "
}

# Electron 的版本、下载地址与选型理由全部来自 conf/config.json 的 electron 节点。
# JSON 不支持注释，所以版本为什么是这几个数写在那个文件的 "//" 字段里。
# 架构来自 --arch、其次环境变量 BUILD_ARCH、其次本机架构（见 tools/parse-config.js 的说明）。
electron_url=$(node "$root_dir/tools/parse-config.js" --get-electron-url $@)
electron_version=$(node "$root_dir/tools/parse-config.js" --get-electron-version $@)
file_name=$(basename "$electron_url")
notice "electron v${electron_version}: ${electron_url}"

mkdir -p "$root_dir/cache" "$root_dir/tmp"
local_path="$root_dir/cache/$file_name"
if [[ ! -f "$local_path" ]];then
  wget -c "$electron_url" -O "$local_path.tmp"
  mv "$local_path.tmp" "$local_path"
fi
rm -rf "$root_dir/electron"
mkdir -p "$root_dir/electron"
unzip -q -o "$local_path" -d "$root_dir/electron"
