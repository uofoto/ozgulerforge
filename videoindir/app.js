"use strict";
(() => {
const CFG = self.FORGE_CONFIG;
const $ = (s, r = document) => r.querySelector(s);

/* ---------- küçük yardımcılar ---------- */
function el(tag, props = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === "class") n.className = v;
    else if (k === "text") n.textContent = v;
    else if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v === true ? "" : v);
  }
  kids.flat().forEach((c) => c != null && n.append(c));
  return n;
}

const store = {
  get(k, d) { try { const v = localStorage.getItem("forge." + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem("forge." + k, JSON.stringify(v)); } catch {} },
  wipe() {
    try { Object.keys(localStorage).filter((k) => k.startsWith("forge.")).forEach((k) => localStorage.removeItem(k)); } catch {}
  },
};

let toastTimer;
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2400);
}

const statusEl = $("#status");
function setStatus(msg, isError = false) {
  statusEl.textContent = msg || "";
  statusEl.classList.toggle("err", isError);
}

const ua = navigator.userAgent;
const isIOS = /iP(hone|ad|od)/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isAndroid = /Android/i.test(ua);

/* ---------- ayarlar ve tema ---------- */
const settings = Object.assign({ theme: "auto", saveHistory: true, autoPaste: false }, store.get("settings", {}));
const saveSettings = () => store.set("settings", settings);

function applyTheme() {
  const root = document.documentElement;
  if (settings.theme === "light" || settings.theme === "dark") root.dataset.theme = settings.theme;
  else delete root.dataset.theme;
  const dark = settings.theme === "dark" || (settings.theme === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);
  const meta = $('meta[name="theme-color"]');
  if (meta) meta.content = dark ? "#14110f" : "#faf7f2";
}
applyTheme();
matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", applyTheme);

/* ---------- onay (kullanım koşulları / gizlilik) ---------- */
const hasConsent = () => store.get("consent", null) === CFG.legalVersion;
function syncConsentBar() {
  const show = !hasConsent();
  $("#consent").hidden = !show;
  document.body.classList.toggle("has-consent-bar", show);
}
$("#accept").addEventListener("click", () => {
  store.set("consent", CFG.legalVersion);
  syncConsentBar();
  if ($("#url").value.trim()) run($("#url").value);
});

/* ---------- bağlantı çözme ve API ---------- */
function extractId(text) {
  const t = (text || "").trim();
  if (/^\d{8,25}$/.test(t)) return t;
  const m = t.match(/\/status(?:es)?\/(\d{8,25})/i);
  return m ? m[1] : null;
}

function safeMedia(url) {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && /(^|\.)twimg\.com$/.test(u.hostname);
  } catch { return false; }
}

async function fetchTweet(id) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(CFG.api + id, { signal: ctrl.signal, headers: { Accept: "application/json" } });
    if (res.status === 404) throw new Error("Gönderi bulunamadı (silinmiş veya gizli olabilir).");
    if (!res.ok) throw new Error("Servis yanıt vermedi (" + res.status + "). Biraz sonra tekrar dene.");
    const data = await res.json();
    if (!data || !data.tweet) throw new Error("Gönderi verisi alınamadı.");
    return data.tweet;
  } catch (e) {
    if (e && e.name === "AbortError") throw new Error("Servis zamanında yanıt vermedi. Tekrar dene.");
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

// Bir videonun indirilebilir mp4 sürümlerini (kalite seçenekleri) çıkarır.
function buildVariants(v) {
  const raw = Array.isArray(v.formats) ? v.formats : Array.isArray(v.variants) ? v.variants : [];
  const seen = new Set();
  const list = [];
  const push = (url, bitrate) => {
    if (typeof url !== "string" || !safeMedia(url) || seen.has(url)) return;
    if (!/\.mp4(\?|$)/i.test(url)) return; // m3u8 akışlarını atla
    seen.add(url);
    const m = url.match(/\/(\d{2,5})x(\d{2,5})\//);
    list.push({ url, bitrate: Number(bitrate) || 0, w: m ? +m[1] : 0, h: m ? +m[2] : 0 });
  };
  raw.forEach((f) => f && push(f.url, f.bitrate));
  push(v.url, 0);
  list.sort((a, b) => Math.min(b.w, b.h) - Math.min(a.w, a.h) || b.bitrate - a.bitrate);
  return list;
}

function variantLabel(x, i) {
  const q = Math.min(x.w, x.h);
  if (q) return q + "p" + (x.bitrate ? " · " + Math.round(x.bitrate / 1000) + " kb/sn" : "");
  return i === 0 ? "Varsayılan" : "Seçenek " + (i + 1);
}

function collectVideos(tweet) {
  const out = [];
  const add = (t, label) => {
    const vids = (t && t.media && t.media.videos) || [];
    vids.forEach((v) => {
      if (!v) return;
      const variants = buildVariants(v);
      if (!variants.length) return;
      out.push({
        variants, label, gif: v.type === "gif",
        thumb: typeof v.thumbnail_url === "string" && safeMedia(v.thumbnail_url) ? v.thumbnail_url : "",
        duration: v.duration,
      });
    });
  };
  add(tweet, "");
  if (tweet.quote) add(tweet.quote, "Alıntılanan gönderi");
  return out;
}

function fmtDuration(s) {
  if (!s) return "";
  const m = Math.floor(s / 60), r = Math.round(s % 60);
  return m + ":" + String(r).padStart(2, "0");
}

/* ---------- indirme ---------- */
class HttpError extends Error { constructor(status) { super("HTTP " + status); this.status = status; } }

function saveBlob(blob, name) {
  const a = el("a", { href: URL.createObjectURL(blob), download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 30000);
}

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); toast("Bağlantı kopyalandı"); }
  catch { window.prompt("Bağlantıyı kopyala:", text); }
}

