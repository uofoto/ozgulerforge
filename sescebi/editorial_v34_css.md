/* Ses Cebi · Sürüm 34 & 35 — Sade, Ferah, Taşmasız Koleksiyon Arayüzü */
:root {
  --bg: #f5f7f6;
  --surface: #ffffff;
  --surface-soft: #eef3f0;
  --surface-hover: #e5ede9;
  --ink: #142820;
  --ink-muted: #4a6258;
  --line: #dbe4df;
  --forest: #154734;
  --forest-deep: #0f3526;
  --terracotta: #c25934;
  --terracotta-deep: #a34625;
  --lime: #a3e635;
  --radius-xl: 24px;
  --radius-lg: 20px;
  --radius-md: 15px;
  --radius-pill: 999px;
  --shadow-card: 0 4px 18px rgba(15, 38, 28, 0.045);
  --shadow-float: 0 14px 36px rgba(12, 28, 21, 0.22);
}

:root[data-theme="dark"] {
  --bg: #0f1613;
  --surface: #17211d;
  --surface-soft: #1f2c27;
  --surface-hover: #273630;
  --ink: #eef4f1;
  --ink-muted: #9eb2a8;
  --line: #2a3933;
  --forest: #24684e;
  --forest-deep: #154734;
  --terracotta: #d46a44;
  --terracotta-deep: #b85430;
  --shadow-card: 0 6px 20px rgba(0, 0, 0, 0.25);
  --shadow-float: 0 16px 40px rgba(0, 0, 0, 0.45);
}

*,
*::before,
*::after {
  box-sizing: border-box;
  -webkit-tap-highlight-color: transparent;
}

html {
  font-size: 16px;
  -webkit-text-size-adjust: 100%;
}

body {
  margin: 0;
  background: var(--bg);
  color: var(--ink);
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  line-height: 1.5;
  overflow-x: clip;
  transition: background-color 0.22s ease, color 0.22s ease;
}

button,
input,
select,
textarea {
  font: inherit;
  color: inherit;
}

button {
  cursor: pointer;
}

.hidden {
  display: none !important;
}

/* =========================================================
   ANA KABUK (Masaüstü Sol Ray + Mobil Tam Ekran)
========================================================= */
.app-shell {
  min-height: 100dvh;
  display: grid;
  grid-template-columns: 268px minmax(0, 1fr);
}

.side-rail {
  background: #132c22;
  color: #edf4f0;
  padding: 24px 16px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 20px;
  position: sticky;
  top: 0;
  height: 100dvh;
  border-right: 1px solid rgba(255, 255, 255, 0.08);
}

.rail-brand {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 6px 8px;
}

.rail-logo {
  width: 40px;
  height: 40px;
  border-radius: 13px;
  background: rgba(255, 255, 255, 0.12);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #a3e635;
  flex-shrink: 0;
}

.rail-brand strong {
  display: block;
  font-family: 'Instrument Serif', Georgia, serif;
  font-size: 1.55rem;
  font-weight: 400;
  line-height: 1.05;
  letter-spacing: -0.01em;
}

.rail-brand small {
  display: block;
  font-size: 0.72rem;
  color: #9cb3a8;
}

.rail-nav {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 14px;
}

.rail-item {
  width: 100%;
  min-height: 44px;
  padding: 0 14px;
  border-radius: 13px;
  border: 1px solid transparent;
  background: transparent;
  color: #c2d4cb;
  display: flex;
  align-items: center;
  gap: 11px;
  font-size: 0.9rem;
  font-weight: 600;
  text-align: left;
  transition: background-color 0.16s ease, color 0.16s ease;
}

.rail-item:hover {
  background: rgba(255, 255, 255, 0.07);
  color: #ffffff;
}

.rail-item.is-active {
  background: #235340;
  color: #ffffff;
  border-color: rgba(255, 255, 255, 0.12);
}

