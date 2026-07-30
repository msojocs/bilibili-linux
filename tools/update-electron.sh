#!/usr/bin/env bash

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

# electron 43.1.1 (Chromium 150) for NVIDIA/Wayland GPU accel (rendering + VA-API video decode).
# #42519 (screen.getCursorScreenPoint Linux regression, still OPEN) is bypassed by cursor-tool
# (electron-tool.ts electronOverwriteAfterReady) on Wayland, so upgrading is safe for Wayland users.
# https://github.com/msojocs/bilibili-linux/issues/170, https://github.com/electron/electron/issues/42519
electron_version="43.1.1"
if [ "$BUILD_ARCH" == "" ];then
  BUILD_ARCH="x64"
elif [ "$BUILD_ARCH" == "amd64" ];then
  BUILD_ARCH="x64"
elif [ "$BUILD_ARCH" == "arm64" ];then
  BUILD_ARCH="arm64"
fi
download_urls=(
  "https://npmmirror.com/mirrors/electron/${electron_version}/electron-v${electron_version}-linux-${BUILD_ARCH}.zip"
  "https://github.com/electron/electron/releases/download/v${electron_version}/electron-v${electron_version}-linux-${BUILD_ARCH}.zip"
)
if [ "$BUILD_ARCH" == "loong64" ];then
  # 新世界
  electron_version="22.3.27"
  download_urls=("https://github.com/msojocs/electron-loongarch/releases/download/v${electron_version}/electron-v${electron_version}-linux-loong64.zip")
elif [ "$BUILD_ARCH" == "loongarch64" ];then
  # 旧世界
  electron_version="22.3.27"
  # download_url="http://ftp.loongnix.cn/electron/LoongArch/v22.3.27/electron-v22.3.27-linux-loong64.zip"
  download_urls=("https://github.com/msojocs/electron-loongarch/releases/download/v${electron_version}/electron-v${electron_version}-linux-loongarch64.zip")
fi

mkdir -p "$root_dir/cache" "$root_dir/tmp"
if [[ ! -f "$root_dir/cache/electron-v${electron_version}-linux-${BUILD_ARCH}.zip" ]];then
  download_succeeded=false
  for download_url in "${download_urls[@]}"; do
    if wget -c "$download_url" -O "$root_dir/cache/electron-v${electron_version}-linux-${BUILD_ARCH}.zip.tmp"; then
      download_succeeded=true
      break
    fi
  done
  if [[ "$download_succeeded" != true ]]; then
    echo "Unable to download Electron from any configured source." >&2
    exit 1
  fi
  mv "$root_dir/cache/electron-v${electron_version}-linux-${BUILD_ARCH}.zip.tmp" "$root_dir/cache/electron-v${electron_version}-linux-${BUILD_ARCH}.zip"
fi
rm -rf "$root_dir/electron"
mkdir -p "$root_dir/electron"
unzip -o -d "$root_dir/electron" "$root_dir/cache/electron-v${electron_version}-linux-${BUILD_ARCH}.zip"
