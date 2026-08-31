#Requires -RunAsAdministrator
<#
  Installazione SQL Server 2022 Developer + SSMS per CredixaDev
  Istanza: CREDIXA_DEV | Database: CredixaDev | Porta TCP: 1433 | Max memory: 3584 MB
#>
$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$Staging = "C:\CredixaSQL"
$Media = Join-Path $Staging "Media"
$Log = Join-Path $Staging "logs"
New-Item -ItemType Directory -Force -Path $Media, $Log | Out-Null

# Password generate (salvate in file locale gitignored)
$SaPassword = -join ((48..57 + 65..90 + 97..122 | Get-Random -Count 20 | ForEach-Object { [char]$_ })) + "!"
$AppPassword = -join ((48..57 + 65..90 + 97..122 | Get-Random -Count 16 | ForEach-Object { [char]$_ })) + "1!"

$secretsPath = Join-Path $PSScriptRoot ".install-secrets.local.json"
@{
  saPassword = $SaPassword
  credixaDevPassword = $AppPassword
  instance = "CREDIXA_DEV"
  database = "CredixaDev"
  port = 1433
  maxMemoryMb = 3584
  installedAt = (Get-Date).ToString("o")
} | ConvertTo-Json | Set-Content -Path $secretsPath -Encoding UTF8

Write-Host "=== Credixa SQL Server 2022 Developer ===" -ForegroundColor Cyan

# 1) Download bootstrapper Developer Edition
$bootstrapper = Join-Path $Staging "SQL2022-SSEI-Dev.exe"
if (-not (Test-Path $bootstrapper)) {
  Write-Host "Download SQL2022-SSEI-Dev.exe..."
  Invoke-WebRequest -Uri "https://download.microsoft.com/download/c/c/9/cc9c6797-383c-4b24-8920-dc057c1de9d3/SQL2022-SSEI-Dev.exe" -OutFile $bootstrapper -UseBasicParsing
}

