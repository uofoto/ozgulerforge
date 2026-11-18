// Hata sınıfları, kullanıcıya gösterilecek hata metinleri. DOM'a dokunmaz.

export const KIND_SHORT = { quota: 'kota dolu', network: 'bağlantı hatası', auth: 'anahtar sorunu', billing: 'bakiye yetersiz', notfound: 'bulunamadı', overloaded: 'yoğun', timeout: 'zaman aşımı', empty: 'boş yanıt', badrequest: 'isteği reddetti', other: 'hata' };
export const FAIL_TITLES = {
  network: 'Bağlantı kurulamadı', auth: 'API anahtarı sorunu', billing: 'Bakiye veya kredi yetersiz', notfound: 'Model bulunamadı',
  overloaded: 'Model şu an yoğun', timeout: 'Yanıt zaman aşımına uğradı', unsupported: 'Bu motor eklenen dosyayı okuyamıyor',
  toolarge: 'Ekler çok büyük', blocked: 'İstek engellendi', empty: 'Model boş yanıt verdi', badrequest: 'İstek kabul edilmedi',
  mixed: 'Hiçbir motor yanıt veremedi', other: 'Motor hatası'
};
export const FAIL_ADVICE = {
  network: 'İnternet bağlantınızı kontrol edip tekrar deneyin. Bu bir kota sorunu değil.',
  auth: 'Motor ayarlarından API anahtarınızı kontrol edin; anahtar geçersiz veya kısıtlı olabilir.',
  billing: 'Sağlayıcı hesabınızdaki bakiyeyi kontrol edin.',
  notfound: 'Bu model artık kullanılamıyor olabilir. Oforge AI Otomatik başka bir motor seçecektir.',
  overloaded: 'Sağlayıcı geçici olarak yoğun. Biraz sonra tekrar deneyin.',
  timeout: 'Motor zamanında yanıt vermedi. Tekrar deneyin.',
  unsupported: 'Dosya bu motora gönderilmedi.',
  toolarge: 'Daha az veya daha küçük dosya ekleyin ya da yeni bir çalışma başlatın.',
  blocked: 'İsteğiniz sağlayıcının güvenlik filtresine takıldı. İfadeyi değiştirip tekrar deneyin.',
  empty: 'Tekrar deneyin.',
  badrequest: 'Model bu içeriği kabul etmedi.',
  mixed: 'Kota sorunları biraz beklemekle, bağlantı sorunları internetinizi kontrol etmekle düzelir.',
  other: 'Motor ayarlarınızı kontrol edin.'
};

export function mkErr(kind, message, extra) { const e = new Error(message); e.kind = kind; if (extra) Object.assign(e, extra); return e; }

export function formatFailure(err) {
  const kind = err.kind || 'other';
  let out = '> **' + (FAIL_TITLES[kind] || FAIL_TITLES.other) + '**\n> ' + (FAIL_ADVICE[kind] || FAIL_ADVICE.other);
  const at = Array.isArray(err.attempts) ? err.attempts : [];
  if (kind === 'mixed') out += '\n\n' + at.map(a => '- ' + a.model.label + ': ' + (KIND_SHORT[a.kind] || 'hata')).join('\n');
  else if (err.message) out += '\n\n*Ayrıntı: ' + err.message + '*';
  return out;
}
