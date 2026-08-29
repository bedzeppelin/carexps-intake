<#
.SYNOPSIS
    Installs the CareXPS intake desk service on the clinic PC.

.DESCRIPTION
    Run once, from an elevated PowerShell prompt, in the desk-service folder:

        .\install.ps1 -OutputDir "C:\Users\Clinic\OneDrive - Clinic\Patient Forms"

    It generates the HTTPS certificate the tablets will trust, issues a token
    for the first tablet, opens the firewall to the local subnet only,
    registers the service to start automatically, and prints the URL to set as
    each tablet's home page.

    Later, to add another tablet:   .\install.ps1 -AddTablet "Front desk 2"
    To remove everything:           .\install.ps1 -Uninstall

.NOTES
    The service runs at logon as the current user rather than as a Windows
    service under SYSTEM. That is deliberate: OneDrive only syncs while its
    user is signed in, so a service running before login would file PDFs that
    sit unsynced anyway, and this avoids storing service credentials.
#>
[CmdletBinding()]
param(
    [string] $OutputDir,
    [int]    $Port = 8443,
    [string] $AddTablet,
    [switch] $Uninstall
)

$ErrorActionPreference = 'Stop'
$ServiceName = 'CareXPS Intake Desk Service'
$Root        = Split-Path -Parent $MyInvocation.MyCommand.Path
$ConfigPath  = Join-Path $Root 'config.json'
$CertDir     = Join-Path $Root 'certs'

function Write-Step($text) { Write-Host "`n==> $text" -ForegroundColor Cyan }
function Write-Ok($text)   { Write-Host "    $text" -ForegroundColor Green }
function Write-Warn2($text){ Write-Host "    $text" -ForegroundColor Yellow }

function Assert-Admin {
    $id = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($id)
    if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        throw "Please run this from an elevated PowerShell window (right-click PowerShell, Run as administrator)."
    }
}

