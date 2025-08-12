@echo off
:loop
node server.js
if %errorlevel% neq 0 (
  echo Sunucu çöktü, yeniden başlatılıyor...
  timeout /t 2
  goto loop
)