.rail-bottom {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.rail-login-btn,
.rail-user-box {
  width: 100%;
  padding: 10px 12px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: #f3f7f5;
  display: flex;
  align-items: center;
  gap: 10px;
  text-align: left;
}

.rail-avatar {
  width: 34px;
  height: 34px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.16);
  color: #ffffff;
  font-weight: 800;
  font-size: 0.85rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.rail-avatar.is-connected {
  background: #a3e635;
  color: #10241b;
}

.rail-account-meta {
  min-width: 0;
  flex: 1;
}

.rail-account-meta strong {
  display: block;
  font-size: 0.82rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.rail-account-meta small {
  display: block;
  font-size: 0.72rem;
  color: #9eb5aa;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.rail-version {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.7rem;
  color: #87a195;
  padding: 0 6px;
}

/* =========================================================
   ANA İÇERİK ALANI & ÜST BAŞLIK
========================================================= */
.workspace {
  min-width: 0;
  max-width: 960px;
  width: 100%;
  margin: 0 auto;
  padding: 20px 24px 128px;
}

.top-header {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
}

.header-circle-btn {
  width: 42px;
  height: 42px;
  border-radius: 999px;
  background: var(--surface);
  border: 1px solid var(--line);
  color: var(--ink);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--shadow-card);
  transition: transform 0.14s ease, background-color 0.16s ease;
}

.header-circle-btn:active {
  transform: scale(0.95);
}

.header-title {
  margin: 0;
  text-align: center;
  font-family: 'Instrument Serif', Georgia, serif;
  font-size: clamp(1.75rem, 4vw, 2.25rem);
  font-weight: 400;
  letter-spacing: -0.01em;
  line-height: 1.05;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* =========================================================
   ANA EKRANDA BELİRGİN GMAIL / GOOGLE HESAP ÇUBUĞU
========================================================= */
.home-account-bar {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  padding: 11px 14px;
  margin-bottom: 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  box-shadow: var(--shadow-card);
}

.account-bar-info {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  flex: 1;
}

.account-avatar {
  width: 36px;
  height: 36px;
  border-radius: 999px;
  background: var(--surface-soft);
  border: 1px solid var(--line);
  color: var(--ink);
  font-weight: 800;
  font-size: 0.88rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.account-avatar.is-connected {
  background: var(--forest);
  border-color: var(--forest);
  color: #ffffff;
}

.account-text {
  min-width: 0;
  flex: 1;
}

.account-text strong {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.86rem;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.account-pill {
  font-size: 0.68rem;
  font-weight: 800;
  padding: 1px 7px;
  border-radius: 999px;
  background: #dcfce7;
  color: #166534;
}

.account-text span {
  display: block;
  font-size: 0.76rem;
  color: var(--ink-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.account-bar-btn {
  min-height: 36px !important;
  padding: 0 13px !important;
  font-size: 0.78rem !important;
  border-radius: 999px !important;
  flex-shrink: 0;
}

/* =========================================================
   ARAMA & FİLTRE ÇUBUĞU
========================================================= */
.filter-strip {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  gap: 8px;
  margin-bottom: 10px;
}

.search-pill {
  position: relative;
  min-width: 0;
}

.search-pill input {
  width: 100%;
  height: 42px;
  padding: 0 14px 0 36px;
  border-radius: var(--radius-pill);
  background: var(--surface);
  border: 1px solid var(--line);
  font-size: 0.86rem;
  outline: none;
  box-shadow: var(--shadow-card);
}

.search-pill svg {
  position: absolute;
  left: 13px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--ink-muted);
  pointer-events: none;
}

.filter-chip,
.sort-pill {
  height: 42px;
  padding: 0 14px;
  border-radius: var(--radius-pill);
  background: var(--surface);
  border: 1px solid var(--line);
  font-size: 0.82rem;
  font-weight: 650;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  box-shadow: var(--shadow-card);
}

.filter-chip.is-active {
  background: var(--forest);
  border-color: var(--forest);
  color: #ffffff;
}

.meta-strip {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 12px;
  font-size: 0.78rem;
  color: var(--ink-muted);
}

.inline-add-link {
  background: none;
  border: none;
  padding: 0;
  color: var(--forest);
  font-weight: 750;
  font-size: 0.82rem;
}

:root[data-theme="dark"] .inline-add-link {
  color: #8ee0b2;
}

/* =========================================================
   SES ARŞİVİ KARTLARI (Öne Çıkan Kaset Kartı + Sade Satırlar)
========================================================= */
.song-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}

.song-row {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-card);
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  transition: transform 0.16s ease, border-color 0.16s ease;
}

.song-row.is-playing {
  border-color: var(--forest);
}

/* Öne Çıkan İlk / Aktif Kaset Kartı */
.song-row.is-featured-card {
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.featured-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.cassette-art {
  width: 118px;
  height: 76px;
  border-radius: 16px;
  background: var(--surface-soft);
  border: 1px solid var(--line);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.featured-wave-row {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
}

.mini-play-triangle {
  width: 28px;
  height: 28px;
  border-radius: 999px;
  border: none;
  background: rgba(194, 89, 52, 0.12);
  color: var(--terracotta);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.featured-progress-line {
  width: 54px;
  height: 4px;
  border-radius: 999px;
  background: var(--line);
  overflow: hidden;
  flex-shrink: 0;
}

.featured-progress-fill {
  display: block;
  width: 38%;
  height: 100%;
  background: var(--terracotta);
  border-radius: 999px;
}

.featured-waveform {
  flex: 1;
  min-width: 0;
  height: 26px;
  display: flex;
  align-items: center;
  gap: 3px;
  overflow: hidden;
}

.featured-waveform span {
  flex: 1 1 0;
  min-width: 2px;
  max-width: 5px;
  border-radius: 999px;
  background: rgba(194, 89, 52, 0.58);
}

.featured-title-block {
  min-width: 0;
}

.featured-title-block .song-name {
  font-size: 1.12rem;
  font-weight: 800;
  line-height: 1.3;
  margin: 0 0 4px;
  word-break: break-word;
}

.featured-title-block .song-meta {
  font-size: 0.8rem;
  color: var(--ink-muted);
}

.featured-cta-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 10px;
  min-width: 0;
  width: 100%;
}

.cta-listen-btn,
.cta-edit-btn {
  min-width: 0;
  width: 100%;
  height: 46px;
  padding: 0 12px;
  border: none;
  border-radius: var(--radius-pill);
  font-size: 0.88rem;
  font-weight: 750;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cta-listen-btn {
  background: var(--forest);
  color: #ffffff;
}

.cta-edit-btn {
  background: var(--terracotta);
  color: #ffffff;
}

/* Kompakt Liste Satırları */
.song-row.is-compact-card {
  padding: 13px 14px;
  display: grid;
  grid-template-columns: 52px minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
}

.compact-badge {
  width: 52px;
  height: 52px;
  border-radius: 15px;
  color: #ffffff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.compact-info {
  min-width: 0;
}

.compact-info .song-name {
  display: block;
  font-size: 0.94rem;
  font-weight: 750;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 3px;
}

.compact-info .song-meta {
  display: block;
  font-size: 0.77rem;
  color: var(--ink-muted);
}

.compact-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.icon-btn {
  width: 36px;
  height: 36px;
  border-radius: 999px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--ink-muted);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.icon-btn:hover {
  background: var(--surface-soft);
  color: var(--ink);
}

.icon-btn.is-fav {
  color: #dc2626;
}

/* =========================================================
   DİNLENEN MÜZİK KARTI (Kapatma X Düğmeli Sabit Oynatıcı)
========================================================= */
.player-deck {
  position: fixed;
  left: 284px;
  right: 16px;
  bottom: 16px;
  z-index: 45;
  max-width: 928px;
  margin: 0 auto;
  background: #142c22;
  color: #f3f7f5;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 24px;
  padding: 14px 16px;
  box-shadow: var(--shadow-float);
}

.player-deck-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
}

.player-track-info {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  flex: 1;
}

.player-track-icon {
  width: 38px;
  height: 38px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.12);
  color: #a3e635;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.player-track-meta {
  min-width: 0;
  flex: 1;
}

.player-track-meta strong {
  display: block;
  font-size: 0.9rem;
  font-weight: 750;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.player-track-meta span {
  display: block;
  font-size: 0.74rem;
  color: #9cb5aa;
}

.player-close-btn {
  width: 34px;
  height: 34px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: rgba(255, 255, 255, 0.08);
  color: #eef4f1;
  font-size: 0.85rem;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.player-close-btn:hover {
  background: rgba(255, 255, 255, 0.18);
}

.player-controls-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.player-skip-btn {
  width: 36px;
  height: 36px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.08);
  color: #f3f7f5;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.player-main-btn {
  width: 44px;
  height: 44px;
  border-radius: 999px;
  border: none;
  background: #e9e4d8;
  color: #132820;
  font-weight: 800;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.player-seek {
  flex: 1;
  min-width: 0;
  accent-color: #a3e635;
}

.player-time {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.74rem;
  color: #c2d4cb;
  white-space: nowrap;
}

.player-extra-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 7px;
}

.player-pill-btn {
  height: 32px;
  padding: 0 11px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.08);
  color: #e2ede8;
  font-size: 0.76rem;
  font-weight: 650;
}

.player-pill-btn.is-active {
  background: #a3e635;
  color: #10241b;
  border-color: #a3e635;
}

/* =========================================================
   GENEL DÜĞMELER & FORM ELEMANLARI
========================================================= */
.card {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius-xl);
  padding: 18px;
  box-shadow: var(--shadow-card);
}

.primary-button,
.ghost-button {
  min-height: 44px;
  padding: 0 16px;
  border-radius: var(--radius-md);
  font-size: 0.86rem;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  transition: opacity 0.15s ease, transform 0.12s ease;
}

.primary-button {
  background: var(--forest);
  border: 1px solid var(--forest);
  color: #ffffff;
}

.primary-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.ghost-button {
  background: var(--surface-soft);
  border: 1px solid var(--line);
  color: var(--ink);
}

.ghost-button.is-danger-ghost {
  color: #b91c1c;
  border-color: rgba(185, 28, 28, 0.25);
  background: rgba(185, 28, 28, 0.06);
}

.text-input {
  width: 100%;
  min-height: 44px;
  padding: 0 14px;
  border-radius: var(--radius-md);
  background: var(--surface-soft);
  border: 1px solid var(--line);
  outline: none;
}

/* =========================================================
   ALT ÇEKMECE (Yedek & Özet) & BULUT ALANI
========================================================= */
.sheet-backdrop {
  position: fixed;
  inset: 0;
  z-index: 60;
  background: rgba(12, 24, 19, 0.52);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

.sheet-card {
  width: 100%;
  max-width: 480px;
  max-height: 88dvh;
  overflow-y: auto;
  background: var(--surface);
  color: var(--ink);
  border: 1px solid var(--line);
  border-radius: 26px;
  padding: 20px;
  box-shadow: var(--shadow-float);
}

.sheet-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}

.sheet-header h2 {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 800;
}

.backup-actions-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 8px;
  margin: 10px 0 14px;
}

.cloud-sync-box {
  background: var(--surface-soft);
  border: 1px solid var(--line);
  border-radius: 18px;
  padding: 14px;
}

.cloud-sync-status {
  font-size: 0.82rem;
  margin-bottom: 10px;
}

.cloud-sync-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.cloud-sync-hint {
  margin: 10px 0 0;
  font-size: 0.76rem;
  line-height: 1.45;
  color: var(--ink-muted);
}

/* =========================================================
   hadiGET 2 ADIMLI ÖZEL ONAY KARTI
========================================================= */
.hg-confirm-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 18px;
  background: rgba(12, 24, 19, 0.6);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  opacity: 0;
  transition: opacity 0.18s ease;
}

.hg-confirm-overlay.is-open {
  opacity: 1;
}

.hg-confirm-card {
  width: 100%;
  max-width: 370px;
  background: var(--surface);
  color: var(--ink);
  border: 1px solid var(--line);
  border-radius: 26px;
  padding: 20px;
  box-shadow: 0 24px 60px rgba(10, 22, 17, 0.32);
  transform: translateY(10px) scale(0.98);
  transition: transform 0.2s ease;
}

.hg-confirm-overlay.is-open .hg-confirm-card {
  transform: translateY(0) scale(1);
}

.hg-confirm-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 14px;
}

