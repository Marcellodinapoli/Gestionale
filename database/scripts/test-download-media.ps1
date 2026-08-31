#Requires -RunAsAdministrator
$log = "C:\CredixaSQL\logs\download-test.log"
$Media = "C:\CredixaSQL\Media"
New-Item -ItemType Directory -Force -Path $Media, (Split-Path $log) | Out-Null

"=== $(Get-Date) ===" | Out-File $log
$bootstrapper = "C:\CredixaSQL\SQL2022-SSEI-Dev.exe"

foreach ($type in @("Core", "Advanced", "Full")) {
  "Trying MEDIATYPE=$type" | Out-File $log -Append
  $args = "/ACTION=Download /MEDIAPATH=`"$Media`" /MEDIATYPE=$type /QUIET /IACCEPTSQLSERVERLICENSETERMS=True"
  "Args: $args" | Out-File $log -Append
  $p = Start-Process -FilePath $bootstrapper -ArgumentList $args -Wait -PassThru -NoNewWindow
  "Exit: $($p.ExitCode)" | Out-File $log -Append
  $setup = Get-ChildItem $Media -Recurse -Filter setup.exe -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($setup) {
    "SUCCESS setup.exe at $($setup.FullName)" | Out-File $log -Append
    break
  }
}

Get-ChildItem $Media -Recurse -ErrorAction SilentlyContinue | Select-Object FullName | Out-File $log -Append
Get-ChildItem "C:\Program Files\Microsoft SQL Server\160\Setup Bootstrap\Log" -ErrorAction SilentlyContinue |
  Sort-Object LastWriteTime -Descending | Select-Object -First 3 FullName | Out-File $log -Append
