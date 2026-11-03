"use strict";

const $ = (s) => document.querySelector(s);
const form = $("#form");
const input = $("#url");
const goBtn = $("#go");
const pasteBtn = $("#paste");
const statusEl = $("#status");
const results = $("#results");

const VERSION = "1.0.2"; // sw.js içindeki CACHE adıyla aynı tut
const API = "https://api.fxtwitter.com/status/";
{
  const ver = document.querySelector("#ver");
  if (ver) ver.textContent = "Sürüm " + VERSION;
}
const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

function setStatus(msg, isError = false) {
  statusEl.textContent = msg || "";
  statusEl.classList.toggle("err", isError);
}

// Metnin içinden tweet ID'sini çıkarır (paylaşılan metinler de olabilir).
function extractId(text) {
  const t = (text || "").trim();
  if (/^\d{8,25}$/.test(t)) return t;
  const m = t.match(/\/status(?:es)?\/(\d{8,25})/i);
  return m ? m[1] : null;
}

async function fetchTweet(id) {
  const res = await fetch(API + id, { headers: { Accept: "application/json" } });
  if (res.status === 404) throw new Error("Tweet bulunamadı (silinmiş veya gizli olabilir).");
  if (!res.ok) throw new Error("Servis yanıt vermedi (" + res.status + "). Biraz sonra tekrar dene.");
  const data = await res.json();
  if (!data || !data.tweet) throw new Error("Tweet verisi alınamadı.");
  return data.tweet;
}

function collectVideos(tweet) {
  const out = [];
  const add = (t, label) => {
    const vids = (t && t.media && t.media.videos) || [];
    vids.forEach((v) => {
      if (v && typeof v.url === "string" && v.url.startsWith("https://")) {
        out.push({
          url: v.url,
          thumb: typeof v.thumbnail_url === "string" ? v.thumbnail_url : "",
          width: v.width, height: v.height, duration: v.duration,
          gif: v.type === "gif", label,
        });
      }
    });
  };
  add(tweet, "");
  if (tweet.quote) add(tweet.quote, "Alıntılanan tweet");
  return out;
}

function fmtDuration(s) {
  if (!s && s !== 0) return "";
  const m = Math.floor(s / 60), r = Math.round(s % 60);
  return m + ":" + String(r).padStart(2, "0");
}

function el(tag, props = {}, ...kids) {
  const n = document.createElement(tag);
  Object.assign(n, props);
  kids.forEach((k) => n.append(k));
  return n;
}

function saveBlob(blob, name) {
  const a = document.createElement("a");
  const u = URL.createObjectURL(blob);
  a.href = u; a.download = name;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(u), 30000);
}

async function downloadVideo(v, name, btn) {
  const label = btn.textContent;
  btn.disabled = true;
  try {
    // Referer göndermeyen istek: CDN'in yönlendiren-site kontrolüne takılmaz.
    const res = await fetch(v.url, { referrerPolicy: "no-referrer", credentials: "omit", mode: "cors" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const total = Number(res.headers.get("content-length")) || 0;
    const reader = res.body.getReader();
    const chunks = [];
    let got = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      got += value.length;
      btn.textContent = total ? "%" + Math.round((got / total) * 100) : (got / 1048576).toFixed(1) + " MB";
    }
    const blob = new Blob(chunks, { type: "video/mp4" });
    const file = new File([blob], name, { type: "video/mp4" });
    if (isIOS && navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file] }); // "Videoyu Kaydet" seçeneği çıkar
    } else {
      saveBlob(blob, name);
    }
    setStatus("İndirme tamamlandı.");
  } catch (e) {
    if (e && e.name === "AbortError") { /* paylaşım penceresi kapatıldı */ }
    else {
      // Doğrudan indirme engellendi (CORS, ağ, güvenlik politikası vb.).
      // Asenkron işlemden sonra window.open açılır pencere engeline takılır;
      // bu yüzden dokunulabilir gerçek bir bağlantı gösteriyoruz.
      const reason = (e && e.message) ? e.message : String(e);
      setStatus("Doğrudan indirilemedi (" + reason + "). Aşağıdaki bağlantıya dokunup videoyu aç, sonra kaydet.", true);
      const actions = btn.parentElement;
      if (actions && !actions.querySelector("a.linkbtn")) {
        actions.append(el("a", {
          className: "linkbtn", href: v.url, target: "_blank", rel: "noopener noreferrer",
          textContent: "Videoyu aç ve kaydet",
        }));
      }
    }
  } finally {
    btn.disabled = false;
    btn.textContent = label;
  }
}

