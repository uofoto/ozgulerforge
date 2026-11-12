# Reel Ses - ortak fonksiyonlar (ReelSes.ps1 ve Sunucu.ps1 bunu kullanir)
# Arac kurulumu, saglama toplami (SHA-256) dogrulama, otomatik yt-dlp guncelleme, ayarlar.

$script:YtDlpBase    = 'https://github.com/yt-dlp/yt-dlp/releases'
$script:FfmpegBase   = 'https://github.com/yt-dlp/FFmpeg-Builds/releases/latest/download'
$script:FfmpegZip    = 'ffmpeg-master-latest-win64-gpl.zip'
$script:FfmpegSums   = 'checksums.sha256'
$script:OnayVersiyon = 'v1'
$script:IgRegex      = '^https://(www\.)?instagram\.com/([A-Za-z0-9_.]+/)?(share/)?(reel|reels|p|tv)/[A-Za-z0-9_-]+/?(\?[A-Za-z0-9_=&%.\-]*)?$'

# Instagram Reel/gonderi linki gecerli mi (sorgu kismi serbest, kapsam degiskenine bagli degil)
function Test-IgUrl([string]$u) {
    $u = $u.Trim()
    return [bool]($u -match '^https?://(www\.)?instagram\.com/([A-Za-z0-9_.]+/)?(share/)?(reel|reels|p|tv)/[A-Za-z0-9_-]+/?(\?\S*)?$')
}

function Get-Sha256([string]$path) {
    return (Get-FileHash -Algorithm SHA256 -LiteralPath $path).Hash.ToLower()
}

function Get-WebText([string]$url) {
    $wc = New-Object System.Net.WebClient
    try {
        $wc.Encoding = [System.Text.Encoding]::UTF8
        return [string]$wc.DownloadString($url)
    } finally { $wc.Dispose() }
}

# $onTick: istege bagli scriptblock, indirilen MB ile cagrilir (arayuz guncellemek icin)
function Save-Url([string]$url, [string]$path, $onTick) {
    $wc = New-Object System.Net.WebClient
    try {
        if ($onTick) {
            $task = $wc.DownloadFileTaskAsync($url, $path)
            while (-not $task.IsCompleted) {
                $mb = 0
                if (Test-Path -LiteralPath $path) { $mb = [math]::Round((Get-Item -LiteralPath $path).Length / 1MB, 1) }
                & $onTick $mb
                Start-Sleep -Milliseconds 200
            }
            if ($task.IsFaulted) { throw $task.Exception.InnerException }
        } else {
            $wc.DownloadFile($url, $path)
        }
    } finally { $wc.Dispose() }
}

# "hash  dosyaadi" bicimli ozet dosyasindan ilgili dosyanin hash'ini bulur
function Find-Hash([string]$sums, [string]$name) {
    foreach ($line in ($sums -split "`r?`n")) {
        if ($line -match '^\s*([0-9a-fA-F]{64})\s+\*?(.+?)\s*$') {
            $n = $Matches[2] -replace '^\./', ''
            if ($n -eq $name) { return $Matches[1].ToLower() }
        }
    }
    return $null
}

# ---- kayit dosyasi: bin\araclar.json (kurulumda dogrulanan hash'ler) ----
function Read-Records([string]$bin) {
    $p = Join-Path $bin 'araclar.json'
    $r = @{ ytdlp = ''; ytdlp_kontrol = ''; ffmpeg = ''; ffprobe = '' }
    if (Test-Path -LiteralPath $p) {
        try {
            $j = Get-Content -LiteralPath $p -Raw -Encoding UTF8 | ConvertFrom-Json
            foreach ($k in @($r.Keys)) {
                if ($j.PSObject.Properties[$k]) { $r[$k] = [string]$j.$k }
            }
        } catch { }
    }
    return $r
}

function Write-Records([string]$bin, $r) {
    $p = Join-Path $bin 'araclar.json'
    $json = ConvertTo-Json -InputObject $r
    [System.IO.File]::WriteAllText($p, $json, (New-Object System.Text.UTF8Encoding($false)))
}

function Set-YtDlpRecord([string]$bin, [string]$hash) {
    $r = Read-Records $bin
    $r['ytdlp'] = $hash
    $r['ytdlp_kontrol'] = (Get-Date).ToString('o')
    Write-Records $bin $r
}