.hg-confirm-brand {
  display: flex;
  align-items: center;
  gap: 10px;
}

.hg-confirm-logo {
  width: 34px;
  height: 34px;
  border-radius: 12px;
  background: var(--forest);
  color: #ffffff;
  font-weight: 800;
  font-size: 13px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.hg-confirm-brand-name {
  display: block;
  font-size: 13px;
  font-weight: 800;
  line-height: 1.2;
}

.hg-confirm-step {
  display: block;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.06em;
  color: var(--terracotta);
  margin-top: 2px;
}

.hg-confirm-close {
  width: 32px;
  height: 32px;
  border-radius: 999px;
  border: 1px solid var(--line);
  background: var(--surface-soft);
  color: var(--ink-muted);
  font-size: 13px;
  font-weight: 700;
}

.hg-confirm-title {
  margin: 0 0 8px;
  font-size: 19px;
  font-weight: 800;
  line-height: 1.25;
}

.hg-confirm-desc {
  margin: 0;
  font-size: 13.5px;
  line-height: 1.55;
  color: var(--ink-muted);
}

.hg-confirm-actions {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 10px;
  margin-top: 18px;
}

.hg-btn-cancel,
.hg-btn-proceed {
  height: 44px;
  border-radius: 15px;
  font-size: 13.5px;
  font-weight: 750;
  border: none;
}

.hg-btn-cancel {
  background: var(--surface-soft);
  color: var(--ink);
  border: 1px solid var(--line);
}

.hg-btn-proceed {
  background: var(--terracotta);
  color: #ffffff;
}

.hg-btn-proceed.is-final {
  background: #a62626;
}

/* =========================================================
   MOBİL YÜZEN ALT DOCK & UYUM KURALLARI
========================================================= */
.mobile-dock {
  display: none;
}

.toast {
  position: fixed;
  right: 16px;
  bottom: 92px;
  z-index: 80;
  background: #132c22;
  color: #ffffff;
  padding: 10px 15px;
  border-radius: 14px;
  font-size: 0.82rem;
  font-weight: 650;
  box-shadow: var(--shadow-float);
  opacity: 0;
  transform: translateY(8px);
  pointer-events: none;
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.toast.is-visible {
  opacity: 1;
  transform: translateY(0);
}

@media (max-width: 820px) {
  .app-shell {
    display: block;
  }

  .side-rail {
    display: none;
  }

  .workspace {
    padding: calc(12px + env(safe-area-inset-top)) 14px calc(195px + env(safe-area-inset-bottom));
  }

  .filter-strip {
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .filter-strip .search-pill {
    grid-column: 1 / -1;
  }

  .player-deck {
    left: 10px;
    right: 10px;
    bottom: calc(78px + env(safe-area-inset-bottom));
    border-radius: 22px;
    padding: 13px 14px;
  }

  .mobile-dock {
    position: fixed;
    left: 10px;
    right: 10px;
    bottom: calc(10px + env(safe-area-inset-bottom));
    z-index: 50;
    background: #132c22;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 22px;
    padding: 6px;
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 4px;
    box-shadow: var(--shadow-float);
  }

  .dock-item {
    min-height: 48px;
    border: none;
    border-radius: 16px;
    background: transparent;
    color: #9eb5aa;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    font-size: 0.71rem;
    font-weight: 650;
  }

  .dock-item.is-active {
    background: #235340;
    color: #ffffff;
  }
}