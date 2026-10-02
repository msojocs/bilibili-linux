#!/bin/bash
# 从官方 macOS 安装包取应用本体，产出与 Windows 源一致的目录结构：
#   tmp/bili/resources/{app.asar, app-update.yml}
# 下游的 tools/fix-other.sh、tools/extension.sh 直接复用，无需改动取源逻辑。
#
# 为什么不用 Windows 安装包解出来的 asar：asar 内置了 nut.js 等原生模块，
# 而这些模块按平台分发。官方 mac 包里带的是 Mach-O（libnut-darwin 为
# universal，mission-control 分 arm64/x64），Windows 包里是 PE/ELF，
# 换到 mac 上加载会失败。

root_dir=$(cd `dirname $0`/.. && pwd -P)
set -e
trap 'catchError $LINENO "$BASH_COMMAND"' ERR
catchError() {
    exit_code=$?
    if [ $exit_code -ne 0 ];then
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

download_url="https://dl.hdslb.com/mobile/fixed/pc_electron_mac/bili_mac.dmg"
dmg_path="$root_dir/cache/bili_mac.dmg"
# 官方 CDN 会拒绝 curl 的默认 User-Agent，需伪装成浏览器。
user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15"

if [[ "$1" == "-f" ]];then
    notice "强制更新，删除缓存文件"
    rm -f "$dmg_path"
fi

mkdir -p "$root_dir/cache"
if [[ ! -f "$dmg_path" ]];then
    notice "下载 $download_url"
    curl -L --fail --retry 3 --retry-delay 2 -A "$user_agent" \
        -o "$dmg_path.tmp" "$download_url"
    mv "$dmg_path.tmp" "$dmg_path"
fi

tmp_dir="$root_dir/tmp"
res_dir="$tmp_dir/bili/resources"
mount_point="$tmp_dir/bili/mnt"

# dmg 是只读挂载，无论成功失败都要卸载，否则挂载点会残留占用
STEP="卸载 dmg"
mounted=0
cleanup() {
    if [ "$mounted" = "1" ];then
        diskutil unmount "$mount_point" >/dev/null 2>&1 \
            || hdiutil detach "$mount_point" -force >/dev/null 2>&1 \
            || true
    fi
    rmdir "$mount_point" 2>/dev/null || true
}
trap cleanup EXIT

rm -rf "$tmp_dir/bili"
mkdir -p "$mount_point"

STEP="挂载 dmg"
notice "挂载 dmg"
# dmg 内的 app 名是中文，这里按 Contents/Resources 定位而不写死 app 名
diskutil image attach -nobrowse -readOnly -mountPoint "$mount_point" "$dmg_path" >/dev/null
mounted=1

STEP="定位应用"
app_bundle=""
for d in "$mount_point"/*.app; do
    # app.asar 是文件，用 -f 判定
    if [ -f "$d/Contents/Resources/app.asar" ];then
        app_bundle="$d"
        break
    fi
done
if [ -z "$app_bundle" ];then
    fail "dmg 内未找到含 app.asar 的 .app"
    exit 1
fi
notice "应用: $(basename "$app_bundle")"

STEP="版本校验"
bundle_version=$(plutil -extract CFBundleVersion raw "$app_bundle/Contents/Info.plist")
conf_version=$(cat "$root_dir/conf/bilibili_version")
# 官方 win 与 mac 包的构建号可能不同（同一 1.19.0 下 mac 末位更高），
# 因此只严格比对前三段，构建号仅提示，避免因跨平台构建号差异卡住。
if [[ "${bundle_version%.*}" != "${conf_version%.*}" ]];then
    fail "下载的版本与配置的版本不匹配！！！$bundle_version != $conf_version"
    exit 1
fi
if [[ "$bundle_version" != "$conf_version" ]];then
    # 这里用内层 printf 拼接而不是 "…（$bundle_version…）"：
    # macOS 自带的 bash 3.2 在双引号内遇到全角「（」紧跟 $变量 时，
    # 变量展开的字节会被吃掉，打印成乱码。printf 走 %s 传参则正常。
    notice "$(printf '提示: 构建号与配置不同（%s vs %s），属跨平台差异，继续' \
        "$bundle_version" "$conf_version")"
fi

STEP="拷贝资源"
mkdir -p "$res_dir"
cp "$app_bundle/Contents/Resources/app.asar" "$res_dir/app.asar"
cp "$app_bundle/Contents/Resources/app-update.yml" "$res_dir/app-update.yml"

rm -rf "$root_dir/app"
mkdir -p "$root_dir/app"
