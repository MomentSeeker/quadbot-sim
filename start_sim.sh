#!/bin/bash

# 获取脚本所在目录，防止在其他非根目录下执行报错
cd "$(dirname "$0")"

echo "====================================="
echo "   启动 Quadbot Simulator 服务..."
echo "====================================="

# 使用 npm 启动 Vite 开发服务器
npm run dev
