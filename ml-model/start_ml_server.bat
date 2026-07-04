@echo off
setlocal
cd /d "%~dp0"
title FarmSense ML API
echo.
echo  Keep this window open while Node-RED is running.
echo  API: http://127.0.0.1:5000/health
echo  Node-RED must match this port (default 5000).
echo.
if not exist "models\clr_risk_model.pkl" (
  echo Model files missing — running train_model.py ...
  python train_model.py
  if errorlevel 1 (
    echo Training failed. Fix errors above.
    pause
    exit /b 1
  )
)
python app.py
if errorlevel 1 pause
