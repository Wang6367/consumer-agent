@echo off
title 消费智能体 Demo 服务
echo ========================================
echo   消费智能体 Demo - 启动中...
echo ========================================

REM 启动 Node 后端服务(后台运行)
start "consumer-agent-server" /min cmd /c ""C:\Program Files\nodejs\node.exe" c:\Users\18740\Desktop\consumer-agent\server.js"

REM 等待 2 秒让服务先启动
timeout /t 2 /nobreak >nul

REM 启动 ngrok 隧道(前台窗口,方便查看网址)
"C:\Users\18740\Desktop\ngrok-v3-stable-windows-amd64\ngrok.exe" http 8080