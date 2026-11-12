# Reel Ses - kurulum (kullanici hesabina kurar, yonetici izni gerekmez)
param([string]$Hedef = (Join-Path $env:LOCALAPPDATA 'ReelSes'), [switch]$Kabul)
$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
$src = $PSScriptRoot
$surum = 'v4'

try {
    Write-Host ''
    Write-Host '=== Reel Ses kurulumu ===' -ForegroundColor Green
    Write-Host ''
    if (-not $Kabul) {
        Write-Host 'Kurmadan önce YASAL-NOT.txt dosyasını oku (şimdi gösteriliyor):' -ForegroundColor Yellow
        Write-Host ''
        Get-Content -LiteralPath (Join-Path $src 'YASAL-NOT.txt') -Encoding UTF8 | Select-Object -First 60 | ForEach-Object { Write-Host $_ }
        Write-Host '... (devamı için YASAL-NOT.txt dosyasını aç)' -ForegroundColor DarkGray
        Write-Host ''
        $a = Read-Host 'Yasal notu okudum, kabul ediyorum ve aracı yalnızca kişisel kullanım için kuracağım (E/H)'
        if ($a -notmatch '^[eEyY]') { throw 'Yasal not kabul edilmedi, kurulum iptal edildi.' }
    }

    New-Item -ItemType Directory -Force -Path $Hedef | Out-Null
    Write-Host "Kurulum klasörü: $Hedef"

    # eski program dosyalarini yenile; kullanici verisine (ayarlar, bin, Indirilenler, kayit) dokunma
    $webDst = Join-Path $Hedef 'web'
    if (Test-Path -LiteralPath $webDst) { Remove-Item -LiteralPath $webDst -Recurse -Force }
    $dosyalar = 'Baslat.bat','Telefon-Sunucu.bat','Telefon-Sunucu-Arka-Plan.bat','ReelSes.ps1','Sunucu.ps1','Ortak.ps1','qr.js','reelses.ico','YASAL-NOT.txt','BENI-OKU.txt','Kaldir.ps1','web'
    foreach ($d in $dosyalar) {
        $p = Join-Path $src $d
        if (Test-Path -LiteralPath $p) { Copy-Item -LiteralPath $p -Destination $Hedef -Recurse -Force }
        else { Write-Host "Uyarı: $d pakette yok, atlandı." -ForegroundColor Yellow }
    }
    Get-ChildItem -LiteralPath $Hedef -Recurse -File | Unblock-File -ErrorAction SilentlyContinue

    # kisayollar
    $ws = New-Object -ComObject WScript.Shell
    $ico = Join-Path $Hedef 'reelses.ico'
    $menu = Join-Path ([Environment]::GetFolderPath('Programs')) 'Reel Ses'
    New-Item -ItemType Directory -Force -Path $menu | Out-Null
    function Yap($yol, $hedef, $arg, $ad) {
        $s = $ws.CreateShortcut($yol)
        $s.TargetPath = $hedef
        $s.Arguments = $arg
        $s.WorkingDirectory = $Hedef
        $s.IconLocation = $ico
        $s.Description = $ad
        $s.Save()
    }
    $ps = 'powershell.exe'
    $argApp  = '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "' + (Join-Path $Hedef 'ReelSes.ps1') + '"'
    $argSrv  = '/c "' + (Join-Path $Hedef 'Telefon-Sunucu.bat') + '"'
    $argBg   = '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "' + (Join-Path $Hedef 'Sunucu.ps1') + '" -Arka'
    $argDel  = '-NoProfile -ExecutionPolicy Bypass -File "' + (Join-Path $Hedef 'Kaldir.ps1') + '"'
    Yap (Join-Path $menu 'Reel Ses.lnk') $ps $argApp 'Reel Ses'
    Yap (Join-Path $menu 'Reel Ses Telefon Sunucusu.lnk') 'cmd.exe' $argSrv 'Telefon sunucusu (pencereli)'
    Yap (Join-Path $menu 'Reel Ses Telefon Sunucusu (arka plan).lnk') $ps $argBg 'Telefon sunucusu (arka plan, tepsi simgesi)'
    Yap (Join-Path $menu 'Reel Ses Kaldır.lnk') $ps $argDel 'Reel Ses programını kaldır'
    $m = Read-Host 'Masaüstüne "Reel Ses" kısayolu eklensin mi? (E/H, varsayılan E)'
    if ($m -notmatch '^[hHnN]') {
        Yap (Join-Path ([Environment]::GetFolderPath('Desktop')) 'Reel Ses.lnk') $ps $argApp 'Reel Ses'
    }

    # Ayarlar > Uygulamalar listesinde gorunsun
    $k = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\ReelSes'
    New-Item -Path $k -Force | Out-Null
    Set-ItemProperty -Path $k -Name DisplayName -Value 'Reel Ses'
    Set-ItemProperty -Path $k -Name DisplayVersion -Value $surum
    Set-ItemProperty -Path $k -Name InstallLocation -Value $Hedef
    Set-ItemProperty -Path $k -Name DisplayIcon -Value $ico
    Set-ItemProperty -Path $k -Name UninstallString -Value ('powershell.exe ' + $argDel)
    Set-ItemProperty -Path $k -Name NoModify -Value 1 -Type DWord
    Set-ItemProperty -Path $k -Name NoRepair -Value 1 -Type DWord

    Write-Host ''
    Write-Host 'Kurulum tamam.' -ForegroundColor Green
    Write-Host 'Başlat menüsünde "Reel Ses" klasörüne bak. İlk açılışta yt-dlp ve ffmpeg indirilip doğrulanır.'
    $a = Read-Host 'Reel Ses şimdi açılsın mı? (E/H, varsayılan E)'
    if ($a -notmatch '^[hHnN]') { Start-Process $ps -ArgumentList $argApp }
}
catch {
    Write-Host ''
    Write-Host ('HATA: ' + $_.Exception.Message) -ForegroundColor Red
}
