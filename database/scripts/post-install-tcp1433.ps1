#Requires -RunAsAdministrator
# Post-install: porta TCP 1433 statica per CREDIXA_DEV
$tcpKey = "HKLM:\SOFTWARE\Microsoft\Microsoft SQL Server\MSSQL16.CREDIXA_DEV\MSSQLServer\SuperSocketNetLib\Tcp\IPAll"
if (Test-Path $tcpKey) {
  Set-ItemProperty -Path $tcpKey -Name "TcpDynamicPorts" -Value ""
  Set-ItemProperty -Path $tcpKey -Name "TcpPort" -Value "1433"
  Restart-Service "MSSQL`$CREDIXA_DEV" -Force
  Write-Host "Porta TCP 1433 configurata. Servizio riavviato."
} else {
  Write-Error "Chiave TCP non trovata: $tcpKey"
}