# 2) Download media (offline installer)
$setupExe = $null
if (-not (Test-Path (Join-Path $Media "setup.exe"))) {
  Write-Host "Download media SQL Server (puo richiedere diversi minuti)..."
  $dlArgs = "/ACTION=Download /MEDIAPATH=`"$Media`" /MEDIATYPE=Advanced /QUIET /IACCEPTSQLSERVERLICENSETERMS=True"
  $p = Start-Process -FilePath $bootstrapper -ArgumentList $dlArgs -Wait -PassThru -NoNewWindow
  if ($p.ExitCode -ne 0) {
    Write-Warning "Download media exit=$($p.ExitCode) - tentativo installazione diretta dal bootstrapper..."
  }
}

$setupExe = Get-ChildItem -Path $Media -Recurse -Filter "setup.exe" -ErrorAction SilentlyContinue | Select-Object -First 1

$existing = Get-Service -Name "MSSQL`$CREDIXA_DEV" -ErrorAction SilentlyContinue
if (-not $existing -and -not $setupExe) {
  Write-Host "Installazione diretta SQL2022-SSEI-Dev (download + setup)..."
  $directArgs = @(
    "/ACTION=Install",
    "/MEDIATYPE=Advanced",
    "/QUIET",
    "/IACCEPTSQLSERVERLICENSETERMS=True",
    "/INSTANCENAME=CREDIXA_DEV",
    "/INSTANCEID=CREDIXA_DEV",
    "/FEATURES=SQLENGINE",
    "/SECURITYMODE=SQL",
    "/SAPWD=$SaPassword",
    "/SQLSYSADMINACCOUNTS=`"BUILTIN\Administrators`"",
    "/TCPENABLED=1",
    "/NPENABLED=0",
    "/BROWSERSVCSTARTUPTYPE=Automatic",
    "/SQLMAXMEMORY=3584",
    "/SQLMINMEMORY=256",
    "/UpdateEnabled=False"
  ) -join " "
  $p = Start-Process -FilePath $bootstrapper -ArgumentList $directArgs -Wait -PassThru -NoNewWindow
  if ($p.ExitCode -ne 0 -and $p.ExitCode -ne 3010) {
    throw "Installazione diretta fallita exit=$($p.ExitCode)"
  }
  Start-Sleep -Seconds 15
  $existing = Get-Service -Name "MSSQL`$CREDIXA_DEV" -ErrorAction SilentlyContinue
  $setupExe = Get-ChildItem -Path $Media -Recurse -Filter "setup.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
}
if (-not $setupExe -and -not (Get-Service -Name "MSSQL`$CREDIXA_DEV" -ErrorAction SilentlyContinue)) {
  throw "setup.exe non trovato e istanza non installata"
}

# 3) Configuration file silent install
$configIni = Join-Path $Staging "ConfigurationFile.ini"
@"

; CredixaDev SQL Server 2022 Developer
[OPTIONS]
ACTION=Install
FEATURES=SQLENGINE
INSTANCENAME=CREDIXA_DEV
INSTANCEID=CREDIXA_DEV
SQLSVCINSTANTFILEINIT=True
SQLSYSADMINACCOUNTS=BUILTIN\Administrators
SECURITYMODE=SQL
SAPWD=$SaPassword
TCPENABLED=1
NPENABLED=0
BROWSERSVCSTARTUPTYPE=Automatic
SQLMAXMEMORY=3584
SQLMINMEMORY=256
IACCEPTSQLSERVERLICENSETERMS=True
QUIET=True
UpdateEnabled=False
USEMICROSOFTUPDATE=False
"@ | Set-Content -Path $configIni -Encoding ASCII

$existing = Get-Service -Name "MSSQL`$CREDIXA_DEV" -ErrorAction SilentlyContinue
if (-not $existing -and $setupExe) {
  Write-Host "Installazione istanza CREDIXA_DEV da setup.exe..."
  $p = Start-Process -FilePath $setupExe.FullName -ArgumentList "/ConfigurationFile=`"$configIni`"" -Wait -PassThru -NoNewWindow
  if ($p.ExitCode -ne 0 -and $p.ExitCode -ne 3010) {
    throw "Installazione SQL fallita exit=$($p.ExitCode)"
  }
  Start-Sleep -Seconds 15
  $existing = Get-Service -Name "MSSQL`$CREDIXA_DEV" -ErrorAction SilentlyContinue
}

if (-not $existing) {
  throw "Servizio MSSQL`$CREDIXA_DEV non trovato dopo installazione"
}
Write-Host "Istanza CREDIXA_DEV attiva."

# 4) Porta TCP statica 1433
$tcpKey = "HKLM:\SOFTWARE\Microsoft\Microsoft SQL Server\MSSQL16.CREDIXA_DEV\MSSQLServer\SuperSocketNetLib\Tcp\IPAll"
if (Test-Path $tcpKey) {
  Set-ItemProperty -Path $tcpKey -Name "TcpDynamicPorts" -Value ""
  Set-ItemProperty -Path $tcpKey -Name "TcpPort" -Value "1433"
  Write-Host "Porta TCP impostata a 1433"
}

Restart-Service -Name "MSSQL`$CREDIXA_DEV" -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 5

# 5) Max server memory (fallback via sql)
$sqlcmd = Get-ChildItem "C:\Program Files\Microsoft SQL Server\Client SDK\ODBC\*\Tools\Binn\SQLCMD.EXE" -ErrorAction SilentlyContinue |
  Sort-Object FullName -Descending | Select-Object -First 1
if (-not $sqlcmd) {
  $sqlcmd = Get-ChildItem "C:\Program Files\Microsoft SQL Server\*\Tools\Binn\SQLCMD.EXE" -ErrorAction SilentlyContinue |
    Select-Object -First 1
}

if ($sqlcmd) {
  & $sqlcmd.FullName -S "localhost\CREDIXA_DEV" -U sa -P $SaPassword -Q "EXEC sp_configure 'show advanced options', 1; RECONFIGURE; EXEC sp_configure 'max server memory (MB)', 3584; RECONFIGURE;" -b
  Write-Host "Max server memory = 3584 MB"
}

# 6) SSMS
$ssmsInstaller = Join-Path $Staging "SSMS-Setup-ENU.exe"
if (-not (Get-ItemProperty "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*" -ErrorAction SilentlyContinue |
    Where-Object { $_.DisplayName -like "*SQL Server Management Studio*" })) {
  if (-not (Test-Path $ssmsInstaller)) {
    Write-Host "Download SSMS..."
    Invoke-WebRequest -Uri "https://aka.ms/ssmsfullsetup" -OutFile $ssmsInstaller -UseBasicParsing
  }
  Write-Host "Installazione SSMS..."
  $p = Start-Process -FilePath $ssmsInstaller -ArgumentList "/install /quiet /norestart" -Wait -PassThru
  if ($p.ExitCode -ne 0 -and $p.ExitCode -ne 3010) {
    Write-Warning "SSMS install exit=$($p.ExitCode) - verificare manualmente"
  }
} else {
  Write-Host "SSMS gia installato."
}

# 7) Database CredixaDev + login credixa_dev
$createDbSql = Join-Path $PSScriptRoot "000_create_database.sql"
$createDbContent = Get-Content $createDbSql -Raw
$createDbContent = $createDbContent -replace "ChangeMe_CredixaDev!", [regex]::Escape($AppPassword)

$tempSql = Join-Path $Staging "000_create_database.runtime.sql"
Set-Content -Path $tempSql -Value $createDbContent -Encoding UTF8

if ($sqlcmd) {
  & $sqlcmd.FullName -S "localhost,1433" -U sa -P $SaPassword -i $tempSql -b
  Write-Host "Database CredixaDev e login credixa_dev creati."
}

# 8) Scrivi connector/.env
$connectorEnv = Join-Path $Root "connector\.env"
@"

CONNECTOR_PORT=8443
DB_HOST=localhost
DB_PORT=1433
DB_INSTANCE=CREDIXA_DEV
DB_NAME=CredixaDev
DB_USER=credixa_dev
DB_PASSWORD=$AppPassword
CREDIXA_TENANT_ID=demo
CONNECTOR_API_KEY=
"@ | Set-Content -Path $connectorEnv -Encoding UTF8

# 9) Root .env SQL vars (append if missing)
$rootEnv = Join-Path $Root ".env"
$sqlBlock = @"

# --- SQL Server CredixaDev (locale) ---
DB_HOST=localhost
DB_PORT=1433
DB_INSTANCE=CREDIXA_DEV
DB_NAME=CredixaDev
DB_USER=credixa_dev
DB_PASSWORD=$AppPassword
DATABASE_PROVIDER=firestore
"@

if (Test-Path $rootEnv) {
  $content = Get-Content $rootEnv -Raw
  if ($content -notmatch "DB_NAME=CredixaDev") {
    Add-Content -Path $rootEnv -Value $sqlBlock
  }
} else {
  Set-Content -Path $rootEnv -Value $sqlBlock.TrimStart()
}

Write-Host ""
Write-Host "=== Installazione completata ===" -ForegroundColor Green
Write-Host "Istanza: localhost\CREDIXA_DEV (TCP 1433)"
Write-Host "Database: CredixaDev"
Write-Host "Login app: credixa_dev"
Write-Host "Password salvate in: $secretsPath"
Write-Host "Connector .env: $connectorEnv"