function friendlyError(e) {
  if (e instanceof HttpError) {
    if (e.status === 403) return "Video sunucusu isteği reddetti (403). Ağın, VPN'in veya tarayıcın bu adrese doğrudan erişimi engelliyor olabilir.";
    if (e.status === 404 || e.status === 410) return "Video artık mevcut değil (" + e.status + "). Gönderi silinmiş olabilir.";
    return "Video sunucusu hata verdi (" + e.status + ").";
  }
  return "Tarayıcı bu adresten doğrudan indirmeye izin vermedi (ağ veya güvenlik kısıtı).";
}

function platformHelp() {
  if (isIOS) return "iPhone: “Yeni sekmede aç”a dokun, açılan videoda Paylaş → Dosyalara Kaydet veya Fotoğraflara Kaydet.";
  if (isAndroid) return "Android: “Yeni sekmede aç”a dokun, videoya uzun bas veya oynatıcıda ⋮ → İndir.";
  return "Masaüstü: “Yeni sekmede aç”a tıkla, videoya sağ tıklayıp “Videoyu farklı kaydet” de (veya oynatıcıda ⋮ → İndir).";
}

function videoCard(v, idx, total, tweetId) {
  let cur = v.variants[0];
  const fileName = () => {
    const q = Math.min(cur.w, cur.h);
    return `ozguler-forge-${tweetId}${total > 1 ? "-" + (idx + 1) : ""}${v.gif ? "-gif" : ""}${q ? "-" + q + "p" : ""}.mp4`;
  };

  /* medya alanı: önce küçük resim, dokununca önizleme oynatıcı */
  const media = el("div", { class: "media" });
  const showPlayer = () => {
    const vid = el("video", { controls: true, playsinline: true, autoplay: true, preload: "metadata" });
    if (v.thumb) vid.poster = v.thumb;
    vid.src = cur.url;
    vid.addEventListener("error", () => {
      note.textContent = "Önizleme açılamadı; bu bağlantıya erişim engelleniyor olabilir. İndirmeyi yine de deneyebilirsin.";
      note.className = "note err";
    });
    media.replaceChildren(vid);
  };
  if (v.thumb) media.append(el("img", { src: v.thumb, alt: "Video önizleme", loading: "lazy" }));
  media.append(el("button", { class: "play", type: "button", "aria-label": "Önizle", onclick: showPlayer },
    el("span", {}, svgPlay())));

  /* bilgi satırı + kalite seçimi */
  const bits = [];
  if (v.label) bits.push(v.label);
  if (v.duration) bits.push(fmtDuration(v.duration));
  if (v.gif) bits.push("GIF");
  const meta = el("div", { class: "meta" }, el("strong", { text: bits.join(" · ") || "Video" }));
  let select = null;
  if (v.variants.length > 1) {
    select = el("select", { "aria-label": "Kalite" },
      v.variants.map((x, i) => el("option", { value: String(i), text: variantLabel(x, i) })));
    select.addEventListener("change", () => { cur = v.variants[+select.value]; openLink.href = cur.url; });
    meta.append(select);
  }

  /* düğmeler */
  const dlBtn = el("button", { type: "button", class: "btn primary", text: "İndir" });
  const copyBtn = el("button", { type: "button", class: "btn", text: "Bağlantıyı kopyala", onclick: () => copyText(cur.url) });
  const openLink = el("a", { class: "btn ghost", href: cur.url, target: "_blank", rel: "noopener noreferrer", text: "Yeni sekmede aç" });
  const actions = el("div", { class: "actions" }, dlBtn, copyBtn, openLink);

  /* ilerleme + iptal */
  const bar = el("div", { class: "bar" });
  const pct = el("span", { text: "0%" });
  const cancel = el("button", { type: "button", class: "link-btn", text: "İptal" });
  const progress = el("div", { class: "progress", hidden: true },
    el("div", { class: "track" }, bar), pct, cancel);

  const note = el("p", { class: "note" });
  const fallback = el("div", { class: "fallback", hidden: true });

  function showFallback(e) {
    fallback.replaceChildren(
      el("p", {}, el("strong", { text: "Doğrudan indirilemedi. " }), document.createTextNode(friendlyError(e))),
      el("p", { text: platformHelp() }),
      el("div", { class: "actions" },
        el("button", { type: "button", class: "btn small", text: "Burada önizle", onclick: showPlayer }),
        el("button", { type: "button", class: "btn small", text: "Bağlantıyı kopyala", onclick: () => copyText(cur.url) }),
        el("a", { class: "btn small primary", href: cur.url, target: "_blank", rel: "noopener noreferrer", text: "Yeni sekmede aç" })
      )
    );
    fallback.hidden = false;
  }

  dlBtn.addEventListener("click", async () => {
    const ctrl = new AbortController();
    cancel.onclick = () => ctrl.abort();
    fallback.hidden = true;
    note.textContent = ""; note.className = "note";
    dlBtn.disabled = true;
    progress.hidden = false; bar.style.width = "0%"; pct.textContent = "0%";
    try {
      const res = await fetch(cur.url, { signal: ctrl.signal, referrerPolicy: "no-referrer", credentials: "omit" });
      if (!res.ok) throw new HttpError(res.status);
      const total = Number(res.headers.get("content-length")) || 0;
      let blob;
      if (res.body && res.body.getReader) {
        const reader = res.body.getReader();
        const chunks = [];
        let got = 0;
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          got += value.length;
          if (total) { const p = Math.round((got / total) * 100); bar.style.width = p + "%"; pct.textContent = p + "%"; }
          else { bar.style.width = "60%"; pct.textContent = (got / 1048576).toFixed(1) + " MB"; }
        }
        blob = new Blob(chunks, { type: "video/mp4" });
      } else {
        blob = new Blob([await res.blob()], { type: "video/mp4" });
      }
      bar.style.width = "100%"; pct.textContent = "100%";
      const file = new File([blob], fileName(), { type: "video/mp4" });
      if (isIOS && navigator.canShare && navigator.canShare({ files: [file] })) {
        try { await navigator.share({ files: [file] }); } catch (e) { if (!e || e.name !== "AbortError") throw e; }
      } else {
        saveBlob(blob, fileName());
      }
      note.textContent = "Hazır: " + fileName();
      note.className = "note";
      toast("İndirme tamamlandı");
    } catch (e) {
      if (e && e.name === "AbortError") { note.textContent = "İndirme iptal edildi."; }
      else showFallback(e);
    } finally {
      progress.hidden = true;
      dlBtn.disabled = false;
    }
  });

  return el("div", { class: "card" }, media, el("div", { class: "body" }, meta, actions, progress, note, fallback));
}

