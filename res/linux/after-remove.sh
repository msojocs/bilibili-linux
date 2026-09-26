# shellcheck disable=SC2016  # ${...} 为 electron-builder 构建期模板占位符，非 shell 变量
#!/bin/bash

# 卸载后清理 /usr/bin 下的启动链接。
#
# 修复 electron-builder 默认 after-remove 模板的两个问题：
# 1. 默认模板执行 `update-alternatives --remove '<name>' '/usr/bin/<name>'`，
#    第二参数应为备选方案路径 /opt/<product>/<name>，路径不匹配时
#    update-alternatives 以退出码 2 失败，导致 rpm 事务报错。
# 2. 默认模板未区分升级与卸载：rpm 升级时旧包 %postun 收到 $1 >= 1，
#    deb 升级时 postrm 收到 upgrade，此时新包的链接刚刚装好，不能清理。

case "${1:-0}" in
    upgrade|disappearer)
        # deb：升级/被取代，保留链接
        exit 0
        ;;
    ''|*[!0-9]*)
        # deb：remove/purge 等其他文本参数，继续清理
        ;;
    *)
        # rpm：$1 >= 1 表示升级，仅 $1 = 0 是最终卸载
        if [ "$1" -ge 1 ]; then
            exit 0
        fi
        ;;
esac

LINK='/usr/bin/${executable}'
TARGET='/opt/${sanitizedProductName}/${executable}'

if type update-alternatives >/dev/null 2>&1; then
    update-alternatives --remove '${executable}' "$TARGET" 2>/dev/null || true
fi

# 兜底清理：仅当链接最终解析到本程序安装目录时才删除，
# 避免误删其他软件提供的同名文件。
if [ -L "$LINK" ]; then
    dest="$(readlink -f "$LINK" 2>/dev/null || true)"
    case "$dest" in
        '/opt/${sanitizedProductName}/'*)
            rm -f "$LINK"
            ;;
    esac
fi

exit 0
