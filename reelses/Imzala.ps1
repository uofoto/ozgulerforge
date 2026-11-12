# Reel Ses - betikleri dijital imzalar (Authenticode).
#   Imzala.ps1                       -> kendi (self-signed) sertifikani uretip bu bilgisayarda guvenilir yapar
#   Imzala.ps1 -Pfx C:\yol\imza.pfx  -> senin kod imzalama sertifikanla imzalar (parola sorulur)
# Kendi sertifikan yalnizca BU bilgisayarda guvenilir; baska bilgisayarlarda "bilinmeyen yayinci" gorunur.
# Herkese acik guven icin bir sertifika otoritesinden (ucretli) kod imzalama sertifikasi gerekir.
param([string]$Pfx = '')
$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
try {
    $cert = $null
    if ($Pfx) {
        $cert = Get-PfxCertificate -FilePath $Pfx
    } else {
        $ad = 'CN=Reel Ses (kendi imza)'
        $cert = Get-ChildItem Cert:\CurrentUser\My -CodeSigningCert | Where-Object { $_.Subject -eq $ad -and $_.NotAfter -gt (Get-Date).AddDays(30) } | Select-Object -First 1
        if (-not $cert) {
            Write-Host 'Kendi imza sertifikan oluşturuluyor...'
            $cert = New-SelfSignedCertificate -Type CodeSigningCert -Subject $ad -CertStoreLocation Cert:\CurrentUser\My -NotAfter (Get-Date).AddYears(5)
        }
        # bu bilgisayarda guvenilir yayinci yap
        $cer = Join-Path $env:TEMP 'reelses-imza.cer'
        [void](Export-Certificate -Cert $cert -FilePath $cer)
        foreach ($st in 'TrustedPublisher', 'Root') {
            $has = Get-ChildItem "Cert:\CurrentUser\$st" | Where-Object { $_.Thumbprint -eq $cert.Thumbprint }
            if (-not $has) {
                Write-Host "Sertifika '$st' deposuna ekleniyor (Windows onay penceresi çıkabilir; Evet de)..."
                [void](Import-Certificate -FilePath $cer -CertStoreLocation "Cert:\CurrentUser\$st")
            }
        }
        Remove-Item -LiteralPath $cer -Force -ErrorAction SilentlyContinue
    }
    $ok = 0; $bad = 0
    foreach ($f in (Get-ChildItem -LiteralPath $PSScriptRoot -Filter '*.ps1')) {
        $r = $null
        try { $r = Set-AuthenticodeSignature -FilePath $f.FullName -Certificate $cert -TimestampServer 'http://timestamp.digicert.com' -HashAlgorithm SHA256 }
        catch { $r = Set-AuthenticodeSignature -FilePath $f.FullName -Certificate $cert -HashAlgorithm SHA256 }
        if ($r.Status -eq 'Valid' -or $r.Status -eq 'UnknownError') { Write-Host ("İmzalandı: " + $f.Name) -ForegroundColor Green; $ok++ }
        else { Write-Host ("İmzalanamadı: " + $f.Name + ' - ' + $r.StatusMessage) -ForegroundColor Red; $bad++ }
    }
    Write-Host ''
    Write-Host "Bitti: $ok imzalandı, $bad hata."
    Write-Host 'Kontrol için: Get-AuthenticodeSignature .\Sunucu.ps1'
    Write-Host 'Not: Bir betiği düzenlersen imza bozulur; Imzala.ps1''i yeniden çalıştır.'
}
catch {
    Write-Host ('HATA: ' + $_.Exception.Message) -ForegroundColor Red
}
