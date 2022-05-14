#!/bin/bash

# 构建AppImage

# 参数：
# $1 - 版本 v1.1.1-1
# $2 - 平台 x86_64

set -e
notice() {
    echo -e "\033[36m $1 \033[0m "
}
fail() {
    echo -e "\033[41;37m 失败 \033[0m $1"
}

if [ -n "$1" ];then
  export VERSION=$1
fi
if [ -n "$2" ];then
  export ARCH=$2
fi

if [[ $VERSION == '' ]];then
  fail "请指定版本"
  exit 1
elif [[ $ARCH == '' ]];then
  fail "请指定架构"
  exit 1
fi

root_dir=$(cd `dirname $0`/.. && pwd -P)
tmp_dir="$root_dir/tmp"
app_dir="$tmp_dir/AppDir"
build_dir="$tmp_dir/build"
mkdir -p $build_dir


notice "下载AppImage构建工具 ACTION_MODE:$ACTION_MODE"
if [[ $ACTION_MODE != 'true' ]]; then
  appimagetool_host="https://mirror.ghproxy.com/"
fi
if [ ! -f "$tmp_dir/appimagetool-x86_64.AppImage" ];then
  wget "${appimagetool_host}https://github.com/AppImage/AppImageKit/releases/download/continuous/appimagetool-x86_64.AppImage" \
    -O "$tmp_dir/appimagetool-x86_64.AppImage"
fi
chmod a+x "$tmp_dir/appimagetool-x86_64.AppImage"

# Remove any previous build
rm -rf $app_dir
# Make usr and icons dirs
mkdir -p $app_dir/bin
mkdir -p $app_dir/usr/{src,bin}
mkdir -p $app_dir/usr/share/{metainfo,icons}

notice "COPY FILES"
install -Dm755 "$root_dir/bin/bilibili" "$app_dir/bin/bilibili"
install -Dm644 "$root_dir/res/icons/icon.svg" "$app_dir/bilibili.svg"
install -Dm644 "$root_dir/res/bilibili.desktop" "$app_dir/bilibili.desktop"

cat > "$app_dir/AppRun" <<- 'EOF'
#!/bin/bash
exec $APPDIR/bin/bilibili

EOF
chmod +x "$app_dir/AppRun"

cp -r "$root_dir/app" "$app_dir/app"
cp -r "$root_dir/electron" "$app_dir/electron"

cd "$app_dir"

# appimagetool $app_dir
notice "MAKE APPIMAGE"
"$tmp_dir/appimagetool-x86_64.AppImage" "$app_dir" "$build_dir/bilibili_${VERSION}_${ARCH}.AppImage"

rm -rf $app_dir