function Test-UpdateDue([string]$bin, [int]$hours = 20) {
    $r = Read-Records $bin
    if (-not $r['ytdlp_kontrol']) { return $true }
    try {
        $t = [DateTimeOffset]::Parse($r['ytdlp_kontrol'], [Globalization.CultureInfo]::InvariantCulture)
        return (((Get-Date) - $t.LocalDateTime).TotalHours -ge $hours)
    } catch { return $true }
}

# yt-dlp'yi kurar veya gunceller. Her zaman yayinlanan SHA2-256SUMS ile dogrular.
# $pin bos degilse o surume sabitlenir (ornek: 2025.01.15).
# Donus: 'kuruldu' | 'guncellendi' | 'guncel'
function Update-YtDlp([string]$bin, [string]$pin, $onTick) {
    $exe = Join-Path $bin 'yt-dlp.exe'
    if ($pin) {
        if ($pin -notmatch '^[0-9A-Za-z._-]+$') { throw 'ayarlar.txt: ytdlp_surum geçersiz.' }
        $base = "$script:YtDlpBase/download/$pin"
    } else {
        $base = "$script:YtDlpBase/latest/download"
    }
    $sums = Get-WebText "$base/SHA2-256SUMS"
    $want = Find-Hash $sums 'yt-dlp.exe'
    if (-not $want) { throw 'yt-dlp sağlama toplamı (SHA2-256SUMS) bulunamadı; işlem iptal edildi.' }
    $had = Test-Path -LiteralPath $exe
    if ($had -and ((Get-Sha256 $exe) -eq $want)) {
        Set-YtDlpRecord $bin $want
        return 'guncel'
    }
    $new = "$exe.new"
    if (Test-Path -LiteralPath $new) { Remove-Item -LiteralPath $new -Force }
    Save-Url "$base/yt-dlp.exe" $new $onTick
    $got = Get-Sha256 $new
    if ($got -ne $want) {
        Remove-Item -LiteralPath $new -Force -ErrorAction SilentlyContinue
        throw 'İndirilen yt-dlp dosyasının sağlama toplamı uyuşmadı; kullanılmadı.'
    }
    Move-Item -LiteralPath $new -Destination $exe -Force
    Set-YtDlpRecord $bin $got
    if ($had) { return 'guncellendi' }
    return 'kuruldu'
}

# ffmpeg + ffprobe: zip'in hash'i yayinlanan checksums.sha256 ile dogrulanir, cikan exe'lerin hash'i kaydedilir.
# Bu surum sabit kalir; otomatik guncellenmez (guncellemek icin bin\ffmpeg.exe ve ffprobe.exe'yi sil).
function Install-Ffmpeg([string]$bin, $onTick) {
    $sums = Get-WebText "$script:FfmpegBase/$script:FfmpegSums"
    $want = Find-Hash $sums $script:FfmpegZip
    if (-not $want) { throw 'ffmpeg sağlama toplamı bulunamadı; doğrulanamayan dosya kurulmadı.' }
    $id   = [guid]::NewGuid().ToString('N')
    $zip  = Join-Path $env:TEMP "reelses-ffmpeg-$id.zip"
    $tmpd = Join-Path $env:TEMP "reelses-ffmpeg-$id"
    try {
        Save-Url "$script:FfmpegBase/$script:FfmpegZip" $zip $onTick
        if ((Get-Sha256 $zip) -ne $want) { throw 'İndirilen ffmpeg dosyasının sağlama toplamı uyuşmadı; kullanılmadı.' }
        Expand-Archive -LiteralPath $zip -DestinationPath $tmpd -Force
        $r = Read-Records $bin
        foreach ($n in @('ffmpeg', 'ffprobe')) {
            $f = Get-ChildItem -Path $tmpd -Recurse -Filter "$n.exe" | Select-Object -First 1
            if (-not $f) { throw "$n.exe zip içinde bulunamadı." }
            $dst = Join-Path $bin "$n.exe"
            Copy-Item -LiteralPath $f.FullName -Destination $dst -Force
            $r[$n] = Get-Sha256 $dst
        }
        Write-Records $bin $r
    } finally {
        Remove-Item -LiteralPath $zip -Force -ErrorAction SilentlyContinue
        Remove-Item -LiteralPath $tmpd -Recurse -Force -ErrorAction SilentlyContinue
    }
}

