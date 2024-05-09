#!/bin/bash

# 用于github actions构建
# 解压初步构建后的文件

# 脚本执行前提，已完成支持wine的基本构建
set -e
success() {
    echo -e "\033[42;37m 成功 \033[0m $1"
}
notice() {
    echo -e "\033[36m $1 \033[0m "
}
fail() {
    echo -e "\033[41;37m 失败 \033[0m $1"
}

root_dir=$(cd `dirname $0`/.. && pwd -P)

if [[ "$BUILD_VERSION" == *continuous ]];then
    echo "continuous"
    sed -i 's#"buildVersion": "[0-9]\+",#"buildVersion": "0",#' "$root_dir/package.json"
else
    tag=(${BUILD_VERSION//-/ })
    echo "${tag[1]}"
    sed -i 's#"buildVersion": "[0-9]\+",#"buildVersion": "'${tag[1]}'",#' "$root_dir/package.json"
fi

tmp_dir="$root_dir/tmp"
store_dir="$tmp_dir/build"
mkdir -p $store_dir
rm -rf app electron
tar -zxf tmp/src/bilibili-asar-*.tar.gz -C .
 