# Reel Ses - Windows uygulamasi (Python kurmaya gerek yok)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch {}
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()

try {
    $root    = $PSScriptRoot
    . (Join-Path $root 'Ortak.ps1')
    $pin     = (Read-Settings $root)['ytdlp_surum']
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
    $form.ClientSize = New-Object System.Drawing.Size(520, 538)
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
    $lblSub.Text = 'Reel linklerini yapıştır (her satıra bir tane; birden fazla olabilir).'
    $lblSub.ForeColor = $cGray
    $lblSub.Location = New-Object System.Drawing.Point(22, 54)
    $lblSub.Size = New-Object System.Drawing.Size(480, 24)
    $form.Controls.Add($lblSub)

    $txt = New-Object System.Windows.Forms.TextBox
    $txt.Location = New-Object System.Drawing.Point(22, 88)
    $txt.Size = New-Object System.Drawing.Size(476, 62)
    $txt.Multiline = $true
    $txt.AcceptsReturn = $true
    $txt.ScrollBars = 'Vertical'
    $txt.BackColor = $cField
    $txt.ForeColor = $cFg
    $txt.BorderStyle = 'FixedSingle'
    $form.Controls.Add($txt)

    $lblFmt = New-Object System.Windows.Forms.Label
    $lblFmt.Text = 'Ne indirilsin:'
    $lblFmt.ForeColor = $cGray
    $lblFmt.Location = New-Object System.Drawing.Point(22, 164)
    $lblFmt.Size = New-Object System.Drawing.Size(230, 24)
    $form.Controls.Add($lblFmt)

    $cmbFmt = New-Object System.Windows.Forms.ComboBox
    $cmbFmt.DropDownStyle = 'DropDownList'
    $cmbFmt.FlatStyle = 'Flat'
    $cmbFmt.BackColor = $cField
    $cmbFmt.ForeColor = $cFg
    [void]$cmbFmt.Items.AddRange(@('Ses (MP3)', 'Ses (M4A, daha hızlı)', 'Video (MP4, en iyi kalite)', 'Video (MP4, en çok 1080p)', 'Video (MP4, en çok 720p)'))
    $cmbFmt.SelectedIndex = 0
    $cmbFmt.Location = New-Object System.Drawing.Point(258, 160)
    $cmbFmt.Size = New-Object System.Drawing.Size(240, 28)
    $form.Controls.Add($cmbFmt)

    $lblCk = New-Object System.Windows.Forms.Label
    $lblCk.Text = 'Instagram giriş isterse tarayıcı:'
    $lblCk.ForeColor = $cGray
    $lblCk.Location = New-Object System.Drawing.Point(22, 204)
    $lblCk.Size = New-Object System.Drawing.Size(230, 24)
    $form.Controls.Add($lblCk)

    $cmb = New-Object System.Windows.Forms.ComboBox
    $cmb.DropDownStyle = 'DropDownList'
    $cmb.FlatStyle = 'Flat'
    $cmb.BackColor = $cField
    $cmb.ForeColor = $cFg
    [void]$cmb.Items.AddRange(@('Kullanma', 'firefox', 'chrome', 'edge'))
    $cmb.SelectedIndex = 0
    $cmb.Location = New-Object System.Drawing.Point(258, 200)
    $cmb.Size = New-Object System.Drawing.Size(240, 28)
    $form.Controls.Add($cmb)

    $lblTr = New-Object System.Windows.Forms.Label
    $lblTr.Text = 'Kırp: başlangıç / bitiş (boş = tamamı):'
    $lblTr.ForeColor = $cGray
    $lblTr.Location = New-Object System.Drawing.Point(22, 238)
    $lblTr.Size = New-Object System.Drawing.Size(230, 24)
    $form.Controls.Add($lblTr)

    $txtBas = New-Object System.Windows.Forms.TextBox
    $txtBas.BackColor = $cField
    $txtBas.ForeColor = $cFg
    $txtBas.BorderStyle = 'FixedSingle'
    $txtBas.Location = New-Object System.Drawing.Point(258, 236)
    $txtBas.Size = New-Object System.Drawing.Size(114, 26)
    $form.Controls.Add($txtBas)

    $txtBit = New-Object System.Windows.Forms.TextBox
    $txtBit.BackColor = $cField
    $txtBit.ForeColor = $cFg
    $txtBit.BorderStyle = 'FixedSingle'
    $txtBit.Location = New-Object System.Drawing.Point(384, 236)
    $txtBit.Size = New-Object System.Drawing.Size(114, 26)
    $form.Controls.Add($txtBit)

    $chkNorm = New-Object System.Windows.Forms.CheckBox
    $chkNorm.Text = 'Ses seviyesini eşitle (yalnızca MP3)'
    $chkNorm.ForeColor = $cFg
    $chkNorm.Location = New-Object System.Drawing.Point(22, 266)
    $chkNorm.Size = New-Object System.Drawing.Size(476, 26)
    $form.Controls.Add($chkNorm)

    $chk = New-Object System.Windows.Forms.CheckBox
    $chk.Text = 'Bu içeriği indirme hakkım olduğunu ve yalnızca kişisel kullanım için indireceğimi onaylıyorum.'
    $chk.ForeColor = $cFg
    $chk.Location = New-Object System.Drawing.Point(22, 296)
    $chk.Size = New-Object System.Drawing.Size(476, 44)
    $chk.Checked = (Get-Consent $root)
    $form.Controls.Add($chk)

    $btn = New-Object System.Windows.Forms.Button
    $btn.Text = 'İndir'
    $btn.Font = New-Object System.Drawing.Font('Segoe UI', 11, [System.Drawing.FontStyle]::Bold)
    $btn.BackColor = $cPink
    $btn.ForeColor = [System.Drawing.Color]::White
    $btn.FlatStyle = 'Flat'
    $btn.FlatAppearance.BorderSize = 0
    $btn.Location = New-Object System.Drawing.Point(22, 348)
    $btn.Size = New-Object System.Drawing.Size(476, 46)
    $form.Controls.Add($btn)
    $form.AcceptButton = $btn

    $pb = New-Object System.Windows.Forms.ProgressBar
    $pb.Minimum = 0
    $pb.Maximum = 100
    $pb.Location = New-Object System.Drawing.Point(22, 404)
    $pb.Size = New-Object System.Drawing.Size(476, 10)
    $pb.Visible = $false
    $form.Controls.Add($pb)

    $status = New-Object System.Windows.Forms.Label
    $status.Location = New-Object System.Drawing.Point(22, 420)
    $status.Size = New-Object System.Drawing.Size(476, 56)
    $status.ForeColor = $cFg
    $form.Controls.Add($status)

    $btnOpen = New-Object System.Windows.Forms.Button
    $btnOpen.Text = 'Klasörü aç'
    $btnOpen.BackColor = $cBtn
    $btnOpen.ForeColor = $cFg
    $btnOpen.FlatStyle = 'Flat'
    $btnOpen.FlatAppearance.BorderSize = 0
    $btnOpen.Location = New-Object System.Drawing.Point(22, 488)
    $btnOpen.Size = New-Object System.Drawing.Size(150, 34)
    $form.Controls.Add($btnOpen)

    $btnUpd = New-Object System.Windows.Forms.Button
    $btnUpd.Text = 'yt-dlp güncelle'
    $btnUpd.BackColor = $cBtn
    $btnUpd.ForeColor = $cFg
    $btnUpd.FlatStyle = 'Flat'
    $btnUpd.FlatAppearance.BorderSize = 0
    $btnUpd.Location = New-Object System.Drawing.Point(184, 488)
    $btnUpd.Size = New-Object System.Drawing.Size(150, 34)
    $form.Controls.Add($btnUpd)

    $btnLegal = New-Object System.Windows.Forms.Button
    $btnLegal.Text = 'Yasal not'
    $btnLegal.BackColor = $cBtn
    $btnLegal.ForeColor = $cFg
    $btnLegal.FlatStyle = 'Flat'
    $btnLegal.FlatAppearance.BorderSize = 0
    $btnLegal.Location = New-Object System.Drawing.Point(346, 488)
    $btnLegal.Size = New-Object System.Drawing.Size(152, 34)
    $form.Controls.Add($btnLegal)

    function Say($msg, $color) {
        if ($null -eq $color) { $color = $cFg }
        $status.ForeColor = $color
        $status.Text = $msg
        [System.Windows.Forms.Application]::DoEvents()
    }

    # Ortak.ps1 icin geri cagrilar (durum yazisini gunceller)
    $tick = { param($mb) Say ("İndiriliyor ($mb MB)...") $cFg }
    $info = { param($m) Say $m $cFg }
    $ui = @{ toolsOk = $false; prefix = '' }
    $embedOn = ((Read-Settings $root)['kapak'] -ne 'hayir')

    function Set-Bar($pct) {
        if ($null -eq $pct) { $pb.Visible = $false; return }
        $pb.Visible = $true
        $pb.Value = [math]::Max(0, [math]::Min(100, [int]$pct))
    }

    # yt-dlp'nin --newline ciktisindan ilerlemeyi okur
    function Read-Progress([string]$file) {
        try {
            $fs = New-Object System.IO.FileStream($file, 'Open', 'Read', 'ReadWrite')
            try {
                $sr = New-Object System.IO.StreamReader($fs, [System.Text.Encoding]::UTF8)
                $t = $sr.ReadToEnd()
            } finally { $fs.Dispose() }
        } catch { return $null }
        $m = [regex]::Matches($t, '\[download\]\s+(\d+(?:\.\d+)?)%')
        $parts = ([regex]::Matches($t, '\[download\] Destination:')).Count
        $conv = [regex]::IsMatch($t, '\[(ExtractAudio|Merger|VideoConvertor)\]')
        $pct = $null
        if ($m.Count -gt 0) { $pct = [double]$m[$m.Count - 1].Groups[1].Value }
        return [pscustomobject]@{ Pct = $pct; Parts = $parts; Convert = $conv }
    }

    function Run-Tool($exe, $argString, [switch]$Progress) {
        $o = Join-Path $env:TEMP 'reelses-out.txt'
        $e = Join-Path $env:TEMP 'reelses-err.txt'
        $env:PYTHONIOENCODING = 'utf-8'
        $p = Start-Process -FilePath $exe -ArgumentList $argString -PassThru -WindowStyle Hidden -RedirectStandardOutput $o -RedirectStandardError $e
        $null = $p.Handle
        $i = 0
        while (-not $p.HasExited) {
            [System.Windows.Forms.Application]::DoEvents()
            Start-Sleep -Milliseconds 100
            $i++
            if ($Progress -and ($i % 5 -eq 0)) {
                $pr = Read-Progress $o
                if ($pr) {
                    if ($pr.Convert) { Set-Bar 100; Say ($ui.prefix + 'Dönüştürülüyor...') $cFg }
                    elseif ($null -ne $pr.Pct) {
                        Set-Bar $pr.Pct
                        $label = 'İndiriliyor'
                        if ($pr.Parts -gt 1) { $label += " (parça $($pr.Parts))" }
                        Say ($ui.prefix + $label + ' %' + [int]$pr.Pct) $cFg
                    }
                }
            }
        }
        $p.WaitForExit()
        $so = ''; $se = ''
        if (Test-Path $o) { $so = [string](Get-Content $o -Raw -Encoding UTF8) }
        if (Test-Path $e) { $se = [string](Get-Content $e -Raw -Encoding UTF8) }
        return [pscustomobject]@{ Code = $p.ExitCode; Out = $so; Err = $se }
    }

    $btn.Add_Click({
        $links = @([regex]::Matches($txt.Text, 'https?://(?:www\.)?instagram\.com/\S+') | ForEach-Object { $_.Value } | Where-Object { Test-IgUrl $_ } | Select-Object -Unique)
        if ($links.Count -eq 0) {
            Say 'Geçerli bir Instagram Reel linki yapıştır (https://www.instagram.com/reel/...).' $cRed
            return
        }
        if (-not $chk.Checked) {
            Say 'Devam etmek için onay kutusunu işaretle.' $cRed
            return
        }
        $btn.Enabled = $false
        $btnUpd.Enabled = $false
        $ok = 0; $fail = 0; $skip = 0; $lastErr = ''
        try {
            if (-not $ui.toolsOk) {
                Initialize-Tools $bin $pin $tick $info
                $ui.toolsOk = $true
            }
            $bas = ConvertTo-Seconds $txtBas.Text
            $bit = ConvertTo-Seconds $txtBit.Text
            if ($bas -lt 0 -or $bit -lt 0) { Say 'Kırpma süresi biçimi: 90 veya 1:30 (dakika:saniye).' $cRed; return }
            if ($bit -gt 0 -and $bit -le $bas) { Say 'Kırpma bitişi, başlangıçtan büyük olmalı.' $cRed; return }
            switch ($cmbFmt.SelectedIndex) {
                0 { $opt = @{ format = 'audio'; ses = 'mp3'; hd = 0 } }
                1 { $opt = @{ format = 'audio'; ses = 'm4a'; hd = 0 } }
                2 { $opt = @{ format = 'video'; ses = 'mp3'; hd = 0 } }
                3 { $opt = @{ format = 'video'; ses = 'mp3'; hd = 1080 } }
                default { $opt = @{ format = 'video'; ses = 'mp3'; hd = 720 } }
            }
            $opt.bas = $bas
            $opt.bit = $bit
            $opt.norm = ($chkNorm.Checked -and $opt.format -eq 'audio' -and $opt.ses -eq 'mp3')
            $ext = Get-ExtOf $opt
            $br = ''
            if ($cmb.SelectedIndex -gt 0) { $br = [string]$cmb.SelectedItem }
            for ($n = 0; $n -lt $links.Count; $n++) {
                $url = $links[$n]
                $ui.prefix = ''
                if ($links.Count -gt 1) { $ui.prefix = '(' + ($n + 1) + '/' + $links.Count + ') ' }
                # daha once indirilmis mi?
                $code = Get-IgCode $url
                if ($code) {
                    $wantTrim = (($bas -gt 0) -or ($bit -gt 0))
                    $old = Get-ChildItem $out -Filter "*$code*.$ext" -ErrorAction SilentlyContinue |
                        Where-Object { (($_.Name -match 'kirpik') -eq $wantTrim) } | Select-Object -First 1
                    if ($old) {
                        if ($links.Count -gt 1) { $skip++; continue }
                        $ans = [System.Windows.Forms.MessageBox]::Show("Bu zaten indirilmiş:`n" + $old.Name + "`n`nYine de yeniden indirilsin mi?", 'Reel Ses', 'YesNo', 'Question')
                        if ($ans -ne 'Yes') { Say ('Zaten indirilmiş: ' + $old.Name) $cGreen; return }
                        Remove-Item -LiteralPath $old.FullName -Force -ErrorAction SilentlyContinue
                    }
                }
                Set-Bar 0
                Say ($ui.prefix + 'Başlıyor...') $cFg
                $start = Get-Date
                $emb = $embedOn
                $r = Run-Tool $ytdlp (Build-YtArgs $opt $bin $out $url $br $emb) -Progress
                $all = $r.Err + "`n" + $r.Out
                $login = ($all -match 'login|cookie|rate-limit|empty media|restricted')
                # kapak/baslik gomme sorun cikardiysa gomsuz bir kez daha dene
                if ($r.Code -ne 0 -and $emb -and -not $login) {
                    $emb = $false
                    $r = Run-Tool $ytdlp (Build-YtArgs $opt $bin $out $url $br $emb) -Progress
                    $all = $r.Err + "`n" + $r.Out
                    $login = ($all -match 'login|cookie|rate-limit|empty media|restricted')
                }
                # Instagram degismis olabilir: yt-dlp'yi guncelleyip bir kez daha dene
                if ($r.Code -ne 0 -and -not $login -and (-not $pin)) {
                    Set-Bar $null
                    Say ($ui.prefix + 'İndirilemedi; yt-dlp güncelleniyor ve yeniden deneniyor...') $cFg
                    $u = ''
                    try { $u = Update-YtDlp $bin '' $tick } catch { }
                    if ($u -eq 'guncellendi') {
                        $start = Get-Date
                        $r = Run-Tool $ytdlp (Build-YtArgs $opt $bin $out $url $br $emb) -Progress
                        $all = $r.Err + "`n" + $r.Out
                        $login = ($all -match 'login|cookie|rate-limit|empty media|restricted')
                    }
                }
                $file = $null
                if ($r.Code -eq 0) {
                    $file = Get-ChildItem $out -Filter "*.$ext" -ErrorAction SilentlyContinue |
                        Where-Object { $_.LastWriteTime -ge $start.AddSeconds(-3) } |
                        Sort-Object LastWriteTime -Descending | Select-Object -First 1
                }
                if ($file) {
                    $ok++
                    Set-Bar 100
                    Say ($ui.prefix + 'Hazır: ' + $file.Name) $cGreen
                } else {
                    $fail++
                    $line = ($all -split "`r?`n" | Where-Object { $_ -match 'ERROR' } | Select-Object -Last 1)
                    if (-not $line) { $line = 'Bilinmeyen hata.' }
                    if ($line.Length -gt 200) { $line = $line.Substring(0, 200) + '...' }
                    $lastErr = $line
                    if ($login) { $lastErr += "`nInstagram giriş istiyor olabilir: yukarıdan tarayıcını seç (o tarayıcıda Instagram'a giriş yapmış ve tarayıcı kapalı olmalı)." }
                    Write-Log (Join-Path $root 'kayit') ("Masaüstü hata: $url :: $line")
                    if ($links.Count -eq 1) { Set-Bar $null; Say ($lastErr + "`n'yt-dlp güncelle' butonunu deneyebilirsin.") $cRed }
                }
            }
            if ($links.Count -gt 1) {
                $msg = "Bitti: $ok indirildi"
                if ($skip) { $msg += ", $skip zaten vardı (atlandı)" }
                if ($fail) { $msg += ", $fail hata" }
                if ($fail) { Set-Bar $null; Say ($msg + "`nSon hata: " + $lastErr) $cRed } else { Say $msg $cGreen }
            }
        } catch {
            Set-Bar $null
            Say ('Hata: ' + $_.Exception.Message) $cRed
        } finally {
            $ui.prefix = ''
            $btn.Enabled = $true
            $btnUpd.Enabled = $true
        }
    })

    $chk.Add_CheckedChanged({ Set-Consent $root $chk.Checked })

    $btnOpen.Add_Click({ Invoke-Item $out })

    $btnLegal.Add_Click({
        $f = Join-Path $root 'YASAL-NOT.txt'
        if (Test-Path $f) { Invoke-Item $f } else { Say 'YASAL-NOT.txt bulunamadı.' $cRed }
    })

    $btnUpd.Add_Click({
        $btn.Enabled = $false
        $btnUpd.Enabled = $false
        try {
            if (-not $ui.toolsOk) { Initialize-Tools $bin $pin $tick $info; $ui.toolsOk = $true }
            Say 'yt-dlp sürümü kontrol ediliyor...' $cFg
            $u = Update-YtDlp $bin $pin $tick
            if ($u -eq 'guncel') { Say 'yt-dlp zaten güncel ✓' $cGreen }
            elseif ($u -eq 'guncellendi') { Say 'yt-dlp güncellendi ✓ (sağlama toplamı doğrulandı)' $cGreen }
            else { Say 'yt-dlp kuruldu ✓' $cGreen }
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
        # Acilista: araclari dogrula, gunde bir yt-dlp guncellemesi var mi bak
        $btn.Enabled = $false
        $btnUpd.Enabled = $false
        try {
            Initialize-Tools $bin $pin $tick $info
            $ui.toolsOk = $true
            if ((-not $pin) -and (Test-UpdateDue $bin 20)) {
                Say 'yt-dlp sürümü kontrol ediliyor...' $cFg
                try {
                    $u = Update-YtDlp $bin '' $tick
                    if ($u -eq 'guncellendi') { Say 'yt-dlp otomatik güncellendi ✓' $cGreen } else { Say '' $cFg }
                } catch { Say ('yt-dlp güncelleme kontrolü yapılamadı: ' + $_.Exception.Message) $cGray }
            } else { Say '' $cFg }
        } catch {
            Say ('Araç kontrolü: ' + $_.Exception.Message) $cRed
        } finally {
            $btn.Enabled = $true
            $btnUpd.Enabled = $true
        }
    })

    [void]$form.ShowDialog()
}
catch {
    [System.Windows.Forms.MessageBox]::Show("Uygulama başlatılamadı:`n" + $_.Exception.Message, 'Reel Ses') | Out-Null
}