# Baslangicta: eksikse dogrulayarak kurar; varsa kayitli hash ile karsilastirir (degistirilmis mi?)
function Initialize-Tools([string]$bin, [string]$pin, $onTick, $onInfo) {
    New-Item -ItemType Directory -Force -Path $bin | Out-Null
    $r   = Read-Records $bin
    $exe = Join-Path $bin 'yt-dlp.exe'
    if (-not (Test-Path -LiteralPath $exe) -or -not $r['ytdlp']) {
        if ($onInfo) { & $onInfo 'yt-dlp indiriliyor ve doğrulanıyor...' }
        [void](Update-YtDlp $bin $pin $onTick)
    } elseif ((Get-Sha256 $exe) -ne $r['ytdlp']) {
        throw 'bin\yt-dlp.exe kayıtlı sağlama toplamıyla uyuşmuyor (dosya değişmiş olabilir). Dosyayı silip yeniden başlat.'
    }

    $ff = Join-Path $bin 'ffmpeg.exe'
    $fp = Join-Path $bin 'ffprobe.exe'
    $haveFf = (Test-Path -LiteralPath $ff) -and (Test-Path -LiteralPath $fp) -and $r['ffmpeg'] -and $r['ffprobe']
    if (-not $haveFf) {
        if ($onInfo) { & $onInfo 'ffmpeg indiriliyor ve doğrulanıyor (~100 MB, birkaç dakika sürebilir)...' }
        Install-Ffmpeg $bin $onTick
    } elseif (((Get-Sha256 $ff) -ne $r['ffmpeg']) -or ((Get-Sha256 $fp) -ne $r['ffprobe'])) {
        throw 'bin\ffmpeg.exe veya ffprobe.exe kayıtlı sağlama toplamıyla uyuşmuyor (dosya değişmiş olabilir). Dosyaları silip yeniden başlat.'
    }
}

# ---- ayarlar (ayarlar.txt) ----
function Read-Settings([string]$root) {
    $s = @{ key = ''; browser = ''; port = '8000'; erisim = 'otomatik'; ytdlp_surum = ''; kapak = 'evet'; uyku = 'engelle' }
    $p = Join-Path $root 'ayarlar.txt'
    if (Test-Path -LiteralPath $p) {
        foreach ($line in (Get-Content -LiteralPath $p -Encoding UTF8)) {
            if ($line -match '^\s*([A-Za-z_]+)\s*=\s*(.*?)\s*$') { $s[$Matches[1].ToLower()] = $Matches[2] }
        }
    }
    return $s
}

function Write-Settings([string]$root, $s) {
    $txt  = "# Reel Ses ayarlari`r`n"
    $txt += "key=$($s['key'])`r`n"
    $txt += "browser=$($s['browser'])`r`n"
    $txt += "port=$($s['port'])`r`n"
    $txt += "# erisim: otomatik (Tailscale varsa onu kullan) | tailscale (sadece Tailscale) | wifi (sifresiz yerel ag)`r`n"
    $txt += "erisim=$($s['erisim'])`r`n"
    $txt += "# ytdlp_surum: bos = hep guncel; ornek 2025.01.15 yazarsan o surume sabitlenir, otomatik guncelleme durur`r`n"
    $txt += "ytdlp_surum=$($s['ytdlp_surum'])`r`n"
    $txt += "# kapak: evet | hayir  (basligi/sanatciyi ve kapak resmini dosyaya gom; hata verirse otomatik gomsuz denenir)`r`n"
    $txt += "kapak=$($s['kapak'])`r`n"
    $txt += "# uyku: engelle | izin  (sunucu calisirken bilgisayar uykuya gecmesin)`r`n"
    $txt += "uyku=$($s['uyku'])`r`n"
    [System.IO.File]::WriteAllText((Join-Path $root 'ayarlar.txt'), $txt, (New-Object System.Text.UTF8Encoding($false)))
}

# 128 bit rastgele anahtar (32 hex karakter)
function New-AccessKey {
    $b = New-Object byte[] 16
    $rng = New-Object System.Security.Cryptography.RNGCryptoServiceProvider
    try { $rng.GetBytes($b) } finally { $rng.Dispose() }
    return (($b | ForEach-Object { $_.ToString('x2') }) -join '')
}

# ---- kullanim onayi (onay.txt) ----
function Get-Consent([string]$root) {
    $p = Join-Path $root 'onay.txt'
    if (-not (Test-Path -LiteralPath $p)) { return $false }
    $t = [string](Get-Content -LiteralPath $p -Raw -ErrorAction SilentlyContinue)
    return $t.Trim().StartsWith($script:OnayVersiyon + ' ')
}