function svgPlay() {
  const ns = "http://www.w3.org/2000/svg";
  const s = document.createElementNS(ns, "svg");
  s.setAttribute("viewBox", "0 0 24 24");
  const p = document.createElementNS(ns, "path");
  p.setAttribute("d", "M7 4.5v15l13-7.5z");
  p.setAttribute("fill", "currentColor");
  s.append(p);
  return s;
}

/* ---------- arama akışı ---------- */
const results = $("#results");
const goBtn = $("#go");

async function run(text) {
  results.replaceChildren();
  if (!hasConsent()) {
    setStatus("Devam etmek için Kullanım Koşulları ve Gizlilik Politikasını kabul etmelisin.", true);
    syncConsentBar();
    const c = $("#consent");
    c.classList.remove("pulse"); void c.offsetWidth; c.classList.add("pulse");
    return;
  }
  const id = extractId(text);
  if (!id) { setStatus("Geçerli bir X/Twitter gönderi bağlantısı bulamadım.", true); return; }
  goBtn.disabled = true;
  setStatus("Video aranıyor…");
  try {
    const tweet = await fetchTweet(id);
    const videos = collectVideos(tweet);
    const handle = tweet.author && /^\w{1,30}$/.test(tweet.author.screen_name || "") ? tweet.author.screen_name : "";
    if (!videos.length) { setStatus("Bu gönderide indirilebilir video yok.", true); return; }
    setStatus(videos.length + " video bulundu" + (handle ? " · @" + handle : "") + ".");
    videos.forEach((v, i) => results.append(videoCard(v, i, videos.length, id)));
    addHistory({ id, handle, ts: Date.now() });
  } catch (e) {
    const offline = !navigator.onLine || e instanceof TypeError;
    setStatus(offline ? "Bağlantı kurulamadı. İnternetini kontrol et." : e.message, true);
  } finally {
    goBtn.disabled = false;
  }
}

