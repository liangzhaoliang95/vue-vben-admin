#!/bin/bash

set -e

echo "=== 清理并重新构建前端 ==="
echo

cd /Users/liang/xiaozaoWorkspace/ezdp/frontend

echo "1. 清理旧的构建产物..."
rm -rf apps/web-ezdp/dist apps/web-ezdp/dist.zip
rm -rf .turbo

echo "2. 清理node_modules缓存..."
rm -rf apps/web-ezdp/.vite
rm -rf packages/@core/preferences/dist

echo "3. 验证配置..."
echo "   - .env.production VITE_BASE:"
grep "VITE_BASE" apps/web-ezdp/.env.production

echo "   - preferences.ts logo:"
grep -A1 "logo:" apps/web-ezdp/src/preferences.ts | grep "source"

echo "   - 默认配置 logo:"
grep -A1 "logo:" packages/@core/preferences/src/config.ts | grep "source"

echo
echo "4. 开始构建..."
pnpm run build:ezdp

echo
echo "5. 验证构建结果..."
if [ -f "apps/web-ezdp/dist/index.html" ]; then
    echo "   ✅ dist目录生成成功"

    echo "   - 检查index.html中的路径:"
    grep -o 'src="[^"]*"' apps/web-ezdp/dist/index.html | head -3

    echo "   - 检查JS中的logo配置:"
    cd apps/web-ezdp/dist
    if [ -d "jse" ]; then
        cat jse/*.js | grep -o 'source:"[^"]*logo[^"]*"' | sort | uniq || echo "     未找到logo配置"
    fi

    echo
    echo "✅ 构建完成！"
    echo "📦 构建产物: apps/web-ezdp/dist/"
    echo "📦 压缩包: apps/web-ezdp/dist.zip"
    echo
    echo "⚠️  部署后请："
    echo "   1. 清除浏览器缓存 (Ctrl+Shift+Delete)"
    echo "   2. 强制刷新页面 (Ctrl+Shift+R 或 Cmd+Shift+R)"
    echo "   3. 或使用无痕模式测试"
else
    echo "   ❌ 构建失败，dist目录未生成"
    exit 1
fi
