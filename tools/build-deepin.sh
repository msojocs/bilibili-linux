#!/bin/bash
root_dir=$(cd `dirname $0`/.. && pwd -P)

set -e
notice() {
    echo -e "\033[36m $1 \033[0m "
}
fail() {
    echo -e "\033[41;37m 失败 \033[0m $1"
}


if [ -n "$1" ];then
  export BUILD_VERSION=$1
fi
if [ -z "$BUILD_VERSION" ];then
  export BUILD_VERSION='continuous'
fi

############ 准备构建deb包所需的文件及结构 ################
package_name="io.github.msojocs.bilibili"

echo "root_dir: $root_dir"
tmp_dir="$root_dir/tmp"
build_dir="$root_dir/tmp/$package_name"
base_dir="$build_dir/opt/apps/$package_name"

# Remove any previous build
rm -rf $build_dir
# Make usr and icons dirs
notice "Make Dirs"
mkdir -p $base_dir/{entries,files}
mkdir -p $base_dir/entries/{applications,icons/hicolor/scalable/apps/,mime,plugins,services}
mkdir -p $base_dir/files/{bin/bin,doc,lib}

notice "COPY Files"
cp -r "$root_dir/res/deepin"/* $build_dir
# mv "$build_dir/opt/apps/io.github.msojocs.bilibili"/* $base_dir
# rm -r "$build_dir/opt/apps/io.github.msojocs.bilibili"
sed -i "s/BUILD_VERSION/${BUILD_VERSION//v/}/" "$build_dir/debian/control" "$build_dir/debian/changelog" "$base_dir/info"
\cp -rf "$root_dir/bin/bilibili" "$base_dir/files/bin/bin/bilibili"
# 时间
build_time=$(LANG=en_US date '+%a, %d %b %Y %H:%M:%S %z')
sed -i "s#[A-Za-z]\+, [0-9]\+ [A-Za-z]\+ [0-9]\+ [0-9]\+:[0-9]\+:[0-9]\+ +[0-9]\+#${build_time}#" "$build_dir/debian/changelog"
# 架构
notice "架构：$BUILD_ARCH"
if [ "$BUILD_ARCH" != "" ];then
  sed -i "s#amd64#${BUILD_ARCH}#" "$build_dir/debian/control"
fi
ls -l "$build_dir/debian"
# desktop
\cp -rf "$root_dir/res/bilibili.desktop" "$base_dir/entries/applications/$package_name.desktop"
sed -i "s#Icon=bilibili#Icon=$package_name#" "$base_dir/entries/applications/$package_name.desktop"
sed -i "s#Exec=bilibili#Exec=/opt/apps/$package_name/files/bin//bin/bilibili#" "$base_dir/entries/applications/$package_name.desktop"

\cp -rf "$root_dir/res/icons/bilibili.svg" "$base_dir/entries/icons/hicolor/scalable/apps/$package_name.svg"

# 兼容普通deb
mkdir -p "$build_dir/usr/share/applications" "$build_dir/usr/share/icons/hicolor/scalable/apps"
\cp -rf "$base_dir/entries/applications/$package_name.desktop" "$build_dir/usr/share/applications/$package_name.desktop"
\cp -rf "$base_dir/entries/icons/hicolor/scalable/apps/$package_name.svg" "$build_dir/usr/share/icons/hicolor/scalable/apps/$package_name.svg"

# 主体文件
cp -rL "$root_dir/app" "$base_dir/files/bin/app"
cp -r "$root_dir/electron" "$base_dir/files/bin/electron"
# chown -R root:root "$base_dir"

notice "BUILD DEB Package"
cd "$build_dir"
ls -l "$build_dir"
mkdir -p "$root_dir/tmp/build"

debuild --no-tgz-check -i -I -uc -us -a"${BUILD_ARCH}"
mv $tmp_dir/*.deb $tmp_dir/build