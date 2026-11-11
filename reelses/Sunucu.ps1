# Reel Ses - Telefon sunucusu (Windows, Python gerekmez)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch {}
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

# İstek işleyici: her bağlantı ayrı bir runspace içinde çalışır
$handler = @'
param($client, $web, $ytdlp, $bin, $key, $browser)
$ErrorActionPreference = 'Stop'
$utf8 = New-Object System.Text.UTF8Encoding($false)
$stream = $null

function Log($m) { [Console]::WriteLine(('[{0}] {1}' -f (Get-Date -Format 'HH:mm:ss'), $m)) }

function Send($code, $ctype, [byte[]]$body, [string]$extra = '') {
    $reasons = @{ 200 = 'OK'; 400 = 'Bad Request'; 401 = 'Unauthorized'; 404 = 'Not Found'; 500 = 'Internal Server Error'; 502 = 'Bad Gateway' }
    $head = "HTTP/1.1 $code $($reasons[[int]$code])`r`nContent-Type: $ctype`r`nContent-Length: $($body.Length)`r`nCache-Control: no-store`r`nConnection: close`r`n$extra`r`n"
    $hb = [System.Text.Encoding]::ASCII.GetBytes($head)
    $stream.Write($hb, 0, $hb.Length)
    if ($body.Length -gt 0) { $stream.Write($body, 0, $body.Length) }
    $stream.Flush()
}

function Json($code, $msg) {
    $j = ConvertTo-Json -Compress -InputObject @{ detail = [string]$msg }
    Send $code 'application/json; charset=utf-8' ($utf8.GetBytes($j))
}

