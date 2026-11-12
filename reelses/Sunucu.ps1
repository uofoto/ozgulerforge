# Reel Ses - Telefon sunucusu (Windows, Python gerekmez)
param([switch]$Arka, [int]$Bekle = 0)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch {}
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

# ---------------------------------------------------------------
# Istek isleyici: her baglanti ayri bir runspace icinde calisir
# ---------------------------------------------------------------
$handler = @'
param($client, $web, $key, $state)
$ErrorActionPreference = 'Stop'
$utf8 = New-Object System.Text.UTF8Encoding($false)
$stream = $null
$remote = ''
$maxQueue = 15

function Log($m) {
    [Console]::WriteLine(('[{0}] {1}' -f (Get-Date -Format 'HH:mm:ss'), $m))
    try { [System.IO.File]::AppendAllText((Join-Path $state.logDir 'reelses.log'), ('{0:yyyy-MM-dd HH:mm:ss} {1}' -f (Get-Date), $m) + "`r`n", $utf8) } catch { }
}

function Send($code, $ctype, [byte[]]$body, [string]$extra = '') {
    $reasons = @{ 200 = 'OK'; 202 = 'Accepted'; 400 = 'Bad Request'; 401 = 'Unauthorized'; 404 = 'Not Found'; 429 = 'Too Many Requests'; 500 = 'Internal Server Error'; 502 = 'Bad Gateway' }
    $head = "HTTP/1.1 $code $($reasons[[int]$code])`r`nContent-Type: $ctype`r`nContent-Length: $($body.Length)`r`nCache-Control: no-store`r`nX-Content-Type-Options: nosniff`r`nReferrer-Policy: no-referrer`r`nConnection: close`r`n$extra`r`n"
    $hb = [System.Text.Encoding]::ASCII.GetBytes($head)
    $stream.Write($hb, 0, $hb.Length)
    if ($body.Length -gt 0) { $stream.Write($body, 0, $body.Length) }
    $stream.Flush()
}

# Dosyayi belleğe okumadan parca parca gonderir
function SendFile($code, $ctype, [string]$path, [string]$extra = '') {
    $len = (New-Object System.IO.FileInfo($path)).Length
    $head = "HTTP/1.1 $code OK`r`nContent-Type: $ctype`r`nContent-Length: $len`r`nCache-Control: no-store`r`nX-Content-Type-Options: nosniff`r`nReferrer-Policy: no-referrer`r`nConnection: close`r`n$extra`r`n"
    $hb = [System.Text.Encoding]::ASCII.GetBytes($head)
    $stream.Write($hb, 0, $hb.Length)
    $fs = [System.IO.File]::OpenRead($path)
    try {
        $b = New-Object byte[] 262144
        while (($n = $fs.Read($b, 0, $b.Length)) -gt 0) { $stream.Write($b, 0, $n) }
    } finally { $fs.Dispose() }
    $stream.Flush()
}

function Json($code, $msg, [string]$extra = '') {
    $j = ConvertTo-Json -Compress -InputObject @{ detail = [string]$msg }
    Send $code 'application/json; charset=utf-8' ($utf8.GetBytes($j)) $extra
}

function JsonObj($code, $obj) {
    $j = ConvertTo-Json -Compress -InputObject $obj
    Send $code 'application/json; charset=utf-8' ($utf8.GetBytes($j))
}

function Get-Jobs {
    $list = $null
    [System.Threading.Monitor]::Enter($state.jobs.SyncRoot)
    try { $list = @($state.jobs.Values) } finally { [System.Threading.Monitor]::Exit($state.jobs.SyncRoot) }
    return ,$list
}

# --- anahtar denemesi sinirlama (istemci adresine gore) ---
function Get-LockLeft {
    $t = $state.fails["$remote|t"]
    if ($t) {
        $left = ([datetime]::FromBinary([long]$t) - [datetime]::UtcNow).TotalSeconds
        if ($left -gt 0) { return [int][Math]::Ceiling($left) }
    }
    return 0
}
function Add-Fail {
    $n = 1 + [int]$state.fails["$remote|n"]
    $state.fails["$remote|n"] = $n
    Log "Yanlış anahtar denemesi ($n) - $remote"
    if ($n -ge 5) {
        $min = [Math]::Min(60, [Math]::Pow(2, $n - 5))
        $state.fails["$remote|t"] = [datetime]::UtcNow.AddMinutes($min).ToBinary()
        Log "Bu adres $min dakika engellendi: $remote"
    }
}
function Clear-Fails {
    $state.fails.Remove("$remote|n")
    $state.fails.Remove("$remote|t")
}

