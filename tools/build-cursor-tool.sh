#!/bin/bash

# 编译 cursor-tool
#
# cursor-tool 通过 cgo 调用 libinput，直接用构建机工具链编译会继承构建机的 glibc 版本要求：
# 在 glibc >= 2.34 的系统（如 Ubuntu 22.04+ / CI 的 ubuntu-latest）上编译会引用 GLIBC_2.34，
# 使得打包出的 AppImage 无法在较旧的发行版上加载该二进制。
#
# 这里固定在 Ubuntu 20.04 (glibc 2.31) 容器中编译，产出的二进制最高只要求 glibc 2.7，
# 低于 Electron 自身的 2.25，因此不会抬高 AppImage 的 glibc 要求。
#
# 用法: tools/build-cursor-tool.sh [输出路径]（默认 app/cursor-tool）

set -e

root_dir=$(cd "$(dirname "$0")/.." && pwd -P)
src_dir="$root_dir/tools/cursor-tool"
output="${1:-$root_dir/app/cursor-tool}"

base_image="${CURSOR_TOOL_BUILD_IMAGE:-ubuntu:20.04}"
go_version="${CURSOR_TOOL_GO_VERSION:-1.24.5}"
go_proxy="${GOPROXY:-https://goproxy.cn,direct}"
go_download_base="${GOLANG_DOWNLOAD_BASE:-https://golang.google.cn/dl}"

notice() {
  echo -e "\033[36m $1 \033[0m "
}

if ! command -v docker >/dev/null 2>&1; then
  echo "docker 不可用，无法在旧 glibc 环境中编译 cursor-tool" >&2
  exit 1
fi

mkdir -p "$(dirname "$output")"

notice "在 $base_image 中编译 cursor-tool"
docker run --rm \
  -v "$src_dir:/src" \
  -w /src \
  -e DEBIAN_FRONTEND=noninteractive \
  -e "GO_VERSION=$go_version" \
  -e "GOPROXY=$go_proxy" \
  -e "GO_DOWNLOAD_BASE=$go_download_base" \
  "$base_image" bash -c '
    set -e
    apt-get update -qq
    apt-get install -y -qq --no-install-recommends \
      libinput-dev libx11-dev libxrandr-dev gcc pkg-config curl ca-certificates
    curl -fsSL "${GO_DOWNLOAD_BASE}/go${GO_VERSION}.linux-amd64.tar.gz" | tar -C /usr/local -xz
    export PATH="/usr/local/go/bin:$PATH"
    go build -trimpath -ldflags="-s -w" -o /src/cursor-tool .
  '

install -m 0755 "$src_dir/cursor-tool" "$output"
notice "cursor-tool -> $output"