function New-DeviceToken {
    $bytes = New-Object byte[] 24
    [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    return ([Convert]::ToBase64String($bytes) -replace '[^A-Za-z0-9]', '').Substring(0, 28)
}

function Get-LanAddresses {
    Get-NetIPAddress -AddressFamily IPv4 |
        Where-Object { $_.IPAddress -ne '127.0.0.1' -and $_.PrefixOrigin -ne 'WellKnown' } |
        Select-Object -ExpandProperty IPAddress
}

function Read-Config {
    if (-not (Test-Path $ConfigPath)) { throw "config.json not found. Run install.ps1 -OutputDir <folder> first." }
    Get-Content $ConfigPath -Raw | ConvertFrom-Json
}

function Save-Config($cfg) {
    $cfg | ConvertTo-Json -Depth 8 | Out-File -FilePath $ConfigPath -Encoding utf8
}

function Show-TabletUrl($token, $port) {
    $addresses = @(Get-LanAddresses)
    Write-Host ""
    Write-Host "  Set this as the tablet's home page:" -ForegroundColor White
    foreach ($ip in $addresses) {
        Write-Host "      https://$ip`:$port/?mode=kiosk&t=$token" -ForegroundColor Yellow
    }
    Write-Host ""
    Write-Host "  Before the tablet will trust that address, install this file on it:" -ForegroundColor White
    Write-Host "      $(Join-Path $CertDir 'carexps-root.cer')" -ForegroundColor Yellow
    Write-Host "  (email it to the tablet, open it, and accept the certificate)" -ForegroundColor Gray
}

# ---------------------------------------------------------------- Uninstall
if ($Uninstall) {
    Assert-Admin
    Write-Step "Removing $ServiceName"
    schtasks /Delete /TN $ServiceName /F 2>$null | Out-Null
    Write-Ok "Scheduled task removed."
    Remove-NetFirewallRule -DisplayName $ServiceName -ErrorAction SilentlyContinue
    Write-Ok "Firewall rule removed."
    Write-Warn2 "config.json, certificates, logs and any queued submissions were left in place."
    Write-Warn2 "Delete $Root by hand once you are sure nothing is still queued."
    return
}

# --------------------------------------------------------------- Add tablet
if ($AddTablet) {
    $cfg = Read-Config
    $token = New-DeviceToken
    $cfg.deviceTokens = @($cfg.deviceTokens) + $token
    Save-Config $cfg
    Write-Step "Issued a token for '$AddTablet'"
    Show-TabletUrl $token $cfg.port
    Write-Warn2 "Restart the service so it picks up the new token:"
    Write-Warn2 "    schtasks /End /TN `"$ServiceName`" ; schtasks /Run /TN `"$ServiceName`""
    return
}

# ----------------------------------------------------------------- Install
Assert-Admin

if (-not $OutputDir) {
    Write-Host "Where should finished intake PDFs be saved?" -ForegroundColor White
    Write-Host "This must be a folder inside your synced OneDrive, for example:" -ForegroundColor Gray
    Write-Host "    C:\Users\Clinic\OneDrive - Clinic\Patient Forms" -ForegroundColor Gray
    $OutputDir = Read-Host "Folder"
}
if (-not (Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
    Write-Ok "Created $OutputDir"
}
# Prove we can actually write there before promising anything to a tablet.
$probe = Join-Path $OutputDir ".carexps-write-test"
try {
    Set-Content -Path $probe -Value 'ok' -Encoding utf8
    Remove-Item $probe -Force
} catch {
    throw "Cannot write to $OutputDir. Pick a folder this account owns."
}
Write-Ok "Output folder is writable."

Write-Step "Checking how the service will run"
$ExePath = Join-Path $Root 'carexps-desk-service.exe'
$Packaged = Test-Path $ExePath
if ($Packaged) {
    # The packaged build carries its own Node runtime, so the clinic PC needs
    # nothing installed first.
    Write-Ok "Found carexps-desk-service.exe - nothing else to install."
} else {
    $node = Get-Command node -ErrorAction SilentlyContinue
    if (-not $node) {
        throw "This folder has no carexps-desk-service.exe, so Node.js 20 or newer is needed to run from source. Install the LTS build from https://nodejs.org, or use the packaged build instead."
    }
    $nodeVersion = (& node --version).TrimStart('v').Split('.')[0]
    if ([int]$nodeVersion -lt 20) { throw "Node.js 20 or newer is required (found v$nodeVersion)." }
    Write-Ok "Running from source with Node $(& node --version)."

    Write-Step "Installing dependencies"
    Push-Location $Root
    & npm install --omit=dev --no-audit --no-fund | Out-Null
    Pop-Location
    Write-Ok "Dependencies installed."
}

Write-Step "Creating the HTTPS certificate"
New-Item -ItemType Directory -Path $CertDir -Force | Out-Null
$dnsNames = @($env:COMPUTERNAME, "$env:COMPUTERNAME.local", 'localhost') + (Get-LanAddresses)
$cert = New-SelfSignedCertificate `
    -Subject "CN=CareXPS Intake Desk Service" `
    -DnsName $dnsNames `
    -CertStoreLocation 'Cert:\LocalMachine\My' `
    -KeyExportPolicy Exportable `
    -KeyUsage DigitalSignature, KeyEncipherment `
    -KeyAlgorithm RSA -KeyLength 2048 `
    -NotAfter (Get-Date).AddYears(5)

$pfxPassword = New-DeviceToken
$pfxPath = Join-Path $CertDir 'desk-service.pfx'
$securePwd = ConvertTo-SecureString -String $pfxPassword -Force -AsPlainText
Export-PfxCertificate -Cert $cert -FilePath $pfxPath -Password $securePwd | Out-Null
Export-Certificate -Cert $cert -FilePath (Join-Path $CertDir 'carexps-root.cer') | Out-Null

# Trusting it locally stops the PC's own browser warning when staff check
# the health page.
$store = New-Object Security.Cryptography.X509Certificates.X509Store 'Root', 'LocalMachine'
$store.Open('ReadWrite'); $store.Add($cert); $store.Close()
Write-Ok "Certificate created for: $($dnsNames -join ', ')"

Write-Step "Writing config.json"
$token = New-DeviceToken
$config = [ordered]@{
    port          = $Port
    bindAddress   = '0.0.0.0'
    outputDir     = $OutputDir
    spoolDir      = './spool'
    logDir        = './logs'
    tls           = [ordered]@{ pfxPath = './certs/desk-service.pfx'; passphrase = $pfxPassword }
    deviceTokens  = @($token)
    alembico      = [ordered]@{ enabled = $false; baseUrl = ''; apiKey = '' }
    clinicName    = 'CareXPS Urgent Care'
}
$config | ConvertTo-Json -Depth 8 | Out-File -FilePath $ConfigPath -Encoding utf8
# config.json holds the certificate passphrase and tablet tokens, so keep it
# readable only by administrators and this account.
icacls $ConfigPath /inheritance:r /grant:r "$($env:USERNAME):(R,W)" "Administrators:(F)" | Out-Null
Write-Ok "config.json written and locked down."

Write-Step "Opening the firewall (local subnet only)"
Remove-NetFirewallRule -DisplayName $ServiceName -ErrorAction SilentlyContinue
New-NetFirewallRule -DisplayName $ServiceName `
    -Direction Inbound -Action Allow -Protocol TCP -LocalPort $Port `
    -RemoteAddress LocalSubnet -Profile Private, Domain | Out-Null
Write-Ok "Port $Port open to the clinic network only (not the internet)."

Write-Step "Registering the service to start at logon"
if ($Packaged) {
    $action = New-ScheduledTaskAction -Execute $ExePath -WorkingDirectory $Root
} else {
    $serverJs = Join-Path $Root 'src\server.js'
    $action = New-ScheduledTaskAction -Execute $node.Source -Argument "`"$serverJs`"" -WorkingDirectory $Root
}
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
    -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) `
    -ExecutionTimeLimit (New-TimeSpan -Seconds 0) `
    -StartWhenAvailable
Unregister-ScheduledTask -TaskName $ServiceName -Confirm:$false -ErrorAction SilentlyContinue
Register-ScheduledTask -TaskName $ServiceName -Action $action -Trigger $trigger `
    -Settings $settings -RunLevel Limited -Description 'Receives patient intake forms from clinic tablets and files them as PDFs.' | Out-Null
Write-Ok "Registered. It will start automatically each time you sign in."

Write-Step "Starting it now"
Start-ScheduledTask -TaskName $ServiceName
Start-Sleep -Seconds 3
try {
    # The token is required for the detailed answer; without it the endpoint
    # only confirms it is alive, which is all an unauthenticated caller gets.
    $health = Invoke-RestMethod -Uri "https://localhost:$Port/api/health" -TimeoutSec 5 `
        -Headers @{ Authorization = "Bearer $token" }
    Write-Ok "Service is running. Queued submissions: $($health.pendingSubmissions)"
} catch {
    Write-Warn2 "Could not reach the health endpoint yet. Check $Root\logs for details."
}

Write-Host ""
Write-Host "  Done." -ForegroundColor Green
Show-TabletUrl $token $Port
Write-Host "  Check it is alive any time:  https://localhost:$Port/api/health" -ForegroundColor Gray
Write-Host "  (add the tablet URL's token as a Bearer header for the detailed answer)" -ForegroundColor Gray
Write-Host ""