$("#form").addEventListener("submit", (e) => { e.preventDefault(); run($("#url").value); });

$("#paste").addEventListener("click", async () => {
  try {
    const t = await navigator.clipboard.readText();
    $("#url").value = t;
    if (extractId(t)) run(t);
    else setStatus("Panoda geçerli bir gönderi bağlantısı yok.", true);
  } catch {
    setStatus("Panoya erişilemedi; bağlantıyı elle yapıştır.", true);
  }
});

/* ---------- geçmiş ---------- */
function loadHistory() {
  const h = store.get("history", []);
  return Array.isArray(h) ? h.filter((x) => x && /^\d{8,25}$/.test(x.id)) : [];
}
function addHistory(entry) {
  if (!settings.saveHistory) return;
  const h = loadHistory().filter((x) => x.id !== entry.id);
  h.unshift(entry);
  store.set("history", h.slice(0, CFG.historyLimit));
  renderHistory();
}
function renderHistory() {
  const h = settings.saveHistory ? loadHistory() : [];
  $("#historyBlock").hidden = !h.length;
  const list = $("#historyList");
  list.replaceChildren(...h.map((x) => {
    const url = "https://x.com/" + (x.handle || "i") + "/status/" + x.id;
    return el("li", {},
      el("span", {},
        el("strong", { text: x.handle ? "@" + x.handle : "Gönderi " + x.id }),
        el("span", { class: "when", text: new Date(x.ts).toLocaleString("tr-TR", { dateStyle: "medium", timeStyle: "short" }) })),
      el("span", { class: "row-actions" },
        el("button", { type: "button", class: "btn small", text: "Aç", onclick: () => { $("#url").value = url; run(url); window.scrollTo({ top: 0, behavior: "smooth" }); } }),
        el("button", { type: "button", class: "btn small ghost", "aria-label": "Sil", text: "×", onclick: () => { store.set("history", loadHistory().filter((y) => y.id !== x.id)); renderHistory(); } })));
  }));
}
$("#clearHistory").addEventListener("click", () => { store.set("history", []); renderHistory(); toast("Geçmiş temizlendi"); });

/* ---------- ayarlar penceresi ---------- */
const dlg = $("#settings");
$("#settingsBtn").addEventListener("click", () => {
  dlg.querySelectorAll('input[name="theme"]').forEach((r) => (r.checked = r.value === settings.theme));
  $("#optHistory").checked = settings.saveHistory;
  $("#optAutoPaste").checked = settings.autoPaste;
  dlg.showModal();
});
dlg.querySelectorAll('input[name="theme"]').forEach((r) => r.addEventListener("change", () => { settings.theme = r.value; saveSettings(); applyTheme(); }));
$("#optHistory").addEventListener("change", (e) => { settings.saveHistory = e.target.checked; saveSettings(); if (!settings.saveHistory) store.set("history", []); renderHistory(); });
$("#optAutoPaste").addEventListener("change", (e) => { settings.autoPaste = e.target.checked; saveSettings(); });
$("#wipe").addEventListener("click", () => {
  if (!confirm("Ayarlar, geçmiş ve onay kaydı bu cihazdan silinsin mi?")) return;
  store.wipe();
  Object.assign(settings, { theme: "auto", saveHistory: true, autoPaste: false });
  applyTheme(); renderHistory(); syncConsentBar();
  dlg.close();
  toast("Yerel veriler silindi");
});

