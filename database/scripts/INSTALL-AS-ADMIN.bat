@echo off
:: Avvia installazione SQL Server CredixaDev con privilegi amministratore
powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process powershell -Verb RunAs -ArgumentList '-NoProfile -ExecutionPolicy Bypass -File ""%~dp0install-sql-server.ps1""' -Wait"
pause
