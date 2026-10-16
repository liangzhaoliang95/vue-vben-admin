#!/usr/bin/env bash
set -e

echo "1. 清理旧的构建产物..."
rm -rf apps/web-ezdp/dist apps/web-ezdp/dist.zip
rm -rf .turbo

echo "2. 清理node_modules缓存..."
rm -rf apps/web-ezdp/.vite
rm -rf packages/@core/preferences/dist

VERSION_FILE="version.json"

# 读取当前版本并自增 patch 号
current=$(jq -r '.version' "$VERSION_FILE")
major=$(echo "$current" | cut -d. -f1)
minor=$(echo "$current" | cut -d. -f2)
patch=$(echo "$current" | cut -d. -f3)
new_version="${major}.${minor}.$((patch + 1))"

# 写回 version.json
jq --arg v "$new_version" '.version = $v' "$VERSION_FILE" > tmp.$$.json && mv tmp.$$.json "$VERSION_FILE"

# 同步更新 apps/web-ezdp/package.json，使 VITE_APP_VERSION 与 version.json 一致
APP_PKG="apps/web-ezdp/package.json"
jq --arg v "$new_version" '.version = $v' "$APP_PKG" > tmp.$$.json && mv tmp.$$.json "$APP_PKG"

echo "版本: ${current} → ${new_version}"

docker build -t docker.plaso.cn/ezdp-frontend:${new_version} .
docker push docker.plaso.cn/ezdp-frontend:${new_version}

mc cp version.json "lxz/devops/ezdp/frontend/version.json"