try {
    $stream = $client.GetStream()
    $stream.ReadTimeout = 10000
    $stream.WriteTimeout = 120000

    # --- istek basligini oku ---
    $ms = New-Object System.IO.MemoryStream
    $buf = New-Object byte[] 4096
    $headEnd = -1
    while ($headEnd -lt 0) {
        $n = $stream.Read($buf, 0, $buf.Length)
        if ($n -le 0) { return }
        $ms.Write($buf, 0, $n)
        $all = $ms.GetBuffer()
        $len = [int]$ms.Length
        for ($i = [Math]::Max(0, $len - $n - 3); $i -le $len - 4; $i++) {
            if ($all[$i] -eq 13 -and $all[$i + 1] -eq 10 -and $all[$i + 2] -eq 13 -and $all[$i + 3] -eq 10) { $headEnd = $i; break }
        }
        if ($len -gt 65536) { return }
    }
    $all = $ms.GetBuffer()
    $lines = $utf8.GetString($all, 0, $headEnd) -split "`r`n"
    $parts = $lines[0] -split ' '
    if ($parts.Length -lt 2) { return }
    $method = $parts[0].ToUpper()
    $path = ($parts[1] -split '\?')[0]
    $hdr = @{}
    for ($i = 1; $i -lt $lines.Length; $i++) {
        $idx = $lines[$i].IndexOf(':')
        if ($idx -gt 0) { $hdr[$lines[$i].Substring(0, $idx).Trim().ToLower()] = $lines[$i].Substring($idx + 1).Trim() }
    }

    # --- govdeyi oku ---
    $body = ''
    $cl = 0
    if ($hdr.ContainsKey('content-length')) { [void][int]::TryParse($hdr['content-length'], [ref]$cl) }
    if ($cl -gt 4096) { Json 400 'İstek çok büyük.'; return }
    if ($cl -gt 0) {
        $have = [int]$ms.Length - ($headEnd + 4)
        while ($have -lt $cl) {
            $n = $stream.Read($buf, 0, $buf.Length)
            if ($n -le 0) { break }
            $ms.Write($buf, 0, $n)
            $have += $n
        }
        $all = $ms.GetBuffer()
        $body = $utf8.GetString($all, $headEnd + 4, [Math]::Min($cl, $have))
    }

    $authed = ($hdr['x-key'] -eq $key)

    $static = @{
        '/'                      = @('index.html', 'text/html; charset=utf-8')
        '/index.html'            = @('index.html', 'text/html; charset=utf-8')
        '/manifest.json'         = @('manifest.json', 'application/manifest+json; charset=utf-8')
        '/sw.js'                 = @('sw.js', 'text/javascript; charset=utf-8')
        '/icon.svg'              = @('icon.svg', 'image/svg+xml')
        '/icon-192.png'          = @('icon-192.png', 'image/png')
        '/icon-512.png'          = @('icon-512.png', 'image/png')
        '/icon-maskable-512.png' = @('icon-maskable-512.png', 'image/png')
        '/apple-touch-icon.png'  = @('apple-touch-icon.png', 'image/png')
    }

    if ($method -eq 'GET' -and $static.ContainsKey($path)) {
        $file = Join-Path $web $static[$path][0]
        if (Test-Path $file) { Send 200 $static[$path][1] ([System.IO.File]::ReadAllBytes($file)) }
        else { Json 404 'Dosya yok.' }
    }
    elseif ($method -eq 'GET' -and $path -eq '/api/ping') {
        if ($authed) { Send 200 'application/json' ($utf8.GetBytes('{"ok":true}')) } else { Json 401 'Anahtar yanlış.' }
    }
    elseif ($method -eq 'POST' -and $path -eq '/api/download') {
        if (-not $authed) { Json 401 'Anahtar yanlış.'; return }
        $url = ''
        try { $url = [string](($body | ConvertFrom-Json).url) } catch { }
        $url = $url.Trim()
        if ($url -notmatch '^https://(www\.)?instagram\.com/([A-Za-z0-9_.]+/)?(share/)?(reel|reels|p|tv)/[A-Za-z0-9_-]+/?(\?[A-Za-z0-9_=&%.\-]*)?$') {
            Json 400 'Geçerli bir Instagram Reel linki gönder.'
            return
        }
        $tmp = Join-Path ([System.IO.Path]::GetTempPath()) ('reelses_' + [guid]::NewGuid().ToString('N'))
        New-Item -ItemType Directory -Force -Path $tmp | Out-Null
        try {
            Log "İndiriliyor: $url"
            $argStr = "-x --audio-format mp3 --audio-quality 0 --no-playlist --no-warnings --windows-filenames --ffmpeg-location `"$bin`" -P `"$tmp`" -o `"%(title).60s.%(ext)s`""
            if ($browser) { $argStr += " --cookies-from-browser $browser" }
            $argStr += " `"$url`""
            $psi = New-Object System.Diagnostics.ProcessStartInfo
            $psi.FileName = $ytdlp
            $psi.Arguments = $argStr
            $psi.UseShellExecute = $false
            $psi.CreateNoWindow = $true
            $psi.RedirectStandardOutput = $true
            $psi.RedirectStandardError = $true
            $psi.StandardOutputEncoding = $utf8
            $psi.StandardErrorEncoding = $utf8
            $psi.EnvironmentVariables['PYTHONIOENCODING'] = 'utf-8'
            $p = [System.Diagnostics.Process]::Start($psi)
            $tOut = $p.StandardOutput.ReadToEndAsync()
            $tErr = $p.StandardError.ReadToEndAsync()
            if (-not $p.WaitForExit(240000)) {
                try { $p.Kill() } catch { }
                Json 502 'Zaman aşımı: indirme çok uzun sürdü.'
                return
            }
            $p.WaitForExit()
            $errText = [string]$tErr.Result + "`n" + [string]$tOut.Result
            $mp3 = Get-ChildItem -Path $tmp -Filter *.mp3 | Select-Object -First 1
            if ($p.ExitCode -ne 0 -or -not $mp3) {
                $line = ($errText -split "`r?`n" | Where-Object { $_ -match 'ERROR' } | Select-Object -Last 1)
                if (-not $line) { $line = 'Bilinmeyen hata.' }
                if ($line.Length -gt 250) { $line = $line.Substring(0, 250) }
                $hint = ''
                if ($errText -match 'login|cookie|rate-limit|empty media|restricted') {
                    $hint = " Instagram giriş istiyor olabilir: ayarlar.txt içinde browser=firefox yaz (o tarayıcıda Instagram'a giriş yapılı olsun) ve sunucuyu yeniden başlat."
                }
                Log "Hata: $line"
                Json 502 ("İndirilemedi. $line$hint")
                return
            }
            $bytes = [System.IO.File]::ReadAllBytes($mp3.FullName)
            $enc = [System.Uri]::EscapeDataString($mp3.Name)
            Send 200 'audio/mpeg' $bytes ("Content-Disposition: attachment; filename=`"reel.mp3`"; filename*=UTF-8''$enc`r`n")
            Log "Gönderildi: $($mp3.Name)"
        }
        finally {
            Remove-Item -Path $tmp -Recurse -Force -ErrorAction SilentlyContinue
        }
    }
    else {
        Json 404 'Bulunamadı.'
    }
}
catch {
    $msg = $_.Exception.Message
    if ($msg -notmatch 'time') { Log ('İstek hatası: ' + $msg) }
    try { if ($stream) { Json 500 'Sunucu hatası.' } } catch { }
}
finally {
    try { $client.Close() } catch { }
}
'@

try {
    $root = $PSScriptRoot
    $bin  = Join-Path $root 'bin'
    $web  = Join-Path $root 'web'
    New-Item -ItemType Directory -Force -Path $bin | Out-Null
    $ytdlp = Join-Path $bin 'yt-dlp.exe'
    if ($env:REELSES_YTDLP) { $ytdlp = $env:REELSES_YTDLP }

    # --- ayarlar ---
    $settingsPath = Join-Path $root 'ayarlar.txt'
    $settings = @{ key = ''; browser = ''; port = '8000' }
    if (Test-Path $settingsPath) {
        foreach ($line in (Get-Content $settingsPath)) {
            if ($line -match '^\s*([A-Za-z]+)\s*=\s*(.*?)\s*$') { $settings[$Matches[1].ToLower()] = $Matches[2] }
        }
    }
    if (-not $settings['key']) {
        $settings['key'] = [guid]::NewGuid().ToString('N').Substring(0, 8)
        $txt = "key=$($settings['key'])`r`nbrowser=$($settings['browser'])`r`nport=$($settings['port'])`r`n"
        [System.IO.File]::WriteAllText($settingsPath, $txt, (New-Object System.Text.UTF8Encoding($false)))
    }
    $key = $settings['key']
    $port = 8000
    [void][int]::TryParse($settings['port'], [ref]$port)
    if ($env:REELSES_PORT) { $port = [int]$env:REELSES_PORT }
    $browser = ''
    if ($settings['browser'] -match '^(firefox|chrome|edge|brave|opera|vivaldi)$') { $browser = $settings['browser'].ToLower() }

    # --- araclar (ilk calistirmada indirilir) ---
    function Ensure-Tools {
        if (-not (Test-Path $ytdlp)) {
            Write-Host 'yt-dlp indiriliyor (ilk kurulum)...'
            (New-Object System.Net.WebClient).DownloadFile('https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe', $ytdlp)
        }
        $ff = Join-Path $bin 'ffmpeg.exe'
        $fp = Join-Path $bin 'ffprobe.exe'
        if (-not ((Test-Path $ff) -and (Test-Path $fp))) {
            Write-Host 'ffmpeg indiriliyor (ilk kurulum, ~100 MB, birkaç dakika sürebilir)...'
            $zip = Join-Path $env:TEMP 'reelses-ffmpeg.zip'
            $tmpd = Join-Path $env:TEMP 'reelses-ffmpeg'
            (New-Object System.Net.WebClient).DownloadFile('https://github.com/yt-dlp/FFmpeg-Builds/releases/latest/download/ffmpeg-master-latest-win64-gpl.zip', $zip)
            Write-Host 'ffmpeg açılıyor...'
            if (Test-Path $tmpd) { Remove-Item $tmpd -Recurse -Force }
            Expand-Archive -Path $zip -DestinationPath $tmpd -Force
            Get-ChildItem -Path $tmpd -Recurse -Include 'ffmpeg.exe', 'ffprobe.exe' | ForEach-Object { Copy-Item $_.FullName $bin -Force }
            Remove-Item $zip -Force -ErrorAction SilentlyContinue
            Remove-Item $tmpd -Recurse -Force -ErrorAction SilentlyContinue
        }
    }
    if (-not $env:REELSES_SKIP_TOOLS) { Ensure-Tools }

    # --- dinlemeye basla ---
    $listener = $null
    try {
        $listener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::IPv6Any, $port)
        $listener.Server.DualMode = $true
        $listener.Start()
    } catch {
        $listener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Any, $port)
        $listener.Start()
    }

    $ips = @()
    foreach ($ni in [System.Net.NetworkInformation.NetworkInterface]::GetAllNetworkInterfaces()) {
        if ($ni.OperationalStatus -ne 'Up' -or $ni.NetworkInterfaceType -eq 'Loopback') { continue }
        foreach ($ua in $ni.GetIPProperties().UnicastAddresses) {
            if ($ua.Address.AddressFamily -eq 'InterNetwork') { $ips += $ua.Address.IPAddressToString }
        }
    }

    Write-Host ''
    Write-Host '=== Reel Ses - Telefon Sunucusu çalışıyor ===' -ForegroundColor Green
    Write-Host ''
    Write-Host 'Telefonda (aynı Wi-Fi) şu adreslerden birini aç:'
    foreach ($ip in $ips) { Write-Host "    http://${ip}:$port" -ForegroundColor Cyan }
    Write-Host ''
    Write-Host "Anahtar (telefonda ilk açılışta sorulur): $key" -ForegroundColor Yellow
    Write-Host ''
    Write-Host 'Bu pencereyi kapatırsan sunucu durur. Bilgisayar uykuya geçerse de durur.'
    Write-Host ''

    $pool = [runspacefactory]::CreateRunspacePool(1, 16)
    $pool.Open()
    $jobs = New-Object System.Collections.ArrayList

    while ($true) {
        $client = $listener.AcceptTcpClient()
        $ps = [powershell]::Create()
        $ps.RunspacePool = $pool
        [void]$ps.AddScript($handler).AddArgument($client).AddArgument($web).AddArgument($ytdlp).AddArgument($bin).AddArgument($key).AddArgument($browser)
        $h = $ps.BeginInvoke()
        [void]$jobs.Add(@{ ps = $ps; handle = $h })
        for ($i = $jobs.Count - 1; $i -ge 0; $i--) {
            if ($jobs[$i].handle.IsCompleted) {
                try { [void]$jobs[$i].ps.EndInvoke($jobs[$i].handle) } catch { }
                $jobs[$i].ps.Dispose()
                $jobs.RemoveAt($i)
            }
        }
    }
}
catch {
    Write-Host ''
    Write-Host ('HATA: ' + $_.Exception.Message) -ForegroundColor Red
    if ($_.Exception.Message -match 'use|kullan|Only one usage') {
        Write-Host 'Port başka bir program tarafından kullanılıyor olabilir; ayarlar.txt içindeki port= değerini değiştir.'
    }
}