function Set-Consent([string]$root, [bool]$on) {
    $p = Join-Path $root 'onay.txt'
    if ($on) {
        $t = $script:OnayVersiyon + ' ' + (Get-Date -Format 'yyyy-MM-dd HH:mm')
        [System.IO.File]::WriteAllText($p, $t, (New-Object System.Text.UTF8Encoding($false)))
    } else {
        Remove-Item -LiteralPath $p -Force -ErrorAction SilentlyContinue
    }
}

# ---- yardimcilar ----
function Invoke-Native([string]$exe, [string]$argString, [int]$timeoutSec = 15) {
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = $exe
    $psi.Arguments = $argString
    $psi.UseShellExecute = $false
    $psi.CreateNoWindow = $true
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $p = [System.Diagnostics.Process]::Start($psi)
    $o = $p.StandardOutput.ReadToEndAsync()
    $e = $p.StandardError.ReadToEndAsync()
    $done = $p.WaitForExit($timeoutSec * 1000)
    $code = -1
    if ($done) { $p.WaitForExit(); $code = $p.ExitCode } else { try { $p.Kill() } catch { } }
    [void]$o.Wait(2000)
    [void]$e.Wait(2000)
    $txt = ([string]$o.Result + "`n" + [string]$e.Result).Trim()
    return [pscustomobject]@{ Code = $code; Out = $txt }
}

function Find-Tailscale {
    $c = Get-Command tailscale -ErrorAction SilentlyContinue
    if ($c) { return $c.Source }
    $p = Join-Path $env:ProgramFiles 'Tailscale\tailscale.exe'
    if (Test-Path -LiteralPath $p) { return $p }
    return $null
}


# ---- kayit dosyasi (kayit\reelses.log, 512 KB'ta doner) ----
function Write-Log([string]$dir, [string]$msg) {
    try {
        New-Item -ItemType Directory -Force -Path $dir | Out-Null
        $f = Join-Path $dir 'reelses.log'
        if ((Test-Path -LiteralPath $f) -and ((Get-Item -LiteralPath $f).Length -gt 524288)) {
            Move-Item -LiteralPath $f -Destination "$f.old" -Force
        }
        $line = ('{0:yyyy-MM-dd HH:mm:ss} {1}' -f (Get-Date), $msg) + "`r`n"
        [System.IO.File]::AppendAllText($f, $line, (New-Object System.Text.UTF8Encoding($false)))
    } catch { }
}

