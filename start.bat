@echo off
chcp 65001 >nul
title LearnFlow — фронтенд
color 0A

cd /d "%~dp0"

echo.
echo  ╔════════════════════════════════════════╗
echo  ║   LearnFlow — Vite dev-сервер          ║
echo  ╚════════════════════════════════════════╝
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [ОШИБКА] Node.js не найден. Установите с https://nodejs.org/
  pause
  exit /b 1
)

if not exist "package.json" (
  echo [ОШИБКА] package.json не найден.
  echo start.bat должен лежать в корне learnflow-react
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo [УСТАНОВКА] node_modules нет — запускаем npm install...
  call npm install
  if errorlevel 1 (
    echo [ОШИБКА] npm install провалился
    pause
    exit /b 1
  )
)

echo [OK] Запускаем Vite...
echo.
echo   Frontend: http://localhost:5173
echo   Dev-панель: http://localhost:5173/dev
echo.
echo   Закрыть это окно = остановить фронтенд.
echo.

REM Открываем браузер через 3 секунды в фоне
start "" cmd /c "timeout /t 3 /nobreak >nul && start http://localhost:5173/"

call npm run dev

REM Сюда попадём только если Vite упал/остановлен
echo.
echo Vite остановлен.
pause