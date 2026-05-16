#!/usr/bin/env bash
set -e

VERSION_FILE="version.json"

# 读取当前版本并自增 patch 号
current=$(jq -r '.version' "$VERSION_FILE")
major=$(echo "$current" | cut -d. -f1)
minor=$(echo "$current" | cut -d. -f2)
patch=$(echo "$current" | cut -d. -f3)
new_version="${major}.${minor}.$((patch + 1))"

# 写回 version.json
jq --arg v "$new_version" '.version = $v' "$VERSION_FILE" > tmp.$$.json && mv tmp.$$.json "$VERSION_FILE"
echo "版本: ${current} → ${new_version}"

docker build -t docker.plaso.cn/ezdp-frontend:${new_version} .
docker push docker.plaso.cn/ezdp-frontend:${new_version}

mc cp version.json "lxz/devops/ezdp/frontend/version.json"