# Sabit sureli karsilastirma (zamanlama saldirisi icin)
function Test-Key([string]$given) {
    $a = $utf8.GetBytes($given)
    $b = $utf8.GetBytes($key)
    $diff = $a.Length -bxor $b.Length
    $max = [Math]::Max($a.Length, $b.Length)
    for ($i = 0; $i -lt $max; $i++) {
        $x = 0; $y = 0
        if ($i -lt $a.Length) { $x = $a[$i] }
        if ($i -lt $b.Length) { $y = $b[$i] }
        $diff = $diff -bor ($x -bxor $y)
    }
    return ($diff -eq 0)
}

try {
    $stream = $client.GetStream()
    $stream.ReadTimeout = 10000
    $stream.WriteTimeout = 600000
    try { $remote = $client.Client.RemoteEndPoint.Address.ToString() } catch { }

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

    # Tailscale serve gibi yerel vekil arkasindaysak gercek istemci adresini X-Forwarded-For'dan al
    if ($remote -eq '127.0.0.1' -or $remote -eq '::1' -or $remote -eq '::ffff:127.0.0.1') {
        if ($hdr['x-forwarded-for']) { $remote = ($hdr['x-forwarded-for'] -split ',')[0].Trim() }
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

    # --- /api/* icin anahtar denetimi + deneme siniri ---
    if ($path.StartsWith('/api/')) {
        $left = Get-LockLeft
        if ($left -gt 0) {
            Json 429 "Çok fazla yanlış anahtar denemesi. $left saniye sonra tekrar dene." "Retry-After: $left`r`n"
            return
        }
        if (Test-Key ([string]$hdr['x-key'])) { Clear-Fails }
        else { Add-Fail; Json 401 'Anahtar yanlış.'; return }
    }

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
        Send 200 'application/json' ($utf8.GetBytes('{"ok":true}'))
    }
    elseif ($method -eq 'POST' -and $path -eq '/api/download') {
        $url = ''
        $fmt = 'audio'
        $ses = 'mp3'
        $hd = 0
        $bas = 0
        $bit = 0
        $norm = $false
        $onay = $false
        try {
            $req = $body | ConvertFrom-Json
            $url = [string]$req.url
            if ([string]$req.format -eq 'video') { $fmt = 'video' }
            if ([string]$req.ses -eq 'm4a') { $ses = 'm4a' }
            if ([int]$req.hd -eq 720 -or [int]$req.hd -eq 1080) { $hd = [int]$req.hd }
            if ([int]$req.bas -ge 0 -and [int]$req.bas -le 86400) { $bas = [int]$req.bas }
            if ([int]$req.bit -ge 0 -and [int]$req.bit -le 86400) { $bit = [int]$req.bit }
            if ($req.norm -eq $true -and $fmt -eq 'audio' -and $ses -eq 'mp3') { $norm = $true }
            if ($req.onay -eq $true) { $onay = $true }
        } catch { }
        $url = $url.Trim()
        if (-not $onay) { Json 400 'Kullanım onayı verilmedi. Onay kutusunu işaretle.'; return }
        if ($url -notmatch '^https://(www\.)?instagram\.com/([A-Za-z0-9_.]+/)?(share/)?(reel|reels|p|tv)/[A-Za-z0-9_-]+/?(\?[A-Za-z0-9_=&%.\-]*)?$') {
            Json 400 'Geçerli bir Instagram Reel linki gönder.'
            return
        }
        if ($bit -gt 0 -and $bit -le $bas) { Json 400 'Kırpma bitişi, başlangıçtan büyük olmalı.'; return }
        $jobId = $null
        $full = $false
        [System.Threading.Monitor]::Enter($state.jobs.SyncRoot)
        try {
            $active = @($state.jobs.Values | Where-Object { $_.state -eq 'queued' -or $_.state -eq 'running' })
            $dup = $active | Where-Object { $_.url -eq $url -and $_.format -eq $fmt -and $_.ses -eq $ses -and $_.hd -eq $hd -and $_.bas -eq $bas -and $_.bit -eq $bit -and $_.norm -eq $norm } | Select-Object -First 1
            if ($dup) { $jobId = $dup.id }
            elseif ($active.Count -ge $maxQueue) { $full = $true }
            else {
                $jobId = [guid]::NewGuid().ToString('N')
                $job = [hashtable]::Synchronized(@{
                    id = $jobId; url = $url; format = $fmt; ses = $ses; hd = $hd; bas = $bas; bit = $bit; norm = $norm; state = 'queued'; percent = 0
                    phase = 'Sırada'; message = ''; name = ''; file = ''; size = 0
                    created = [datetime]::UtcNow.Ticks; finished = 0
                })
                $state.jobs[$jobId] = $job
                $state.queue.Enqueue($jobId)
            }
        } finally { [System.Threading.Monitor]::Exit($state.jobs.SyncRoot) }
        if ($full) { Json 429 "Kuyruk dolu (en fazla $maxQueue iş). Biraz bekle."; return }
        JsonObj 202 @{ id = $jobId }
    }
    elseif ($method -eq 'GET' -and $path -match '^/api/job/([0-9a-f]{32})$') {
        $job = $state.jobs[$Matches[1]]
        if (-not $job) { Json 404 'İş bulunamadı (sunucu yeniden başlatılmış olabilir).'; return }
        $pos = 0
        if ($job.state -eq 'queued') {
            $ahead = @(Get-Jobs | Where-Object { $_.state -eq 'queued' -and $_.created -lt $job.created })
            $pos = 1 + $ahead.Count
        }
        JsonObj 200 @{ state = [string]$job.state; percent = [int]$job.percent; phase = [string]$job.phase; position = $pos; message = [string]$job.message; name = [string]$job.name; size = [long]$job.size }
    }
    elseif ($method -eq 'GET' -and $path -match '^/api/file/([0-9a-f]{32})$') {
        $job = $state.jobs[$Matches[1]]
        if (-not $job -or $job.state -ne 'done' -or -not (Test-Path -LiteralPath $job.file)) { Json 404 'Dosya hazır değil veya süresi doldu.'; return }
        $enc = [System.Uri]::EscapeDataString([string]$job.name)
        $ext = [System.IO.Path]::GetExtension([string]$job.file).TrimStart('.')
        $ctype = 'audio/mpeg'
        if ($ext -eq 'm4a') { $ctype = 'audio/mp4' }
        if ($ext -eq 'mp4') { $ctype = 'video/mp4' }
        SendFile 200 $ctype $job.file ("Content-Disposition: attachment; filename=`"reel.$ext`"; filename*=UTF-8''$enc`r`n")
        Log "Gönderildi: $($job.name)"
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

# ---------------------------------------------------------------
# Is kuyrugu calisani: tek tek indirir, ilerlemeyi okur, bosta iken yt-dlp'yi gunceller
# ---------------------------------------------------------------
$worker = @'
param($state, $bin, $browser, $ortak, $pin, $tmpRoot, $embed)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$utf8 = New-Object System.Text.UTF8Encoding($false)
. $ortak
$ytdlp = Join-Path $bin 'yt-dlp.exe'

function Log($m) {
    [Console]::WriteLine(('[{0}] {1}' -f (Get-Date -Format 'HH:mm:ss'), $m))
    Write-Log $state.logDir $m
}

function Invoke-YtDlp($job, $dir, [bool]$emb) {
    $opt = @{ format = [string]$job.format; ses = [string]$job.ses; hd = [int]$job.hd; bas = [int]$job.bas; bit = [int]$job.bit; norm = [bool]$job.norm }
    $ext = Get-ExtOf $opt
    $argStr = Build-YtArgs $opt $bin $dir ([string]$job.url) $browser $emb

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
    $tErr = $p.StandardError.ReadToEndAsync()
    $outText = New-Object System.Text.StringBuilder
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    $timedOut = $false
    $streamNo = 0
    $tLine = $p.StandardOutput.ReadLineAsync()
    while ($true) {
        if ($tLine.Wait(1000)) {
            $line = $tLine.Result
            if ($null -eq $line) { break }
            [void]$outText.AppendLine($line)
            if ($line -match '^\[download\] Destination:') { $streamNo++ }
            if ($line -match '\[download\]\s+(\d+(?:\.\d+)?)%') {
                $job.percent = [int][Math]::Floor([double]$Matches[1])
                $ph = 'İndiriliyor'
                if ($streamNo -gt 1) { $ph += " (parça $streamNo)" }
                $job.phase = $ph
            }
            elseif ($line -match '^\[(ExtractAudio|Merger|VideoConvertor|FFmpeg)') {
                $job.phase = 'Dönüştürülüyor'
                $job.percent = 100
            }
            $tLine = $p.StandardOutput.ReadLineAsync()
        }
        if ($sw.Elapsed.TotalSeconds -gt 240) {
            $timedOut = $true
            try { $p.Kill() } catch { }
            break
        }
    }
    if (-not $timedOut) { $p.WaitForExit() }
    $errText = ''
    if ($tErr.Wait(3000)) { $errText = [string]$tErr.Result }
    $all = $errText + "`n" + $outText.ToString()
    $code = -1
    if (-not $timedOut) { $code = $p.ExitCode }
    $f = Get-ChildItem -Path $dir -Filter "*.$ext" -ErrorAction SilentlyContinue | Select-Object -First 1
    $line2 = ($all -split "`r?`n" | Where-Object { $_ -match 'ERROR' } | Select-Object -Last 1)
    if (-not $line2) { $line2 = 'Bilinmeyen hata.' }
    if ($line2.Length -gt 250) { $line2 = $line2.Substring(0, 250) }
    return [pscustomobject]@{
        ok      = ((-not $timedOut) -and ($code -eq 0) -and ($null -ne $f))
        file    = $f
        timeout = $timedOut
        login   = ($all -match 'login|cookie|rate-limit|empty media|restricted')
        error   = $line2
    }
}

function Remove-JobDir($dir) {
    Remove-Item -LiteralPath $dir -Recurse -Force -ErrorAction SilentlyContinue
}

function Run-Job($job) {
    Log "İndiriliyor ($($job.format)): $($job.url)"
    $job.state = 'running'
    $job.phase = 'Başlıyor'
    $job.percent = 0
    $dir = Join-Path $tmpRoot $job.id
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
    $emb = [bool]$embed
    $res = Invoke-YtDlp $job $dir $emb
    # Gomme (kapak/baslik) sorun cikardiysa gomsuz bir kez daha dene
    if ($emb -and (-not $res.ok) -and (-not $res.login) -and (-not $res.timeout)) {
        Log 'Kapak/başlık gömme başarısız olabilir, gömsüz yeniden deneniyor.'
        $emb = $false
        Get-ChildItem -Path $dir -Force | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
        $job.percent = 0
        $res = Invoke-YtDlp $job $dir $emb
    }
    # Instagram degismis olabilir: giris sorunu degilse yt-dlp'yi guncelleyip bir kez daha dene
    if ((-not $res.ok) -and (-not $res.login) -and (-not $res.timeout) -and (-not $pin)) {
        $job.phase = 'yt-dlp güncelleniyor'
        $job.percent = 0
        $upd = ''
        try { $upd = Update-YtDlp $bin '' $null } catch { Log ('yt-dlp güncelleme yapılamadı: ' + $_.Exception.Message) }
        if ($upd -eq 'guncellendi') {
            Log 'yt-dlp güncellendi, yeniden deneniyor.'
            Get-ChildItem -Path $dir -Force | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
            $job.phase = 'Başlıyor'
            $res = Invoke-YtDlp $job $dir $emb
        }
    }
    if ($res.ok) {
        $job.file = $res.file.FullName
        $job.name = ($res.file.BaseName -replace '\s*\[[A-Za-z0-9_-]{5,}\]', '') + $res.file.Extension
        $job.size = $res.file.Length
        $job.percent = 100
        $job.phase = 'Hazır'
        $job.finished = [datetime]::UtcNow.Ticks
        $job.state = 'done'
        Log "Hazır: $($job.name)"
    } else {
        $msg = ''
        if ($res.timeout) { $msg = 'Zaman aşımı: indirme çok uzun sürdü.' }
        else {
            $msg = "İndirilemedi. $($res.error)"
            if ($res.login) { $msg += " Instagram giriş istiyor olabilir: ayarlar.txt içinde browser=firefox yaz (o tarayıcıda Instagram'a giriş yapılı olsun) ve sunucuyu yeniden başlat." }
        }
        Log "Hata: $($res.error)"
        $job.message = $msg
        $job.finished = [datetime]::UtcNow.Ticks
        $job.state = 'error'
        Remove-JobDir $dir
    }
}

$lastTry = (Get-Date).AddHours(-2)
while (-not $state.stop) {
    try {
        $id = $null
        if ($state.queue.TryDequeue([ref]$id)) {
            $job = $state.jobs[$id]
            if ($job) { Run-Job $job }
            continue
        }
        # bosta: gunde bir yt-dlp guncelleme kontrolu (saatte en fazla bir deneme)
        if ((-not $pin) -and (((Get-Date) - $lastTry).TotalMinutes -ge 60) -and (Test-UpdateDue $bin 20)) {
            $lastTry = Get-Date
            try {
                $u = Update-YtDlp $bin '' $null
                Log "yt-dlp kontrolü: $u"
            } catch { Log ('yt-dlp güncelleme yapılamadı: ' + $_.Exception.Message) }
        }
    } catch {
        Log ('Çalışan hatası: ' + $_.Exception.Message)
        Start-Sleep -Seconds 2
    }
    Start-Sleep -Milliseconds 300
}
'@

# ---------------------------------------------------------------
# Ana program
# ---------------------------------------------------------------
$listener = $null
$state = $null
$tray = $null
$ui = @{ quit = $false }
try {
    if ($Bekle -gt 0) { Start-Sleep -Seconds $Bekle }
    Add-Type -AssemblyName System.Windows.Forms
    Add-Type -AssemblyName System.Drawing
    $root = $PSScriptRoot
    $logDir = Join-Path $root 'kayit'
    $bin  = Join-Path $root 'bin'
    $web  = Join-Path $root 'web'
    $ortak = Join-Path $root 'Ortak.ps1'
    . $ortak
    New-Item -ItemType Directory -Force -Path $bin | Out-Null

    # --- ayarlar ---
    $settings = Read-Settings $root
    $changed = $false
    if ((-not $settings['key']) -or ($settings['key'].Length -lt 20)) {
        if ($settings['key']) { Write-Host 'Eski kısa anahtar güvenli değil; yeni uzun anahtar üretildi (telefonda bir kez tekrar girmen gerekecek).' -ForegroundColor Yellow }
        $settings['key'] = New-AccessKey
        $changed = $true
    }
    if ($settings['erisim'] -notmatch '^(otomatik|tailscale|wifi)$') { $settings['erisim'] = 'otomatik'; $changed = $true }
    if ($changed -or -not (Test-Path (Join-Path $root 'ayarlar.txt'))) { Write-Settings $root $settings }
    $key  = $settings['key']
    $mode = $settings['erisim']
    $pin  = $settings['ytdlp_surum']
    $port = 8000
    [void][int]::TryParse($settings['port'], [ref]$port)
    if ($env:REELSES_PORT) { $port = [int]$env:REELSES_PORT }
    $embed = ($settings['kapak'] -ne 'hayir')
    if ($settings['uyku'] -ne 'izin') {
        try {
            Add-Type -Namespace ReelSes -Name Power -MemberDefinition '[System.Runtime.InteropServices.DllImport("kernel32.dll")] public static extern uint SetThreadExecutionState(uint esFlags);'
            [void][ReelSes.Power]::SetThreadExecutionState([uint32]2147483649)
        } catch { }
    }
    $browser = ''
    if ($settings['browser'] -match '^(firefox|chrome|edge|brave|opera|vivaldi)$') { $browser = $settings['browser'].ToLower() }

    # --- araclar: dogrulayarak kur / kayitli hash ile karsilastir ---
    if (-not $env:REELSES_SKIP_TOOLS) {
        Initialize-Tools $bin $pin $null { param($m) Write-Host $m }
        if (Test-UpdateDue $bin 20) {
            Write-Host 'yt-dlp sürümü kontrol ediliyor...'
            try {
                $u = Update-YtDlp $bin $pin $null
                if ($u -eq 'guncellendi') { Write-Host 'yt-dlp güncellendi.' -ForegroundColor Green }
            } catch { Write-Host ('yt-dlp güncelleme kontrolü yapılamadı (devam ediliyor): ' + $_.Exception.Message) -ForegroundColor Yellow }
        }
    }

    # --- baglanti yolu: Tailscale HTTPS tercih edilir ---
    $tsOk = $false
    $tsUrl = ''
    if ($mode -ne 'wifi') {
        $tsExe = Find-Tailscale
        if ($tsExe) {
            Write-Host 'Tailscale bulundu, HTTPS yolu hazırlanıyor...'
            try {
                $r = Invoke-Native $tsExe "serve --bg $port" 20
                if ($r.Code -eq 0) {
                    $tsOk = $true
                    $st = Invoke-Native $tsExe 'serve status' 10
                    if (($r.Out + "`n" + $st.Out) -match '(https://[A-Za-z0-9.\-]+\.ts\.net)') { $tsUrl = $Matches[1] }
                } else {
                    Write-Host ('Tailscale serve çalışmadı: ' + $r.Out) -ForegroundColor Yellow
                }
            } catch { Write-Host ('Tailscale kontrolü başarısız: ' + $_.Exception.Message) -ForegroundColor Yellow }
        } elseif ($mode -eq 'tailscale') {
            Write-Host 'Tailscale bulunamadı.' -ForegroundColor Yellow
        }
        if ((-not $tsOk) -and ($mode -eq 'tailscale')) {
            throw 'erisim=tailscale seçili ama Tailscale çalışmıyor. Tailscale kur/aç veya ayarlar.txt içinde erisim=otomatik yap.'
        }
    }
    $loopOnly = $tsOk

    # --- dinlemeye basla ---
    if ($loopOnly) {
        $listener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, $port)
        $listener.Start()
    } else {
        try {
            $listener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::IPv6Any, $port)
            $listener.Server.DualMode = $true
            $listener.Start()
        } catch {
            $listener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Any, $port)
            $listener.Start()
        }
    }

    # telefon icin adresler (QR ve konsol)
    $qrUrls = @()
    $ips = @()
    if ($loopOnly) {
        if ($tsUrl) { $qrUrls += "$tsUrl/#anahtar=$key" }
    } else {
        $pref = @(); $other = @()
        foreach ($ni in [System.Net.NetworkInformation.NetworkInterface]::GetAllNetworkInterfaces()) {
            if ($ni.OperationalStatus -ne 'Up' -or $ni.NetworkInterfaceType -eq 'Loopback') { continue }
            $ipp = $ni.GetIPProperties()
            $hasGw = @($ipp.GatewayAddresses | Where-Object { $_.Address.AddressFamily -eq 'InterNetwork' -and $_.Address.ToString() -ne '0.0.0.0' }).Count -gt 0
            foreach ($ua in $ipp.UnicastAddresses) {
                if ($ua.Address.AddressFamily -ne 'InterNetwork') { continue }
                $s = $ua.Address.IPAddressToString
                if ($hasGw) { $pref += $s } else { $other += $s }
            }
        }
        $ips = @($pref) + @($other)
        foreach ($ip in $pref) { $qrUrls += "http://${ip}:$port/#anahtar=$key" }
        if ($qrUrls.Count -eq 0) { foreach ($ip in $other) { $qrUrls += "http://${ip}:$port/#anahtar=$key" } }
    }

    Write-Host ''
    Write-Host '=== Reel Ses - Telefon Sunucusu çalışıyor ===' -ForegroundColor Green
    Write-Host ''
    if ($loopOnly) {
        Write-Host 'Bağlantı: Tailscale HTTPS (sunucu yalnızca Tailscale üzerinden erişilebilir).' -ForegroundColor Green
        if ($tsUrl) {
            Write-Host "Telefonda (Tailscale açık) bu adresi aç: $tsUrl" -ForegroundColor Cyan
        } else {
            Write-Host 'Adresi görmek için komut satırında: tailscale serve status'
        }
    } else {
        Write-Host 'UYARI: Tailscale HTTPS yolu yok; bağlantı şifresiz HTTP.' -ForegroundColor Yellow
        Write-Host 'Anahtar yerel ağda açık gider. Güvenmediğin Wi-Fi ağında kullanma; Tailscale kurman önerilir.' -ForegroundColor Yellow
        Write-Host ''
        Write-Host 'Telefonda (aynı Wi-Fi) şu adreslerden birini aç:'
        foreach ($ip in $ips) { Write-Host "    http://${ip}:$port" -ForegroundColor Cyan }
    }
    Write-Host ''
    Write-Host 'Tek dokunuşla bağlanmak için görev çubuğundaki Reel Ses simgesine sağ tıkla > "Telefon için QR göster".'
    Write-Host ''
    Write-Host "Anahtar (elle girmek istersen): $key" -ForegroundColor Yellow
    Write-Host ''
    Write-Host 'Bu pencereyi kapatırsan sunucu durur. Simgeden "Çıkış" ile de kapatabilirsin.'
    Write-Host ''

    # --- ortak durum: isler, kuyruk, yanlis anahtar sayaclari ---
    $tmpRoot = Join-Path $env:TEMP 'reelses-jobs'
    Remove-Item -LiteralPath $tmpRoot -Recurse -Force -ErrorAction SilentlyContinue
    New-Item -ItemType Directory -Force -Path $tmpRoot | Out-Null
    $state = [hashtable]::Synchronized(@{
        jobs  = [hashtable]::Synchronized(@{})
        fails = [hashtable]::Synchronized(@{})
        queue = New-Object 'System.Collections.Concurrent.ConcurrentQueue[string]'
        stop  = $false
        logDir = $logDir
    })
    Write-Log $logDir ('Sunucu başladı. kip=' + $(if ($loopOnly) { 'tailscale' } else { 'wifi' }) + ' port=' + $port)

    # --- tepsi simgesi ve menu ---
    $lnk = Join-Path ([Environment]::GetFolderPath('Startup')) 'Reel Ses Sunucu.lnk'
    function Open-Qr {
        if ($qrUrls.Count -eq 0) {
            [void][System.Windows.Forms.MessageBox]::Show('Telefon adresi bulunamadı. Tailscale kipinde komut satırında "tailscale serve status" ile adresi görebilirsin.', 'Reel Ses')
            return
        }
        try { Start-Process (New-QrPage $root $qrUrls) } catch { [void][System.Windows.Forms.MessageBox]::Show('QR sayfası açılamadı: ' + $_.Exception.Message, 'Reel Ses') }
    }
    function Set-Autostart([bool]$on) {
        try {
            if ($on) {
                $ws = New-Object -ComObject WScript.Shell
                $sc = $ws.CreateShortcut($lnk)
                $sc.TargetPath = 'powershell.exe'
                $sc.Arguments = '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "' + $PSCommandPath + '" -Arka -Bekle 20'
                $sc.WorkingDirectory = $root
                $sc.WindowStyle = 7
                $sc.Save()
            } else {
                Remove-Item -LiteralPath $lnk -Force -ErrorAction SilentlyContinue
            }
        } catch { Write-Log $logDir ('Başlangıç kısayolu hatası: ' + $_.Exception.Message) }
    }
    function Show-Diag {
        $L = New-Object System.Collections.Generic.List[string]
        $L.Add('Reel Ses tanılama - ' + (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'))
        $L.Add('Windows: ' + [Environment]::OSVersion.VersionString + '   PowerShell: ' + $PSVersionTable.PSVersion)
        $kip = 'Yerel ağ HTTP'; if ($loopOnly) { $kip = 'Tailscale HTTPS' }
        $L.Add("Bağlantı kipi: $kip   Port: $port   Ayar erisim=$mode")
        try { $y = Invoke-Native (Join-Path $bin 'yt-dlp.exe') '--version' 10; $L.Add('yt-dlp sürümü: ' + $y.Out) } catch { $L.Add('yt-dlp çalıştırılamadı: ' + $_.Exception.Message) }
        try { $f = Invoke-Native (Join-Path $bin 'ffmpeg.exe') '-version' 10; $L.Add('ffmpeg: ' + (($f.Out -split "`r?`n")[0])) } catch { $L.Add('ffmpeg çalıştırılamadı: ' + $_.Exception.Message) }
        $L.Add("Ayarlar: browser=$browser kapak=$($settings['kapak']) uyku=$($settings['uyku']) ytdlp_surum=$pin (anahtar gizli)")
        $tsx = Find-Tailscale
        if ($tsx) { try { $st = Invoke-Native $tsx 'serve status' 10; $L.Add('tailscale serve status: ' + $st.Out) } catch { } } else { $L.Add('Tailscale bulunamadı.') }
        $rp = Join-Path $bin 'araclar.json'
        if (Test-Path -LiteralPath $rp) { $L.Add('araclar.json: ' + ((Get-Content -LiteralPath $rp -Raw) -replace '\s+', ' ')) }
        try { $dr = New-Object System.IO.DriveInfo(([System.IO.Path]::GetPathRoot($env:TEMP))); $L.Add('TEMP diskinde boş yer: ' + [math]::Round($dr.AvailableFreeSpace / 1GB, 1) + ' GB') } catch { }
        $lf = Join-Path $logDir 'reelses.log'
        $L.Add('')
        $L.Add('--- Son kayıt satırları ---')
        if (Test-Path -LiteralPath $lf) { foreach ($x in (Get-Content -LiteralPath $lf -Tail 40 -Encoding UTF8)) { $L.Add($x) } } else { $L.Add('(kayıt yok)') }
        $df = Join-Path $env:TEMP 'reelses-tanilama.txt'
        [System.IO.File]::WriteAllText($df, ($L -join "`r`n"), (New-Object System.Text.UTF8Encoding($true)))
        Start-Process $df
    }

    $tray = New-Object System.Windows.Forms.NotifyIcon
    try {
        $bmp = New-Object System.Drawing.Bitmap((Join-Path $web 'icon-192.png'))
        $tray.Icon = [System.Drawing.Icon]::FromHandle($bmp.GetHicon())
    } catch { $tray.Icon = [System.Drawing.SystemIcons]::Application }
    $tray.Text = 'Reel Ses sunucusu'
    $menu = New-Object System.Windows.Forms.ContextMenuStrip
    $miQr   = $menu.Items.Add('Telefon için QR göster')
    $miCopy = $menu.Items.Add('Bağlantıyı panoya kopyala')
    $miAuto = $menu.Items.Add('Windows ile başlat')
    $miAuto.CheckOnClick = $true
    $miAuto.Checked = (Test-Path -LiteralPath $lnk)
    $miDiag = $menu.Items.Add('Tanılama raporu')
    $miLog  = $menu.Items.Add('Kayıt dosyasını aç')
    $miQuit = $menu.Items.Add('Çıkış')
    $miQr.Add_Click({ Open-Qr })
    $miCopy.Add_Click({ if ($qrUrls.Count -gt 0) { try { [System.Windows.Forms.Clipboard]::SetText([string]$qrUrls[0]) } catch { } } })
    $miAuto.Add_Click({ Set-Autostart ([bool]$miAuto.Checked) })
    $miDiag.Add_Click({ Show-Diag })
    $miLog.Add_Click({ $lf2 = Join-Path $logDir 'reelses.log'; if (Test-Path -LiteralPath $lf2) { Invoke-Item $lf2 } })
    $miQuit.Add_Click({ $ui.quit = $true })
    $tray.ContextMenuStrip = $menu
    $tray.Add_DoubleClick({ Open-Qr })
    $tray.Visible = $true
    if ($Arka) { $tray.ShowBalloonTip(3000, 'Reel Ses', 'Telefon sunucusu arka planda çalışıyor.', [System.Windows.Forms.ToolTipIcon]::Info) }
    Clear-QrPages 0

    # tek calisan: indirmeleri sirayla yapar
    $wps = [powershell]::Create()
    [void]$wps.AddScript($worker).AddArgument($state).AddArgument($bin).AddArgument($browser).AddArgument($ortak).AddArgument($pin).AddArgument($tmpRoot).AddArgument($embed)
    $wh = $wps.BeginInvoke()

    $pool = [runspacefactory]::CreateRunspacePool(1, 16)
    $pool.Open()
    $jobs = New-Object System.Collections.ArrayList
    $lastClean = Get-Date

    while (-not $ui.quit) {
        [System.Windows.Forms.Application]::DoEvents()
        if (-not $listener.Pending()) {
            Start-Sleep -Milliseconds 50
            # dakikada bir: 30 dakikadan eski bitmis isleri ve dosyalarini sil
            if (((Get-Date) - $lastClean).TotalSeconds -ge 60) {
                $lastClean = Get-Date
                Clear-QrPages 10
                try {
                    $lg = Join-Path $logDir 'reelses.log'
                    if ((Test-Path -LiteralPath $lg) -and ((Get-Item -LiteralPath $lg).Length -gt 524288)) { Move-Item -LiteralPath $lg -Destination "$lg.old" -Force }
                } catch { }
                $old = [datetime]::UtcNow.AddMinutes(-30).Ticks
                $snap = @()
                [System.Threading.Monitor]::Enter($state.jobs.SyncRoot)
                try { $snap = @($state.jobs.Values) } finally { [System.Threading.Monitor]::Exit($state.jobs.SyncRoot) }
                foreach ($j in $snap) {
                    if (($j.state -eq 'done' -or $j.state -eq 'error') -and $j.finished -gt 0 -and $j.finished -lt $old) {
                        Remove-Item -LiteralPath (Join-Path $tmpRoot $j.id) -Recurse -Force -ErrorAction SilentlyContinue
                        $state.jobs.Remove($j.id)
                    }
                }
            }
            continue
        }
        $client = $listener.AcceptTcpClient()
        $ps = [powershell]::Create()
        $ps.RunspacePool = $pool
        [void]$ps.AddScript($handler).AddArgument($client).AddArgument($web).AddArgument($key).AddArgument($state)
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
    if ($logDir) { Write-Log $logDir ('HATA: ' + $_.Exception.Message) }
    if ($Arka) { try { [void][System.Windows.Forms.MessageBox]::Show('Reel Ses sunucusu başlatılamadı:' + "`n" + $_.Exception.Message, 'Reel Ses') } catch { } }
    if ($_.Exception.Message -match 'use|kullan|Only one usage') {
        Write-Host 'Port başka bir program tarafından kullanılıyor olabilir; ayarlar.txt içindeki port= değerini değiştir.'
    }
}
finally {
    if ($state) { $state.stop = $true }
    if ($tray) { try { $tray.Visible = $false; $tray.Dispose() } catch { } }
    try { [void][ReelSes.Power]::SetThreadExecutionState([uint32]2147483648) } catch { }
    if ($listener) { try { $listener.Stop() } catch { } }
}
