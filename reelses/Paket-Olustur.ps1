# Tek dosyalik kurulum programi (ReelSes-Kurulum.exe) uretir. Windows'un kendi IExpress aracini kullanir.
$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
$src = $PSScriptRoot
try {
    $iex = Join-Path $env:WINDIR 'System32\iexpress.exe'
    if (-not (Test-Path -LiteralPath $iex)) { throw 'IExpress (iexpress.exe) bulunamadı.' }
    $work = Join-Path $env:TEMP ('reelses-paket-' + [guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Force -Path $work | Out-Null
    $exe = Join-Path $src 'ReelSes-Kurulum.exe'
    if (Test-Path -LiteralPath $exe) { Remove-Item -LiteralPath $exe -Force }

    # 1) programi zip'le (Paket-Olustur ve eski cikti haric)
    $stage = Join-Path $work 'icerik'
    New-Item -ItemType Directory -Force -Path $stage | Out-Null
    Get-ChildItem -LiteralPath $src -Force | Where-Object {
        $_.Name -notmatch '^(Paket-Olustur|ReelSes-Kurulum|ayarlar|onay|bin$|Indirilenler|kayit)'
    } | ForEach-Object { Copy-Item -LiteralPath $_.FullName -Destination $stage -Recurse -Force }
    Compress-Archive -Path (Join-Path $stage '*') -DestinationPath (Join-Path $work 'paket.zip') -Force

    # 2) IExpress'in calistiracagi kucuk betik
    $cmd = '@echo off' + "`r`n" + 'powershell -NoProfile -ExecutionPolicy Bypass -Command "$d=Join-Path $env:TEMP ''ReelSesKurulum''; if (Test-Path $d) { Remove-Item $d -Recurse -Force }; Expand-Archive -LiteralPath ''paket.zip'' -DestinationPath $d -Force; & (Join-Path $d ''Kur.ps1'')"' + "`r`n"
    [System.IO.File]::WriteAllText((Join-Path $work 'Kur-ici.cmd'), $cmd, (New-Object System.Text.UTF8Encoding($false)))

    # 3) IExpress yonerge dosyasi
    $sed = @"
[Version]
Class=IEXPRESS
SEDVersion=3
[Options]
PackagePurpose=InstallApp
ShowInstallProgramWindow=0
HideExtractAnimation=1
UseLongFileName=1
InsideCompressed=0
CAB_FixedSize=0
CAB_ResvCodeSigning=0
RebootMode=N
InstallPrompt=%InstallPrompt%
DisplayLicense=%DisplayLicense%
FinishMessage=%FinishMessage%
TargetName=%TargetName%
FriendlyName=%FriendlyName%
AppLaunched=%AppLaunched%
PostInstallCmd=%PostInstallCmd%
AdminQuietInstCmd=%AdminQuietInstCmd%
UserQuietInstCmd=%UserQuietInstCmd%
SourceFiles=SourceFiles
[Strings]
InstallPrompt=
DisplayLicense=
FinishMessage=
TargetName=$exe
FriendlyName=Reel Ses Kurulum
AppLaunched=cmd /c Kur-ici.cmd
PostInstallCmd=<None>
AdminQuietInstCmd=
UserQuietInstCmd=
FILE0="paket.zip"
FILE1="Kur-ici.cmd"
[SourceFiles]
SourceFiles0=$work\
[SourceFiles0]
%FILE0%=
%FILE1%=
"@
    $sedPath = Join-Path $work 'paket.sed'
    [System.IO.File]::WriteAllText($sedPath, $sed, [System.Text.Encoding]::ASCII)

    Write-Host 'Paket oluşturuluyor (IExpress)...'
    $p = Start-Process -FilePath $iex -ArgumentList "/N /Q `"$sedPath`"" -Wait -PassThru -WindowStyle Hidden
    if (-not (Test-Path -LiteralPath $exe)) { throw 'IExpress paketi oluşturamadı. Bunun yerine Kur.bat ile kurabilirsin.' }
    $h = (Get-FileHash -Algorithm SHA256 -LiteralPath $exe).Hash.ToLower()
    [System.IO.File]::WriteAllText("$exe.sha256", "$h  ReelSes-Kurulum.exe`r`n", (New-Object System.Text.UTF8Encoding($false)))
    Write-Host ''
    Write-Host "Hazır: $exe" -ForegroundColor Green
    Write-Host "SHA-256: $h"
    Write-Host 'Not: Bu dosya imzasızdır; Windows SmartScreen "bilinmeyen yayıncı" uyarısı gösterebilir (Daha fazla bilgi > Yine de çalıştır).'
}
catch {
    Write-Host ('HATA: ' + $_.Exception.Message) -ForegroundColor Red
}
finally {
    if ($work) { Remove-Item -LiteralPath $work -Recurse -Force -ErrorAction SilentlyContinue }
}
