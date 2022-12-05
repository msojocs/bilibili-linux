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
fail() {
    echo -e "\033[41;37m 失败 \033[0m $1"
}

download_url="https://dl.hdslb.com/mobile/fixed/bili_win/bili_win-install.exe"

mkdir -p "$root_dir/cache"
if [[ ! -f "$root_dir/cache/bili_win-install.exe" ]];then
    wget -c "$download_url" -O "$root_dir/cache/bili_win-install.exe.tmp"
    mv "$root_dir/cache/bili_win-install.exe.tmp" "$root_dir/cache/bili_win-install.exe"
fi
tmp_dir="$root_dir/tmp"
mkdir -p "$tmp_dir/bili"

notice "一次版本校验"
BILIBILI_VERSION=$(exiftool -S -ProductVersionNumber "$root_dir/cache/bili_win-install.exe")
BILIBILI_VERSION=(${BILIBILI_VERSION//: / })
BILIBILI_VERSION=${BILIBILI_VERSION[1]}
CONF_VERSION=$(cat "$root_dir/conf/bilibili_version")
if [[ "$BILIBILI_VERSION" != "$CONF_VERSION" ]];then
  echo $BILIBILI_VERSION > "$root_dir/conf/bilibili_version"
fi
