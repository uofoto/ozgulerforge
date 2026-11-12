# Reel Ses - kaldirma
$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
$dir = $PSScriptRoot
try {
    Write-Host ''
    Write-Host '=== Reel Ses kaldırılıyor ===' -ForegroundColor Yellow
    Write-Host "Klasör: $dir"
    $a = Read-Host 'Devam edilsin mi? (E/H)'
    if ($a -notmatch '^[eEyY]') { return }

    # calisan sunucuyu kapat (bu klasorden calisan Sunucu.ps1 / ReelSes.ps1)
    Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" -ErrorAction SilentlyContinue |
        Where-Object { $_.ProcessId -ne $PID -and $_.CommandLine -and $_.CommandLine -like "*$dir*" } |
        ForEach-Object { try { Stop-Process -Id $_.ProcessId -Force } catch { } }

    $keep = $false
    $ind = Join-Path $dir 'Indirilenler'
    if (Test-Path -LiteralPath $ind) {
        $n = @(Get-ChildItem -LiteralPath $ind -File -ErrorAction SilentlyContinue).Count
        $b = Read-Host "İndirilenler klasöründe $n dosya var. Silinsin mi? (E/H, varsayılan H = dosyaları koru)"
        if ($b -notmatch '^[eEyY]') { $keep = $true }
    }

    # kisayollar, baslangic girdisi, kayit defteri
    Remove-Item -LiteralPath (Join-Path ([Environment]::GetFolderPath('Programs')) 'Reel Ses') -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath (Join-Path ([Environment]::GetFolderPath('Desktop')) 'Reel Ses.lnk') -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath (Join-Path ([Environment]::GetFolderPath('Startup')) 'Reel Ses Sunucu.lnk') -Force -ErrorAction SilentlyContinue
    Remove-Item -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\ReelSes' -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item -Path (Join-Path $env:TEMP 'reelses-jobs') -Recurse -Force -ErrorAction SilentlyContinue

    # klasoru temizle (Kaldir.ps1 ve korunacak klasor haric), sonra bu dosyayi gecikmeli sil
    Get-ChildItem -LiteralPath $dir -Force | Where-Object {
        $_.Name -ne 'Kaldir.ps1' -and -not ($keep -and $_.Name -eq 'Indirilenler')
    } | ForEach-Object { Remove-Item -LiteralPath $_.FullName -Recurse -Force -ErrorAction SilentlyContinue }
    Start-Process cmd.exe -ArgumentList ('/c timeout /t 3 /nobreak >nul & del /f /q "' + (Join-Path $dir 'Kaldir.ps1') + '" & rmdir "' + $dir + '"') -WindowStyle Hidden

    Write-Host ''
    Write-Host 'Reel Ses kaldırıldı.' -ForegroundColor Green
    if ($keep) { Write-Host "İndirilenler klasörü korundu: $ind" }
    Write-Host 'Not: Tailscale ayarını da temizlemek istersen komut satırında "tailscale serve reset" çalıştır.'
    Read-Host 'Kapatmak için Enter'
}
catch {
    Write-Host ('HATA: ' + $_.Exception.Message) -ForegroundColor Red
    Read-Host 'Kapatmak için Enter'
}
