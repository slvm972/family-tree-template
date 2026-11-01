@echo off
chcp 65001 >nul
title Настройка семейного дерева
color 0E

echo.
echo   ============================================
echo     НАСТРОЙКА СЕМЕЙНОГО ДЕРЕВА
echo   ============================================
echo.
echo   Сейчас будет установлено и запущено
echo   всё необходимое для вашего дерева.
echo.
echo   Это займёт несколько минут.
echo.
pause

REM ── Check Node.js is installed ──────────────────
where node >nul 2>nul
if errorlevel 1 (
    echo.
    echo   [ОШИБКА] Node.js не найден на этом компьютере.
    echo.
    echo   Пожалуйста:
    echo   1. Откройте сайт nodejs.org
    echo   2. Скачайте и установите версию LTS
    echo   3. Перезапустите этот файл
    echo.
    pause
    exit /b 1
)

echo.
echo   [1/2] Node.js найден, продолжаем...
echo.

REM ── Run the interactive setup script ────────────
REM (отдельного шага "npm install" не нужно: единственная
REM  зависимость — Cloudflare Wrangler — запускается через
REM  "npx wrangler ...", который сам скачивает нужную версию
REM  по требованию, без локального package.json/node_modules)
echo   [2/2] Запускаю настройку...
echo.
call node setup.js

echo.
echo   ============================================
echo     НАСТРОЙКА ЗАВЕРШЕНА
echo   ============================================
echo.
echo   Прочитайте сообщения выше — там указана
echo   ссылка на ваше готовое дерево.
echo.
echo   Если что-то осталось непонятным — обратитесь
echo   в техподдержку.
echo.
pause
