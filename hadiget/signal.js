// Sunucusuz eşleşme: WebRTC oturum açıklamasını (SDP) QR koda sığacak kadar
// küçük bir koda dönüştürür ve geri çevirir.
//
// Kod biçimi:  "o.<base64url>"  (teklif)   |   "a.<base64url>"  (cevap)
// İçerik:      ufrag | pwd | sha-256 parmak izi | aday1;aday2;...
//
// Yalnızca veri kanalı için gereken alanlar taşınır; geri kalanı
// codeToDesc() içinde standart bir veri kanalı SDP'sine yeniden kurulur.

import { t } from './i18n.js';

const toB64u = (s) => {
  let bin = '';
  new TextEncoder().encode(s).forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const fromB64u = (t) => {
  t = t.replace(/-/g, '+').replace(/_/g, '/');
  while (t.length % 4) t += '=';
  const bin = atob(t);
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
};

export function descToCode(desc) {
  const sdp = desc.sdp;
  const grab = (re, what) => {
    const m = sdp.match(re);
    if (!m) throw new Error(t('sig.missing', { what }));
    return m[1].trim();
  };
  const ufrag = grab(/^a=ice-ufrag:(.+)$/m, 'ice-ufrag');
  const pwd = grab(/^a=ice-pwd:(.+)$/m, 'ice-pwd');
  const fp = grab(/^a=fingerprint:sha-256 (.+)$/m, 'parmak izi').replace(/:/g, '');
  const cands = [...sdp.matchAll(/^a=candidate:(.+)$/gm)]
    .map((m) => m[1].split(' generation')[0].trim())
    .filter((c) => / udp /i.test(c))
    .slice(0, 6);
  if (!cands.length) {
    throw new Error(t('sig.noAddr'));
  }
  const kind = desc.type === 'offer' ? 'o' : 'a';
  return kind + '.' + toB64u([ufrag, pwd, fp, cands.join(';')].join('|'));
}

export function codeToDesc(code) {
  const m = /^([oa])\.([A-Za-z0-9_-]+)$/.exec(code);
  if (!m) throw new Error(t('sig.invalid'));
  let parts;
  try {
    parts = fromB64u(m[2]).split('|');
  } catch {
    throw new Error(t('sig.unreadable'));
  }
  const [ufrag, pwd, fp, cs] = parts;
  if (!ufrag || !pwd || !fp || fp.length !== 64) throw new Error(t('sig.broken'));
  const type = m[1] === 'o' ? 'offer' : 'answer';
  const lines = [
    'v=0',
    'o=- 1 2 IN IP4 127.0.0.1',
    's=-',
    't=0 0',
    'a=group:BUNDLE 0',
    'a=msid-semantic: WMS',
    'm=application 9 UDP/DTLS/SCTP webrtc-datachannel',
    'c=IN IP4 0.0.0.0',
    'a=ice-ufrag:' + ufrag,
    'a=ice-pwd:' + pwd,
    'a=fingerprint:sha-256 ' + fp.match(/.{2}/g).join(':'),
    'a=setup:' + (type === 'offer' ? 'actpass' : 'active'),
    'a=mid:0',
    'a=sctp-port:5000',
    'a=max-message-size:262144',
  ];
  (cs || '').split(';').filter(Boolean).forEach((c) => lines.push('a=candidate:' + c));
  lines.push('a=end-of-candidates');
  return { type, sdp: lines.join('\r\n') + '\r\n' };
}

// Kullanıcının yapıştırdığı ya da QR'dan okunan metinden kodu ayıklar.
// Tam adres ("https://.../#o.xxxx") da, çıplak kod ("o.xxxx") da olur.
export function parseCode(text) {
  if (!text) return null;
  let t = String(text).trim();
  const hash = t.lastIndexOf('#');
  if (hash >= 0) t = t.slice(hash + 1);
  t = t.replace(/\s+/g, '');
  const m = /^([oa])\.[A-Za-z0-9_-]+$/.exec(t);
  return m ? { kind: m[1], code: t } : null;
}
