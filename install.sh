#!/bin/bash

# snowpub 安装脚本
# 自动检测芯片类型并安装对应版本

set -e

VERSION="1.0.0"

echo "🚀 snowpub v${VERSION} 安装程序"
echo "================================"
echo ""

# 检测芯片类型
ARCH=$(uname -m)
if [ "$ARCH" = "arm64" ]; then
    DMG_FILE="snowpub_${VERSION}_arm64.dmg"
    echo "✓ 检测到 Apple Silicon (M1/M2/M3) 芯片"
elif [ "$ARCH" = "x86_64" ]; then
    DMG_FILE="snowpub_${VERSION}_x64.dmg"
    echo "✓ 检测到 Intel 芯片"
else
    echo "❌ 无法识别的芯片类型: $ARCH"
    exit 1
fi

echo "📦 将安装: $DMG_FILE"
echo ""

# 检查 DMG 文件是否存在
if [ ! -f "release/${VERSION}/$DMG_FILE" ]; then
    echo "❌ 错误: 找不到安装文件 release/${VERSION}/$DMG_FILE"
    echo "请先运行 'npm run build' 构建应用"
    exit 1
fi

echo "🔧 正在挂载 DMG..."
# 挂载 DMG 并提取挂载点路径（包含空格）
MOUNT_POINT=$(hdiutil attach "release/${VERSION}/$DMG_FILE" | grep Volumes | sed 's/.*\(\/Volumes\/.*\)/\1/')

if [ -z "$MOUNT_POINT" ]; then
    echo "❌ 挂载 DMG 失败"
    exit 1
fi

echo "✓ DMG 已挂载到: $MOUNT_POINT"

# 复制应用到 Applications
echo "📋 正在复制应用到 /Applications..."
if [ -d "/Applications/snowpub.app" ]; then
    echo "⚠️  检测到已安装的版本，正在覆盖..."
    rm -rf "/Applications/snowpub.app"
fi

cp -R "$MOUNT_POINT/snowpub.app" /Applications/

# 卸载 DMG
echo "🧹 正在清理..."
hdiutil detach "$MOUNT_POINT" -quiet

# 移除隔离属性（避免"已损坏"提示）
echo "🔓 正在移除隔离属性..."
xattr -cr /Applications/snowpub.app

echo ""
echo "✅ 安装完成！"
echo ""
echo "📝 使用说明:"
echo "  1. 在 Launchpad 或 Applications 文件夹中找到 snowpub"
echo "  2. 双击启动应用"
echo "  3. 在设置 → 公众号 中配置 AppID/AppSecret"
echo "  4. 打开 .md 笔记，工具栏点微信预览图标进入双栏模式"
echo "  5. 点发布图标填标题/封面图后保存草稿 → 发布"
echo ""
echo "🎉 开始享受高效的公众号写作与发布吧！"
