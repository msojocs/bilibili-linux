#!/bin/bash
root_dir=$(cd `dirname $0`/.. && pwd -P)

set -e

notice() {
    echo -e "\033[36m $1 \033[0m "
}
_exit() {
    exit 1
}

cd "$root_dir/app"

notice "更新MD5"
md5=$(md5sum app/main/index.js|cut -d ' ' -f1)
echo ${md5} > app/.appkey