#!/bin/bash

root_dir=$(cd `dirname $0`/.. && pwd -P)

set -e
trap 'catchError $LINENO "$BASH_COMMAND"' ERR # 捕获错误情况
catchError() {
    exit_code=$?
    if [ $exit_code -ne 0 ]; then
        fail "\033[31mcommand: $2\n  at $0:$1\n  at $STEP\033[0m"
    fi
    echo $exit_code > $root_dir/tmp/exit_code
    exit $exit_code
}

notice() {
    echo -e "\033[36m $1 \033[0m "
}
fail() {
    echo -e "\033[41;37m 失败 \033[0m $1"
}

DOCKER_UID=$(id -u)
DOCKER_GID=$(id -g)
BUILD_TAG=${BUILD_TAG:-1.0.0}
BUILD_ARCH=${BUILD_ARCH:-loong64}

# why use docker to build? a) old system does support loong64.
docker run \
    --rm -i \
    -e "DOCKER_GID=${DOCKER_GID}" \
    -e "DOCKER_UID=${DOCKER_UID}" \
    -e "BUILD_TAG=${BUILD_TAG}" \
    -e "BUILD_ARCH=${BUILD_ARCH}" \
    -w /workspace \
    -v "$root_dir:/workspace" \
    ubuntu:24.04 \
    sh <<\EOF
apt update
apt install -y devscripts build-essential debhelper

echo $DOCKER_GID
echo $DOCKER_UID
echo $BUILD_TAG
echo $BUILD_ARCH
groupadd -g $DOCKER_GID docker
useradd -m -u $DOCKER_UID -g $DOCKER_GID builder && passwd -d builder
cat /etc/passwd
user=$(getent passwd $DOCKER_UID | cut -d: -f1)
su - $user -c "BUILD_ARCH=$BUILD_ARCH /workspace/tools/build-deepin.sh $BUILD_TAG"
EOF

