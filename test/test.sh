#!/bin/bash

VERSION=$(exiftool -S -ProductVersion cache/bili_win-install.exe)
echo $VERSION
V1=(${VERSION//: / })
echo ${V1[1]}

# node test/js-decode.js
# bin/bilibili