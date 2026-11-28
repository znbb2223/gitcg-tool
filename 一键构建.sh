#!/bin/sh
# 手机文件管理器/MT 里点这个（等价于 build-oneclick.sh）
exec sh "$(dirname "$0")/build-oneclick.sh" "$@"
