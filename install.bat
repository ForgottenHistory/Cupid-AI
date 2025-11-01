@echo off
echo ========================================
echo    Cupid AI - Installation Script
echo ========================================
echo.

echo [1/3] Installing backend dependencies...
cd backend
if not exist "node_modules" (
    call npm install
    if errorlevel 1 (
        echo ERROR: Backend installation failed!
        pause
        exit /b 1
    )
    echo Backend dependencies installed successfully!
) else (
    echo Backend dependencies already installed (skipping)
)
echo.

echo [2/3] Installing frontend dependencies...
cd ..\frontend
if not exist "node_modules" (
    call npm install
    if errorlevel 1 (
        echo ERROR: Frontend installation failed!
        pause
        exit /b 1
    )
    echo Frontend dependencies installed successfully!
) else (
    echo Frontend dependencies already installed (skipping)
)
echo.

echo [3/3] Checking environment configuration...
cd ..\backend
if not exist ".env" (
    echo WARNING: .env file not found!
    echo.
    echo Please copy .env.example to .env and configure your API keys:
    echo   1. Copy backend\.env.example to backend\.env
    echo   2. Set your OPENROUTER_API_KEY
    echo   3. ^(Optional^) Set FEATHERLESS_API_KEY
    echo   4. ^(Optional^) Configure SD_SERVER_URL for images
    echo.
) else (
    echo .env file found!
)

cd ..
echo.
echo ========================================
echo    Installation Complete!
echo ========================================
echo.
echo Next steps:
echo   1. Configure backend\.env with your API keys (if not done)
echo   2. Run run_backend.bat in one terminal
echo   3. Run run_frontend.bat in another terminal
echo   4. Open http://localhost:5173 in your browser
echo.
pause
