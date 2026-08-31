# Wrapper install — scrive log in C:\CredixaSQL\logs\install.log
$logDir = "C:\CredixaSQL\logs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$log = Join-Path $logDir "install.log"
Start-Transcript -Path $log -Force | Out-Null

try {
  & "C:\FlutterProjects\Gestionale\database\scripts\install-sql-server.ps1"
  Write-Host "INSTALL_EXIT=0"
} catch {
  Write-Host "INSTALL_ERROR: $_"
  Write-Host "INSTALL_EXIT=1"
  throw
} finally {
  Stop-Transcript | Out-Null
}