/* ---------- güncelleme kontrolü ---------- */
const updBtn = $("#checkUpdate");
const updMsg = $("#updMsg");
const SHELL_FILES = ["./", "index.html", "style.css", "config.js", "app.js", "legal.html"];
let updateReady = false;

function setUpd(msg, isError = false) { updMsg.textContent = msg; updMsg.className = "note" + (isError ? " err" : ""); }

async function applyUpdate() {
  updBtn.disabled = true;
  setUpd("Güncelleniyor…");
  try {
    await Promise.all(SHELL_FILES.map((u) => fetch(u, { cache: "reload" }).catch(() => {})));
    if ("caches" in self) await Promise.all((await caches.keys()).map((k) => caches.delete(k)));
    if ("serviceWorker" in navigator) await Promise.all((await navigator.serviceWorker.getRegistrations()).map((r) => r.unregister()));
  } catch {}
  location.reload(); // ayarlar ve geçmiş korunur (localStorage'a dokunulmaz)
}

async function checkUpdate() {
  if (updateReady) return applyUpdate();
  updBtn.disabled = true;
  updBtn.textContent = "Kontrol ediliyor…";
  setUpd("");
  try {
    if (!navigator.onLine) throw new Error("offline");
    const res = await fetch("config.js?t=" + Date.now(), { cache: "no-store" });
    if (!res.ok) throw new Error("http " + res.status);
    const m = (await res.text()).match(/version:\s*"([^"]+)"/);
    const latest = m && m[1];
    if (latest && latest !== CFG.version) {
      updateReady = true;
      setUpd("Yeni sürüm var: " + latest + " (şu an " + CFG.version + ").");
      updBtn.textContent = "Şimdi güncelle";
    } else {
      setUpd("Güncelsin. Sürüm " + CFG.version + ".");
      updBtn.textContent = "Güncellemeleri kontrol et";
    }
    if ("serviceWorker" in navigator) navigator.serviceWorker.getRegistration().then((r) => r && r.update()).catch(() => {});
  } catch {
    setUpd("Kontrol edilemedi. İnternet bağlantını kontrol edip tekrar dene.", true);
    updBtn.textContent = "Güncellemeleri kontrol et";
  } finally {
    updBtn.disabled = false;
  }
}
updBtn.addEventListener("click", checkUpdate);
$("#footUpdate").addEventListener("click", () => { $("#settingsBtn").click(); checkUpdate(); }); // ayar durumları da yüklensin
$("#settingsBtn").addEventListener("click", () => { if (!updateReady) setUpd("Sürüm " + CFG.version); });

/* ---------- panodan otomatik yerleştirme ---------- */
let lastClip = "";
async function tryAutoPaste() {
  if (!settings.autoPaste || $("#url").value) return;
  try {
    const t = await navigator.clipboard.readText();
    if (t && t !== lastClip && extractId(t)) { lastClip = t; $("#url").value = (t.match(/https?:\/\/\S+/) || [t])[0]; setStatus("Panodaki bağlantı yerleştirildi. “Videoyu bul”a dokun."); }
  } catch {}
}
document.addEventListener("visibilitychange", () => { if (!document.hidden) tryAutoPaste(); });

/* ---------- paylaşım hedefi / ?url= ile gelenler ---------- */
(function incoming() {
  const p = new URLSearchParams(location.search);
  const shared = [p.get("url"), p.get("text"), p.get("title")].filter(Boolean).join(" ");
  if (shared && extractId(shared)) {
    $("#url").value = (shared.match(/https?:\/\/\S+/) || [shared])[0];
    history.replaceState(null, "", location.pathname);
    run(shared);
  }
})();

/* ---------- kurulum, çevrimdışı göstergesi, sürüm ---------- */
let deferredPrompt = null;
window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferredPrompt = e; $("#installRow").hidden = false; });
$("#install").addEventListener("click", async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  $("#installRow").hidden = true;
});
const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone;
if (isIOS && !standalone) $("#iosHint").hidden = false;

const syncOnline = () => { $("#offline").hidden = navigator.onLine; };
addEventListener("online", syncOnline);
addEventListener("offline", syncOnline);
syncOnline();

$("#ver").textContent = "Sürüm " + CFG.version;
$("#year").textContent = new Date().getFullYear();

syncConsentBar();
renderHistory();
tryAutoPaste();

if ("serviceWorker" in navigator) {
  addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}
})();