function render(tweet, id) {
  results.replaceChildren();
  const videos = collectVideos(tweet);
  if (!videos.length) {
    setStatus("Bu tweette indirilebilir video yok.", true);
    return;
  }
  const author = tweet.author ? "@" + tweet.author.screen_name : "";
  setStatus(videos.length + " video bulundu" + (author ? " · " + author : "") + ".");

  videos.forEach((v, i) => {
    const name = "video-" + id + (videos.length > 1 ? "-" + (i + 1) : "") + (v.gif ? "-gif" : "") + ".mp4";
    const bits = [];
    if (v.label) bits.push(v.label);
    if (v.width && v.height) bits.push(v.width + "×" + v.height);
    if (v.duration) bits.push(fmtDuration(v.duration));
    if (v.gif) bits.push("GIF");

    const dl = el("button", { type: "button", textContent: "İndir" });
    dl.addEventListener("click", () => downloadVideo(v, name, dl));
    const open = el("button", { type: "button", className: "ghost", textContent: "Yeni sekmede aç" });
    open.addEventListener("click", () => window.open(v.url, "_blank", "noopener,noreferrer"));

    const card = el("div", { className: "card" });
    if (v.thumb.startsWith("https://")) {
      card.append(el("img", { className: "thumb", src: v.thumb, alt: "Video önizleme", loading: "lazy" }));
    }
    card.append(el("div", { className: "body" },
      el("div", { className: "meta", textContent: bits.join(" · ") || "Video" }),
      el("div", { className: "actions" }, dl, open)
    ));
    results.append(card);
  });
}

async function run(text) {
  const id = extractId(text);
  results.replaceChildren();
  if (!id) { setStatus("Geçerli bir tweet bağlantısı bulamadım.", true); return; }
  goBtn.disabled = true;
  setStatus("Video aranıyor…");
  try {
    render(await fetchTweet(id), id);
  } catch (e) {
    const offline = !navigator.onLine || e instanceof TypeError;
    setStatus(offline ? "Bağlantı kurulamadı. İnternetini kontrol et." : e.message, true);
  } finally {
    goBtn.disabled = false;
  }
}

form.addEventListener("submit", (e) => { e.preventDefault(); run(input.value); });

pasteBtn.addEventListener("click", async () => {
  try {
    const t = await navigator.clipboard.readText();
    input.value = t;
    if (extractId(t)) run(t);
  } catch {
    setStatus("Panoya erişilemedi; bağlantıyı elle yapıştır.", true);
  }
});

// Paylaş menüsünden gelen (share_target) veya ?url= ile açılan bağlantılar
(function handleIncoming() {
  const p = new URLSearchParams(location.search);
  const shared = [p.get("url"), p.get("text"), p.get("title")].filter(Boolean).join(" ");
  if (shared && extractId(shared)) {
    input.value = (shared.match(/https?:\/\/\S+/) || [shared])[0];
    history.replaceState(null, "", location.pathname);
    run(shared);
  }
})();

// Kurulum düğmesi (Android/Chrome) ve iOS ipucu
let deferredPrompt = null;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  $("#installRow").style.display = "block";
});
$("#install").addEventListener("click", async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  $("#installRow").style.display = "none";
});
const standalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone;
if (isIOS && !standalone) $("#iosHint").style.display = "block";

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}
