@echo off
echo Starting Cupid AI Frontend...
echo.
echo Frontend will be available at: http://localhost:5173
echo Opening browser in 3 seconds...
echo.

cd frontend

REM Wait 3 seconds then open browser in background
start "" cmd /c "timeout /t 3 /nobreak >nul && start http://localhost:5173"

REM Start the dev server
npm run dev