# ---- QR sayfasi: yerel HTML dosyasi uretir (anahtar sunucuya konmaz, sadece bu bilgisayarda gecici dosya) ----
function New-QrPage([string]$root, [string[]]$urls) {
    $js = Get-Content -LiteralPath (Join-Path $root 'qr.js') -Raw -Encoding UTF8
    $arr = '[' + ((@($urls) | ForEach-Object { ConvertTo-Json -InputObject ([string]$_) -Compress }) -join ',') + ']'
    $tpl = @'
<!doctype html>
<html lang="tr"><head><meta charset="utf-8"><title>Reel Ses - Telefon için QR</title>
<style>
body{font-family:system-ui,Segoe UI,sans-serif;background:#111827;color:#f3f4f6;margin:0;padding:24px;text-align:center}
h1{font-size:1.3rem;margin:0 0 6px}p{color:#9ca3af;font-size:.9rem;margin:6px auto;max-width:520px}
.c{display:inline-block;margin:14px;padding:12px;background:#1f2937;border-radius:14px}
canvas{background:#fff;border-radius:8px;max-width:100%}.c p{word-break:break-all;color:#d1d5db}
</style></head><body>
<h1>🎵 Reel Ses - telefonla bağlan</h1>
<p>Telefonun kamerasıyla QR kodu okut, açılan bağlantıya dokun. Anahtar otomatik girilir.</p>
<p><b>Bu sayfa anahtarı içerir.</b> Kimseyle paylaşma, işin bitince kapat.</p>
<div id="out"></div>
<script>
@@JS@@
</script>
<script>
var U=@@URLS@@, out=document.getElementById('out');
U.forEach(function(u){
  var d=document.createElement('div'); d.className='c';
  var cv=document.createElement('canvas'), p=document.createElement('p');
  p.textContent=u.split('#')[0];
  d.appendChild(cv); d.appendChild(p); out.appendChild(d);
  try{ QR.draw(cv,u,6); }catch(e){ p.textContent='QR üretilemedi: '+e.message; }
});
</script></body></html>
'@
    $html = $tpl.Replace('@@JS@@', $js).Replace('@@URLS@@', $arr)
    $f = Join-Path $env:TEMP ('reelses-qr-' + [guid]::NewGuid().ToString('N') + '.html')
    [System.IO.File]::WriteAllText($f, $html, (New-Object System.Text.UTF8Encoding($false)))
    return $f
}

function Clear-QrPages([int]$minutes = 10) {
    Get-ChildItem -Path $env:TEMP -Filter 'reelses-qr-*.html' -ErrorAction SilentlyContinue |
        Where-Object { $_.LastWriteTime -lt (Get-Date).AddMinutes(-$minutes) } |
        Remove-Item -Force -ErrorAction SilentlyContinue
}

# ---- indirme secenekleri (ses/video) ----
# $o: @{ format='audio'|'video'; ses='mp3'|'m4a'; hd=0|720|1080 }
function Get-ExtOf($o) {
    if ($o.format -eq 'video') { return 'mp4' }
    if ($o.ses -eq 'm4a') { return 'm4a' }
    return 'mp3'
}

function Build-YtArgs($o, [string]$bin, [string]$dir, [string]$url, [string]$browser, [bool]$embed) {
    $bas = [int]$o.bas
    $bit = [int]$o.bit
    $trim = (($bas -gt 0) -or ($bit -gt 0))
    $outT = '%(title).50s [%(id)s].%(ext)s'
    if ($trim) { $outT = '%(title).50s [%(id)s] kirpik.%(ext)s' }
    $a = "--no-playlist --no-warnings --newline --windows-filenames --ffmpeg-location `"$bin`" -P `"$dir`" -o `"$outT`""
    if ($o.format -eq 'video') {
        if ([int]$o.hd -gt 0) {
            $h = [int]$o.hd
            $a += " -f `"bv*[height<=$h]+ba/b[height<=$h]/bv*+ba/b`""
        } else {
            $a += ' -f "bv*+ba/b"'
        }
        $a += ' -S "vcodec:h264,acodec:aac" --merge-output-format mp4'
    } elseif ($o.ses -eq 'm4a') {
        $a += ' -x --audio-format m4a --audio-quality 0'
    } else {
        $a += ' -x --audio-format mp3 --audio-quality 0'
    }
    if ($trim) {
        $endS = 'inf'
        if ($bit -gt 0) { $endS = [string]$bit }
        $a += " --download-sections `"*$bas-$endS`" --force-keyframes-at-cuts"
    }
    # Ses seviyesi esitleme yalnizca MP3'te (M4A/video kopyalandigi icin filtre uygulanamaz)
    if (($o.format -ne 'video') -and ($o.ses -ne 'm4a') -and ($o.norm -eq $true)) {
        $a += ' --postprocessor-args "ExtractAudio:-af loudnorm=I=-16:TP=-1.5:LRA=11"'
    }
    if ($embed) {
        $a += ' --embed-metadata --parse-metadata "%(uploader)s:%(meta_artist)s" --embed-thumbnail --convert-thumbnails jpg'
    }
    if ($browser) { $a += " --cookies-from-browser $browser" }
    return $a + " `"$url`""
}

# Instagram linkinden kisa kod (zaten indirilmis mi diye bakmak icin)
function Get-IgCode([string]$u) {
    if ($u -match '/(?:reel|reels|p|tv)/([A-Za-z0-9_-]+)') { return $Matches[1] }
    return ''
}

# "90", "1:30" veya "1:02:03" -> saniye. Bos = 0. Gecersiz = -1
function ConvertTo-Seconds([string]$s) {
    $s = $s.Trim()
    if ($s -eq '') { return 0 }
    if ($s -match '^(\d{1,5})$') { return [int]$Matches[1] }
    if ($s -match '^(\d{1,3}):([0-5]?\d)$') { return ([int]$Matches[1]) * 60 + [int]$Matches[2] }
    if ($s -match '^(\d{1,2}):([0-5]?\d):([0-5]?\d)$') { return ([int]$Matches[1]) * 3600 + ([int]$Matches[2]) * 60 + [int]$Matches[3] }
    return -1
}
