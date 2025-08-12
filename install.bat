@echo off
echo Node.js paketleri yükleniyor...
npm install
if %errorlevel% neq 0 (
  echo Hata oluştu!
  pause
  exit /b %errorlevel%
)
echo PeerJS global kuruluyor...
npm install -g peer
if %errorlevel% neq 0 (
  echo Hata oluştu!
  pause
  exit /b %errorlevel%
)
echo Kurulum tamamlandı.
pause 