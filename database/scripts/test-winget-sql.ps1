#Requires -RunAsAdministrator
$log = "C:\CredixaSQL\logs\winget-install.log"
"=== $(Get-Date) winget install ===" | Out-File $log
$winget = "$env:LOCALAPPDATA\Microsoft\WindowsApps\winget.exe"
$p = Start-Process -FilePath $winget -ArgumentList @(
  "install","Microsoft.SQLServer.2022.Developer",
  "--accept-package-agreements","--accept-source-agreements","--disable-interactivity"
) -Wait -PassThru -NoNewWindow -RedirectStandardOutput "$log.out" -RedirectStandardError "$log.err"
"Exit: $($p.ExitCode)" | Out-File $log -Append
Get-Content "$log.out" -ErrorAction SilentlyContinue | Out-File $log -Append
Get-Content "$log.err" -ErrorAction SilentlyContinue | Out-File $log -Append
Get-Service "MSSQL*" -ErrorAction SilentlyContinue | Format-Table Name, Status | Out-File $log -Append
