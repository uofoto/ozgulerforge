# Reel Ses - Windows uygulamasi (Python kurmaya gerek yok)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch {}
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()

try {
    $root    = $PSScriptRoot
    $bin     = Join-Path $root 'bin'
    $out     = Join-Path $root 'Indirilenler'
    New-Item -ItemType Directory -Force -Path $bin, $out | Out-Null
    $ytdlp   = Join-Path $bin 'yt-dlp.exe'
    $ffmpeg  = Join-Path $bin 'ffmpeg.exe'
    $ffprobe = Join-Path $bin 'ffprobe.exe'

    $cBg    = [System.Drawing.ColorTranslator]::FromHtml('#111827')
    $cField = [System.Drawing.ColorTranslator]::FromHtml('#1f2937')
    $cFg    = [System.Drawing.ColorTranslator]::FromHtml('#f3f4f6')
    $cGray  = [System.Drawing.ColorTranslator]::FromHtml('#9ca3af')
    $cPink  = [System.Drawing.ColorTranslator]::FromHtml('#ec4899')
    $cGreen = [System.Drawing.ColorTranslator]::FromHtml('#34d399')
    $cRed   = [System.Drawing.ColorTranslator]::FromHtml('#f87171')
    $cBtn   = [System.Drawing.ColorTranslator]::FromHtml('#374151')

    $form = New-Object System.Windows.Forms.Form
    $form.Text = 'Reel Ses'
    $form.ClientSize = New-Object System.Drawing.Size(520, 340)
    $form.StartPosition = 'CenterScreen'
    $form.BackColor = $cBg
    $form.ForeColor = $cFg
    $form.Font = New-Object System.Drawing.Font('Segoe UI', 10)
    $form.FormBorderStyle = 'FixedSingle'
    $form.MaximizeBox = $false

    $lblTitle = New-Object System.Windows.Forms.Label
    $lblTitle.Text = [string]([char]0x266B) + ' Reel Ses'
    $lblTitle.Font = New-Object System.Drawing.Font('Segoe UI', 18, [System.Drawing.FontStyle]::Bold)
    $lblTitle.Location = New-Object System.Drawing.Point(20, 14)
    $lblTitle.Size = New-Object System.Drawing.Size(480, 38)
    $form.Controls.Add($lblTitle)

    $lblSub = New-Object System.Windows.Forms.Label
    $lblSub.Text = 'Instagram Reel linkini yapıştır, sesi MP3 olarak indir.'
    $lblSub.ForeColor = $cGray
    $lblSub.Location = New-Object System.Drawing.Point(22, 54)
    $lblSub.Size = New-Object System.Drawing.Size(480, 24)
    $form.Controls.Add($lblSub)

    $txt = New-Object System.Windows.Forms.TextBox
    $txt.Location = New-Object System.Drawing.Point(22, 88)
    $txt.Size = New-Object System.Drawing.Size(476, 30)
    $txt.BackColor = $cField
    $txt.ForeColor = $cFg
    $txt.BorderStyle = 'FixedSingle'
    $form.Controls.Add($txt)

    $lblCk = New-Object System.Windows.Forms.Label
    $lblCk.Text = 'Instagram giriş isterse tarayıcı:'
    $lblCk.ForeColor = $cGray
    $lblCk.Location = New-Object System.Drawing.Point(22, 130)
    $lblCk.Size = New-Object System.Drawing.Size(230, 24)
    $form.Controls.Add($lblCk)

    $cmb = New-Object System.Windows.Forms.ComboBox
    $cmb.DropDownStyle = 'DropDownList'
    $cmb.FlatStyle = 'Flat'
    $cmb.BackColor = $cField
    $cmb.ForeColor = $cFg
    [void]$cmb.Items.AddRange(@('Kullanma', 'firefox', 'chrome', 'edge'))
    $cmb.SelectedIndex = 0
    $cmb.Location = New-Object System.Drawing.Point(258, 126)
    $cmb.Size = New-Object System.Drawing.Size(240, 28)
    $form.Controls.Add($cmb)

    $btn = New-Object System.Windows.Forms.Button
    $btn.Text = 'İndir'
    $btn.Font = New-Object System.Drawing.Font('Segoe UI', 11, [System.Drawing.FontStyle]::Bold)
    $btn.BackColor = $cPink
    $btn.ForeColor = [System.Drawing.Color]::White
    $btn.FlatStyle = 'Flat'
    $btn.FlatAppearance.BorderSize = 0
    $btn.Location = New-Object System.Drawing.Point(22, 170)
    $btn.Size = New-Object System.Drawing.Size(476, 46)
    $form.Controls.Add($btn)
    $form.AcceptButton = $btn

    $status = New-Object System.Windows.Forms.Label
    $status.Location = New-Object System.Drawing.Point(22, 226)
    $status.Size = New-Object System.Drawing.Size(476, 60)
    $status.ForeColor = $cFg
    $form.Controls.Add($status)

    $btnOpen = New-Object System.Windows.Forms.Button
    $btnOpen.Text = 'Klasörü aç'
    $btnOpen.BackColor = $cBtn
    $btnOpen.ForeColor = $cFg
    $btnOpen.FlatStyle = 'Flat'
    $btnOpen.FlatAppearance.BorderSize = 0
    $btnOpen.Location = New-Object System.Drawing.Point(22, 294)
    $btnOpen.Size = New-Object System.Drawing.Size(234, 34)
    $form.Controls.Add($btnOpen)

    $btnUpd = New-Object System.Windows.Forms.Button
    $btnUpd.Text = 'yt-dlp güncelle'
    $btnUpd.BackColor = $cBtn
    $btnUpd.ForeColor = $cFg
    $btnUpd.FlatStyle = 'Flat'
    $btnUpd.FlatAppearance.BorderSize = 0
    $btnUpd.Location = New-Object System.Drawing.Point(264, 294)
    $btnUpd.Size = New-Object System.Drawing.Size(234, 34)
    $form.Controls.Add($btnUpd)

    function Say($msg, $color) {
        if ($null -eq $color) { $color = $cFg }
        $status.ForeColor = $color
        $status.Text = $msg
        [System.Windows.Forms.Application]::DoEvents()
    }

    function Get-File($url, $path, $label) {
        $wc = New-Object System.Net.WebClient
        $task = $wc.DownloadFileTaskAsync($url, $path)
        while (-not $task.IsCompleted) {
            $mb = 0
            if (Test-Path $path) { $mb = [math]::Round((Get-Item $path).Length / 1MB, 1) }
            Say ("$label ($mb MB)...") $cFg
            Start-Sleep -Milliseconds 200
        }
        $wc.Dispose()
        if ($task.IsFaulted) { throw $task.Exception.InnerException }
    }

    function Ensure-Tools {
        if (-not (Test-Path $ytdlp)) {
            Get-File 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe' $ytdlp 'yt-dlp indiriliyor (ilk kurulum)'
        }
        if (-not ((Test-Path $ffmpeg) -and (Test-Path $ffprobe))) {
            $zip = Join-Path $env:TEMP 'reelses-ffmpeg.zip'
            $tmp = Join-Path $env:TEMP 'reelses-ffmpeg'
            Get-File 'https://github.com/yt-dlp/FFmpeg-Builds/releases/latest/download/ffmpeg-master-latest-win64-gpl.zip' $zip 'ffmpeg indiriliyor (ilk kurulum, biraz sürebilir)'
            Say 'ffmpeg açılıyor...' $cFg
            if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
            Expand-Archive -Path $zip -DestinationPath $tmp -Force
            Get-ChildItem -Path $tmp -Recurse -Include 'ffmpeg.exe', 'ffprobe.exe' | ForEach-Object { Copy-Item $_.FullName $bin -Force }
            Remove-Item $zip -Force -ErrorAction SilentlyContinue
            Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
        }
    }

    function Run-Tool($exe, $argString) {
        $o = Join-Path $env:TEMP 'reelses-out.txt'
        $e = Join-Path $env:TEMP 'reelses-err.txt'
        $env:PYTHONIOENCODING = 'utf-8'
        $p = Start-Process -FilePath $exe -ArgumentList $argString -PassThru -WindowStyle Hidden -RedirectStandardOutput $o -RedirectStandardError $e
        $null = $p.Handle
        while (-not $p.HasExited) {
            [System.Windows.Forms.Application]::DoEvents()
            Start-Sleep -Milliseconds 100
        }
        $p.WaitForExit()
        $so = ''; $se = ''
        if (Test-Path $o) { $so = [string](Get-Content $o -Raw -Encoding UTF8) }
        if (Test-Path $e) { $se = [string](Get-Content $e -Raw -Encoding UTF8) }
        return [pscustomobject]@{ Code = $p.ExitCode; Out = $so; Err = $se }
    }

    $btn.Add_Click({
        $url = $txt.Text.Trim()
        if ($url -notmatch 'instagram\.com/') {
            Say 'Geçerli bir Instagram linki yapıştır.' $cRed
            return
        }
        $btn.Enabled = $false
        $btnUpd.Enabled = $false
        try {
            Ensure-Tools
            Say 'Ses indiriliyor, biraz sürebilir...' $cFg
            $start = Get-Date
            $a = "-x --audio-format mp3 --audio-quality 0 --no-playlist --windows-filenames --ffmpeg-location `"$bin`" -P `"$out`" -o `"%(title).60s.%(ext)s`""
            if ($cmb.SelectedIndex -gt 0) { $a += ' --cookies-from-browser ' + $cmb.SelectedItem }
            $a += " `"$url`""
            $r = Run-Tool $ytdlp $a
            $file = $null
            if ($r.Code -eq 0) {
                $file = Get-ChildItem $out -Filter *.mp3 -ErrorAction SilentlyContinue |
                    Where-Object { $_.LastWriteTime -ge $start.AddSeconds(-3) } |
                    Sort-Object LastWriteTime -Descending | Select-Object -First 1
            }
            if ($file) {
                Say ('Hazır: ' + $file.Name) $cGreen
            } else {
                $all = $r.Err + "`n" + $r.Out
                $line = ($all -split "`r?`n" | Where-Object { $_ -match 'ERROR' } | Select-Object -Last 1)
                if (-not $line) { $line = 'Bilinmeyen hata.' }
                if ($line.Length -gt 220) { $line = $line.Substring(0, 220) + '...' }
                if ($all -match 'login|cookie|rate-limit|empty media|restricted') {
                    Say ("Instagram giriş istiyor olabilir. Yukarıdan tarayıcını seç (Firefox en sorunsuzu; o tarayıcıda Instagram'a giriş yapmış ve tarayıcı kapalı olmalı) ve tekrar dene.`n" + $line) $cRed
                } else {
                    Say ($line + "`n'yt-dlp güncelle' butonunu deneyebilirsin.") $cRed
                }
            }
        } catch {
            Say ('Hata: ' + $_.Exception.Message) $cRed
        } finally {
            $btn.Enabled = $true
            $btnUpd.Enabled = $true
        }
    })

    $btnOpen.Add_Click({ Invoke-Item $out })

    $btnUpd.Add_Click({
        $btn.Enabled = $false
        $btnUpd.Enabled = $false
        try {
            if (-not (Test-Path $ytdlp)) { Ensure-Tools }
            Say 'yt-dlp güncelleniyor...' $cFg
            $r = Run-Tool $ytdlp '-U'
            $last = (($r.Out + "`n" + $r.Err) -split "`r?`n" | Where-Object { $_.Trim() } | Select-Object -Last 1)
            Say ('Güncelleme: ' + $last) $cGreen
        } catch {
            Say ('Hata: ' + $_.Exception.Message) $cRed
        } finally {
            $btn.Enabled = $true
            $btnUpd.Enabled = $true
        }
    })

    $form.Add_Shown({
        try {
            $c = [System.Windows.Forms.Clipboard]::GetText()
            if ($c -match 'https?://(www\.)?instagram\.com/\S+') { $txt.Text = $Matches[0] }
        } catch {}
        $txt.Focus()
    })

    [void]$form.ShowDialog()
}
catch {
    [System.Windows.Forms.MessageBox]::Show("Uygulama başlatılamadı:`n" + $_.Exception.Message, 'Reel Ses') | Out-Null
}
