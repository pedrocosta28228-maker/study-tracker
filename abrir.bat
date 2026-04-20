@echo off
title Estudos Concurso - Servidor
cd /d "%~dp0"

:: Libera a porta 3000 se estiver ocupada
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000 " ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
)

echo Iniciando servidor na porta 3000...
echo (Nao feche esta janela enquanto estiver usando o site)
echo.

:: Inicia o servidor em background e abre o navegador depois de 2 segundos
start /b npx -y serve -l 3000 .
timeout /t 3 /nobreak >nul
start "" http://localhost:3000/estudo-concurso.html

:: Mantém a janela aberta
echo.
echo Servidor rodando. Pressione qualquer tecla para encerrar...
pause >nul
taskkill /F /IM node.exe >nul 2>&1
