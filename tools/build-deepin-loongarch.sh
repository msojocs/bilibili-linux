#!/bin/bash

root_dir=$(cd `dirname $0`/.. && pwd -P)

set -e
trap 'catchError $LINENO "$BASH_COMMAND"' ERR # 捕获错误情况
catchError() {
    exit_code=$?
    if [ $exit_code -ne 0 ]; then
        fail "\033[31mcommand: $2\n  at $0:$1\n  at $STEP\033[0m"
    fi
    # 让runner失败
    exit 128
}

notice() {
    echo -e "\033[36m $1 \033[0m "
}
fail() {
    echo -e "\033[41;37m 失败 \033[0m $1"
}
apt update
apt install -y devscripts build-essential debhelper

groupadd -g $DOCKER_GID docker
useradd -m -u $DOCKER_UID -g $DOCKER_GID builder && passwd -d builder
cat /etc/passwd
su - ubuntu -c "BUILD_ARCH=$BUILD_ARCH $root_dir/tools/build-deepin.sh $BUILD_TAG"
