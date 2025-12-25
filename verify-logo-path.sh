#!/bin/bash

echo "=== Logo 路径验证脚本 ==="
echo

cd /Users/liang/xiaozaoWorkspace/ezdp/frontend

if [ ! -d "apps/web-ezdp/dist" ]; then
  echo "❌ dist 目录不存在，需要先构建："
  echo "   pnpm run build:ezdp"
  exit 1
fi

echo "1. 检查配置文件..."
echo "   - .env.production VITE_BASE:"
grep "VITE_BASE" apps/web-ezdp/.env.production

echo
echo "2. 检查 preferences.ts 中的 logo配置:"
grep -A2 "logo:" apps/web-ezdp/src/preferences.ts | grep "source"

echo
echo "3. 检查打包后的JS文件中的logo配置:"
cd apps/web-ezdp/dist
if [ -d "jse" ]; then
  grep -o 'logo:{[^}]*}' jse/*.js | grep -o 'source:"[^"]*"' | sort | uniq
  echo
  echo "✅ 如果显示 source:\"./logo.png\" 就是正确的！"
  echo "   浏览器Network面板显示 /logo.png 是正常的（浏览器会解析相对路径）"
else
  echo "❌ jse 目录不存在"
fi
