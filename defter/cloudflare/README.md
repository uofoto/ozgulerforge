# Defter için Cloudflare yedeği: kurulum

Bu işlem bir kez yapılır ve yaklaşık 10 dakika sürer. Ücretsiz plan yeterlidir. Cloudflare panelindeki menü adları zamanla küçük farklılıklar gösterebilir, ama adımların sırası aynıdır.

**Güvenlik özeti:** Notların cihazda, senin parolanla şifrelenir. Cloudflare yalnızca şifreli veriyi ve notun tarihini görür. Başlık ve metin dahil hiçbir içerik okunamaz. Parola hiçbir yere gönderilmez. **Parolayı unutursan buluttaki yedek açılamaz.**

## 1. Veritabanı (D1)
1. Cloudflare paneli → **Storage & Databases** → **D1 SQL Database** → **Create database**.
2. Ad olarak `defter` yaz, oluştur.
3. Açılan veritabanında **Console** sekmesine git. `schema.sql` dosyasının içindekileri yapıştırıp **Execute** de.

## 2. Worker
1. **Workers & Pages** → **Create** → **Create Worker**. Ad: `defter-sync`. **Deploy** de (örnek kodla kalsın).
2. **Edit code** de. Soldaki dosyadaki her şeyi silip `worker.js` dosyasının içindekileri yapıştır. **Deploy** de.

## 3. Bağlantılar
Worker sayfasında **Settings** bölümüne git.
1. **Bindings** → **Add** → **D1 database**. Değişken adı **tam olarak `DB`** olmalı. Veritabanı olarak `defter` seç.
2. **Variables and Secrets** → **Add**:
   - Tür **Secret**, ad `SYNC_TOKEN`, değer: Defter'in "Anahtar üret" düğmesinin verdiği anahtar (adım 4'te üreteceksin).
   - Tür **Text**, ad `ALLOWED_ORIGIN`, değer `https://ozgulerforge.com.tr` (yol olmadan, sadece adres). Bu, yalnızca senin sitenin Worker'a ulaşmasını sağlar.
3. **Deploy** de. Worker'ın adresi `https://defter-sync.HESAP-ADIN.workers.dev` biçimindedir. Bunu not al.

## 4. Defter'de bağlan
1. Defter → **Yedek** → **Cloudflare yedeği** → **Bağlan**.
2. Worker adresini yapıştır. **Anahtar üret**'e bas, çıkan anahtarı **Kopyala**'yla al ve adım 3'teki `SYNC_TOKEN` değerine yapıştır (yapmadıysan şimdi yap, sonra Deploy).
3. Kendi seçeceğin bir **parola** yaz (en az 8 karakter) ve güvenli bir yere not et.
4. **Bağlan**'a bas. İlk eşitleme notlarını buluta gönderir.

## Telefonu ya da başka cihazı bağlamak
Aynı adım 4'ü yap: aynı **adres**, aynı **anahtar**, aynı **parola**. İlk eşitlemede notlar cihaza iner. Adres ile anahtarı ilk cihazdan **Bilgiyi kopyala** düğmesiyle alabilirsin. Parola kopyalanmaz, onu sen girmelisin.

## Günlük kullanım
Notu kaydedince birkaç saniye içinde, uygulamayı açınca ve internet geri gelince kendiliğinden eşitlenir. **Şimdi eşitle** ile elle de başlatabilirsin. **Buluttan yeniden al**, cihazdaki notların yoksa ya da bozulduysa buluttaki her şeyi getirir (öncesinde otomatik anlık görüntü alınır).

## Sorun giderme
- **"Erişim anahtarı reddedildi":** `SYNC_TOKEN` ile uygulamadaki anahtar aynı değil. Başında ya da sonunda boşluk olmasın. Değeri değiştirdiysen Worker'ı yeniden Deploy et.
- **"Sunucuya ulaşılamadı":** Adres yanlış ya da `ALLOWED_ORIGIN` sitenin adresiyle birebir aynı değil (sonunda `/` olmamalı).
- **"Parola yanlış":** Bu yedek başka bir parolayla oluşturulmuş.
- **Sunucu hatası (500):** `DB` bağlantısı yok ya da adı yanlış, ya da `schema.sql` çalıştırılmamış.

## Komut satırıyla kurmak istersen
`wrangler.toml` içindeki `database_id` değerini doldur, sonra: `npx wrangler d1 execute defter --remote --file=schema.sql`, `npx wrangler secret put SYNC_TOKEN`, `npx wrangler deploy`.

## Notlar
- Eşitleme, aynı not iki cihazda değişirse **son değiştirilen** sürümü tutar (cihaz saatleri doğru olmalı).
- Ücretsiz planda günde yüz binlerce istek ve yüz bin satır yazma hakkın var. Kişisel arşiv için çok geniş bir pay.
