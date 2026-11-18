    import { APP_VERSION, KEYS, LEGACY_KEYS, PROXY_URL, GOOGLE_CLIENT_ID } from './config.js';
    import { storage, loadChats } from './storage.js';
    import { ENGINES, curModel, keyOk as engineKeyOk } from './engines/models.js';
    import { mkErr, formatFailure, KIND_SHORT } from './engines/errors.js';
    import { Health } from './engines/health.js';
    import { REQ_LABELS, planRequest } from './engines/router.js';
    import { runWithFallback } from './engines/index.js';
    import { BASE_IDENTITY, LEGACY_IDENTITY, buildSystemText, SUGGEST_OPEN, SUGGEST_CLOSE } from './prompts.js';

    function refreshIcons() {
      if (window.lucide && typeof window.lucide.createIcons === 'function') {
        try { window.lucide.createIcons(); } catch (e) {}
      }
      if (window.hydrateForgeLogos) window.hydrateForgeLogos();
    }
    refreshIcons();

    LEGACY_KEYS.forEach((k) => storage.remove(k));

    // Motor katmanı anahtarları parametre olarak alır; durum (state) bu dosyada kalır.
    function engineCreds() { return { apiKey: state.apiKey }; }
    function keyOk() { return engineKeyOk(engineCreds()); }

    function getIdToken() {
      const t = storage.get(KEYS.TOKEN);
      if (!t) return null;
      try { const p = JSON.parse(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))); return p.exp * 1000 > Date.now() + 30000 ? t : null; } catch (_) { return null; }
    }
    let currentUser = null;

    // Tarayıcının yerel confirm/alert penceresi site adresini başlık yapar; bunun yerine "Oforge AI" başlıklı özel pencere kullanılır.
    function forgeDialog(message, opts) {
      opts = opts || {};
      return new Promise((resolve) => {
        const wrap = document.createElement('div');
        wrap.className = 'fixed inset-0 z-[100] flex items-start justify-center pt-16 px-4 bg-slate-900/30 backdrop-blur-[2px]';
        wrap.innerHTML =
          '<div role="dialog" aria-modal="true" class="w-full max-w-sm bg-white rounded-2xl shadow-float border border-slate-200 p-5">' +
            '<div class="flex items-center gap-2 mb-2">' +
              '<div class="w-6 h-6 rounded-lg bg-gradient-to-tr from-blue-600 to-violet-600"></div>' +
              '<h3 class="text-sm font-bold text-slate-900">Oforge AI</h3>' +
            '</div>' +
            '<p class="forge-dlg-msg text-sm text-slate-600 leading-relaxed whitespace-pre-line"></p>' +
            '<div class="flex justify-end gap-2 mt-5">' +
              (opts.confirm ? '<button type="button" data-r="0" class="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition cursor-pointer">' + (opts.cancelText || 'İptal') + '</button>' : '') +
              '<button type="button" data-r="1" class="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-white ' + (opts.danger ? 'bg-rose-600 hover:bg-rose-700' : 'bg-blue-600 hover:bg-blue-700') + ' transition cursor-pointer">' + (opts.okText || 'Tamam') + '</button>' +
            '</div>' +
          '</div>';
        wrap.querySelector('.forge-dlg-msg').textContent = message;
        const done = (v) => { document.removeEventListener('keydown', onKey); wrap.remove(); resolve(v); };
        const onKey = (e) => { if (e.key === 'Escape') done(false); else if (e.key === 'Enter') done(true); };
        wrap.addEventListener('click', (e) => {
          const b = e.target.closest('button[data-r]');
          if (b) done(b.dataset.r === '1');
          else if (e.target === wrap) done(false);
        });
        document.addEventListener('keydown', onKey);
        document.body.appendChild(wrap);
        const okBtn = wrap.querySelector('button[data-r="1"]');
        if (okBtn) okBtn.focus();
      });
    }
    currentUser = storage.getJSON(KEYS.USER, null);


    // Ekler (PDF / fotoğraf / belge metni) IndexedDB'de tutulur; böylece sonraki mesajlarda da modele gönderilebilir.
    const AttachDB = (() => {
      const mem = new Map(); // IndexedDB kullanılamazsa oturum boyunca bellek yedeği
      let dbPromise = null;
      function open() {
        if (!dbPromise) {
          dbPromise = new Promise((resolve, reject) => {
            const req = indexedDB.open('forge_ai_db', 1);
            req.onupgradeneeded = () => req.result.createObjectStore('attachments', { keyPath: 'id' });
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
          });
        }
        return dbPromise;
      }
      async function run(mode, fn) {
        const db = await open();
        return new Promise((resolve, reject) => {
          const tx = db.transaction('attachments', mode);
          const req = fn(tx.objectStore('attachments'));
          tx.oncomplete = () => resolve(req ? req.result : undefined);
          tx.onerror = () => reject(tx.error);
          tx.onabort = () => reject(tx.error);
        });
      }
      return {
        async put(rec) {
          try { await run('readwrite', (st) => st.put(rec)); mem.delete(rec.id); }
          catch (e) { console.warn('IndexedDB yazılamadı, bellek yedeği kullanılıyor.', e); mem.set(rec.id, rec); }
        },
        async get(id) {
          if (mem.has(id)) return mem.get(id);
          try { return (await run('readonly', (st) => st.get(id))) || null; }
          catch (e) { return null; }
        },
        async del(id) {
          mem.delete(id);
          try { await run('readwrite', (st) => st.delete(id)); } catch (e) {}
        }
      };
    })();

    let state = {
      apiKey: storage.get(KEYS.API, ''),
      systemPrompt: (storage.get(KEYS.SYSTEM, '') && storage.get(KEYS.SYSTEM, '') !== LEGACY_IDENTITY) ? storage.get(KEYS.SYSTEM, '') : BASE_IDENTITY,
      chats: loadChats(),
      activeChatId: null,
      attachedFiles: [],
      attachedImages: [],
      isGenerating: false,
      abortController: null,
      currentArtifact: null
    };

    const els = {
      dropZoneOverlay: document.getElementById('dropZoneOverlay'),
      imageLightbox: document.getElementById('imageLightbox'),
      lightboxImg: document.getElementById('lightboxImg'),
      sidebar: document.getElementById('sidebar'),
      sidebarOverlay: document.getElementById('sidebarOverlay'),
      chatList: document.getElementById('chatList'),
      searchChatsInput: document.getElementById('searchChatsInput'),
      messagesContainer: document.getElementById('messagesContainer'),
      keyStatusBadge: document.getElementById('keyStatusBadge'),
      chatForm: document.getElementById('chatForm'),
      userInput: document.getElementById('userInput'),
      slashMenu: document.getElementById('slashMenu'),
      sendBtn: document.getElementById('sendBtn'),
      stopBtn: document.getElementById('stopBtn'),
      imageInput: document.getElementById('imageInput'),
      fileInput: document.getElementById('fileInput'),
      attachmentsPreviewBar: document.getElementById('attachmentsPreviewBar'),
      previewPane: document.getElementById('previewPane'),
      previewTitle: document.getElementById('previewTitle'),
      previewSubtitle: document.getElementById('previewSubtitle'),
      previewModeTabs: document.getElementById('previewModeTabs'),
      printPdfBtn: document.getElementById('printPdfBtn'),
      tabLiveView: document.getElementById('tabLiveView'),
      tabSourceView: document.getElementById('tabSourceView'),
      previewEmptyState: document.getElementById('previewEmptyState'),
      previewIframe: document.getElementById('previewIframe'),
      previewDocumentView: document.getElementById('previewDocumentView'),
      previewCodeView: document.getElementById('previewCodeView'),
      previewCodeContent: document.getElementById('previewCodeContent'),
      settingsModal: document.getElementById('settingsModal'),
      aboutModal: document.getElementById('aboutModal'),
      installGuideModal: document.getElementById('installGuideModal'),
      legalModal: document.getElementById('legalModal'),
      apiKeyInput: document.getElementById('apiKeyInput'),
      systemPromptInput: document.getElementById('systemPromptInput')
    };

    if (window.DOMPurify) {
      window.DOMPurify.addHook('afterSanitizeAttributes', (node) => {
        if (node.tagName === 'A' && node.hasAttribute('href')) {
          node.setAttribute('target', '_blank');
          node.setAttribute('rel', 'noopener noreferrer');
        }
      });
    }


    // --- ZENGİN YANIT BİLEŞENLERİ (Mermaid, LaTeX, tablo, uyarı kutusu, diff) ---
    const _loaded = {};
    function loadOnce(url, kind) {
      if (_loaded[url]) return _loaded[url];
      _loaded[url] = new Promise((res, rej) => {
        const el = kind === 'css' ? Object.assign(document.createElement('link'), { rel: 'stylesheet', href: url }) : Object.assign(document.createElement('script'), { src: url, async: true });
        el.onload = res; el.onerror = () => { delete _loaded[url]; rej(new Error('kütüphane yüklenemedi')); };
        document.head.appendChild(el);
      });
      return _loaded[url];
    }
    const MERMAID_URL = 'https://cdn.jsdelivr.net/npm/mermaid@10.9.1/dist/mermaid.min.js';
    const KATEX_JS = 'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js';
    const KATEX_CSS = 'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css';
    let _mmId = 0;
    async function renderDiagram(body) {
      const src = body.dataset.code || '';
      body.classList.remove('is-error'); body.classList.add('is-loading'); body.textContent = 'Diyagram hazırlanıyor…';
      const id = 'fm-mm-' + (++_mmId);
      try {
        await loadOnce(MERMAID_URL);
        const dark = document.documentElement.classList.contains('dark');
        window.mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: dark ? 'dark' : 'default', fontFamily: 'Inter, system-ui, sans-serif' });
        const out = await window.mermaid.render(id, src);
        body.innerHTML = out.svg; body.classList.remove('is-loading');
      } catch (e) {
        const stray = document.getElementById('d' + id); if (stray) stray.remove();
        body.classList.remove('is-loading'); body.classList.add('is-error');
        body.textContent = 'Diyagram çizilemedi (' + String((e && e.message) || 'hata').split('\n')[0].slice(0, 120) + '). “Kod” düğmesiyle kaynağı görebilirsiniz.';
      }
    }
    function rerenderDiagrams() { document.querySelectorAll('.mermaid-body[data-code]').forEach(renderDiagram); }
    function fmButton(label, onclick) { const b = document.createElement('button'); b.type = 'button'; b.className = 'fm-card-btn'; b.textContent = label; b.onclick = onclick; return b; }
    function buildDiagramCard(src) {
      const card = document.createElement('div'); card.className = 'fm-card mermaid-card';
      const head = document.createElement('div'); head.className = 'fm-card-head';
      const title = document.createElement('span'); title.textContent = 'Diyagram';
      const actions = document.createElement('div'); actions.className = 'fm-card-actions';
      const body = document.createElement('div'); body.className = 'mermaid-body'; body.dataset.code = src;
      const pre = document.createElement('pre'); pre.className = 'mermaid-src'; pre.textContent = src;
      const toggle = fmButton('Kod', () => { const on = card.classList.toggle('show-src'); toggle.textContent = on ? 'Görüntü' : 'Kod'; });
      const dl = fmButton('SVG indir', () => {
        const svg = body.querySelector('svg'); if (!svg) return;
        const blob = new Blob([svg.outerHTML], { type: 'image/svg+xml' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'diyagram.svg'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      });
      const cp = fmButton('Kopyala', () => { navigator.clipboard.writeText(src); cp.textContent = 'Kopyalandı ✓'; setTimeout(() => { cp.textContent = 'Kopyala'; }, 1800); });
      actions.append(toggle, dl, cp); head.append(title, actions); card.append(head, body, pre);
      renderDiagram(body);
      return card;
    }
    const CALLOUTS = { NOTE: ['ℹ️', 'Not', 'note'], TIP: ['💡', 'İpucu', 'tip'], WARNING: ['⚠️', 'Uyarı', 'warn'], IMPORTANT: ['📌', 'Önemli', 'imp'], CAUTION: ['🛑', 'Dikkat', 'caution'] };
    function enhanceRich(container) {
      container.querySelectorAll('pre > code.language-mermaid').forEach((code) => { code.parentElement.replaceWith(buildDiagramCard(code.textContent || '')); });
      container.querySelectorAll('blockquote').forEach((bq) => {
        const p = bq.firstElementChild; if (!p || bq.classList.contains('fm-callout')) return;
        const m = /^\s*\[!(NOTE|TIP|WARNING|IMPORTANT|CAUTION)\]\s*/i.exec(p.textContent || ''); if (!m) return;
        const c = CALLOUTS[m[1].toUpperCase()];
        p.innerHTML = p.innerHTML.replace(/^\s*\[!(NOTE|TIP|WARNING|IMPORTANT|CAUTION)\]\s*(<br\s*\/?>)?\s*/i, '');
        if (!p.textContent.trim()) p.remove();
        const t = document.createElement('div'); t.className = 'fm-callout-title'; t.textContent = c[0] + ' ' + c[1];
        bq.insertBefore(t, bq.firstChild); bq.classList.add('fm-callout', 'fm-callout-' + c[2]);
      });
      container.querySelectorAll('table').forEach((t) => {
        if (t.closest('.table-scroll')) return;
        const card = document.createElement('div'); card.className = 'fm-card table-card';
        const head = document.createElement('div'); head.className = 'fm-card-head';
        const label = document.createElement('span'); label.textContent = 'Tablo';
        const cp = fmButton('CSV kopyala', () => {
          const csv = Array.from(t.rows).map((r) => Array.from(r.cells).map((c) => '"' + c.textContent.trim().replace(/"/g, '""') + '"').join(',')).join('\n');
          navigator.clipboard.writeText(csv); cp.textContent = 'Kopyalandı ✓'; setTimeout(() => { cp.textContent = 'CSV kopyala'; }, 1800);
        });
        head.append(label, cp);
        const sc = document.createElement('div'); sc.className = 'table-scroll';
        t.replaceWith(card); sc.appendChild(t); card.append(head, sc);
      });
      const maths = container.querySelectorAll('.fm-math:not([data-done])');
      if (maths.length) {
        loadOnce(KATEX_CSS, 'css').catch(() => {});
        loadOnce(KATEX_JS).then(() => maths.forEach((el) => {
          try { window.katex.render(el.dataset.tex || '', el, { displayMode: el.dataset.display === '1', throwOnError: false }); el.dataset.done = '1'; } catch (_) {}
        })).catch(() => {});
      }
    }
    function stashMath(md) {
      const store = []; let head = md, tail = '';
      if (((md.match(/```/g) || []).length) % 2 === 1) { const k = md.lastIndexOf('```'); head = md.slice(0, k); tail = md.slice(k); }
      const parts = head.split(/(```[\s\S]*?```|`[^`\n]*`)/g);
      for (let i = 0; i < parts.length; i += 2) {
        parts[i] = parts[i].replace(/\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)/g, (m, a, b, c) => {
          store.push({ tex: (a !== undefined ? a : b !== undefined ? b : c).trim(), display: a !== undefined || b !== undefined });
          return '@@FMATH' + (store.length - 1) + '@@';
        });
      }
      return { text: parts.join('') + tail, store };
    }
    const fmAttr = (x) => String(x).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    // marked çıktısı DOMPurify ile temizlenir. DOMPurify yüklenemezse düz metin (escape) gösterilir.
    function parseMarkdownSafe(mdText) {
      if (!mdText) return '';
      try {
        if (window.marked && typeof window.marked.parse === 'function' && window.DOMPurify) {
          const st = stashMath(mdText);
          const rawHtml = window.marked.parse(st.text, { breaks: true });
          let html = window.DOMPurify.sanitize(rawHtml);
          if (st.store.length) {
            html = html.replace(/@@FMATH(\d+)@@/g, (m, i) => {
              const x = st.store[+i]; if (!x) return m;
              const shown = x.display ? '$$' + x.tex + '$$' : '\\(' + x.tex + '\\)';
              return '<span class="fm-math' + (x.display ? ' fm-math-d' : '') + '" data-tex="' + fmAttr(x.tex) + '" data-display="' + (x.display ? 1 : 0) + '">' + fmAttr(shown) + '</span>';
            });
          }
          return html;
        }
      } catch (e) {}
      return escapeHtml(mdText).replace(/\n/g, '<br>');
    }

    function enhanceRenderedContent(container) {
      if (!container) return;
      enhanceRich(container);
      const preBlocks = container.querySelectorAll('pre');
      preBlocks.forEach((pre) => {
        if (pre.parentElement && pre.parentElement.classList.contains('code-wrapper')) return;
        const codeEl = pre.querySelector('code');
        if (!codeEl) return;

        const rawCode = codeEl.textContent || '';
        let lang = 'metin';
        codeEl.classList.forEach(cls => {
          if (cls.startsWith('language-')) lang = cls.replace('language-', '');
        });

        if (window.hljs && typeof window.hljs.highlightElement === 'function') {
          try { window.hljs.highlightElement(codeEl); } catch (_) {}
        }

        const wrapper = document.createElement('div');
        wrapper.className = 'code-wrapper';

        const header = document.createElement('div');
        header.className = 'code-header';

        const langBadge = document.createElement('span');
        langBadge.className = 'uppercase font-semibold text-slate-500';
        langBadge.textContent = lang;
        if (lang === 'diff' || lang === 'patch') {
          const ls = rawCode.split('\n');
          const add = ls.filter((l) => /^\+(?!\+\+)/.test(l)).length, del = ls.filter((l) => /^-(?!--)/.test(l)).length;
          langBadge.textContent = lang + '  +' + add + ' −' + del;
        }

        const btnGroup = document.createElement('div');
        btnGroup.className = 'flex items-center gap-2';

        const previewBtn = document.createElement('button');
        previewBtn.type = 'button';
        previewBtn.className = 'px-2 py-0.5 rounded-md bg-blue-50 text-blue-600 hover:bg-blue-100 font-sans font-semibold text-[11px] transition cursor-pointer';
        previewBtn.textContent = '👁️ Önizle';
        previewBtn.onclick = () => {
          const isHtml = lang === 'html' || lang === 'svg' || rawCode.trim().startsWith('<!DOCTYPE') || rawCode.trim().startsWith('<html') || rawCode.trim().startsWith('<svg');
          openArtifactPreview({
            title: isHtml ? 'Canlı Web Önizleme' : `Kod Çalışması (${lang.toUpperCase()})`,
            type: isHtml ? 'html' : 'code',
            content: rawCode,
            lang: lang,
            ext: isHtml ? 'html' : (lang === 'javascript' ? 'js' : lang === 'python' ? 'py' : 'txt')
          });
        };

        const copyBtn = document.createElement('button');
        copyBtn.type = 'button';
        copyBtn.className = 'text-slate-500 hover:text-blue-600 font-sans font-medium text-[11px] transition cursor-pointer';
        copyBtn.textContent = 'Kopyala';
        copyBtn.onclick = () => {
          navigator.clipboard.writeText(rawCode);
          copyBtn.textContent = 'Kopyalandı ✓';
          copyBtn.classList.add('text-emerald-600');
          setTimeout(() => {
            copyBtn.textContent = 'Kopyala';
            copyBtn.classList.remove('text-emerald-600');
          }, 2000);
        };

        btnGroup.appendChild(previewBtn);
        btnGroup.appendChild(copyBtn);
        header.appendChild(langBadge);
        header.appendChild(btnGroup);

        pre.parentNode.insertBefore(wrapper, pre);
        wrapper.appendChild(header);
        wrapper.appendChild(pre);
      });
    }

    function openArtifactPreview(artifact) {
      state.currentArtifact = artifact;
      els.previewPane.classList.remove('hidden');
      els.previewEmptyState.classList.add('hidden');
      els.previewTitle.textContent = artifact.title || 'Oforge AI Önizleme';

      els.previewIframe.classList.add('hidden');
      els.previewDocumentView.classList.add('hidden');
      els.previewCodeView.classList.add('hidden');
      els.previewModeTabs.classList.add('hidden');
      els.printPdfBtn.classList.add('hidden');

      if (artifact.type === 'html') {
        els.previewSubtitle.textContent = 'Canlı İnteraktif Görünüm';
        els.previewModeTabs.classList.remove('hidden');
        showPreviewTab('live');
      } else if (artifact.type === 'document') {
        els.previewSubtitle.textContent = 'Belge & Rapor Önizlemesi';
        els.printPdfBtn.classList.remove('hidden');
        els.previewDocumentView.classList.remove('hidden');
        els.previewDocumentView.innerHTML = parseMarkdownSafe(artifact.content);
        enhanceRenderedContent(els.previewDocumentView);
      } else {
        els.previewSubtitle.textContent = `Kaynak Kod (${(artifact.lang || 'TXT').toUpperCase()})`;
        els.previewCodeView.classList.remove('hidden');
        els.previewCodeContent.textContent = artifact.content;
      }
      refreshIcons();
    }

    function showPreviewTab(mode) {
      if (!state.currentArtifact) return;
      if (mode === 'live') {
        els.tabLiveView.className = 'px-2.5 py-1 rounded-md bg-white text-slate-900 shadow-2xs transition cursor-pointer';
        els.tabSourceView.className = 'px-2.5 py-1 rounded-md text-slate-600 hover:text-slate-900 transition cursor-pointer';
        els.previewCodeView.classList.add('hidden');
        els.previewDocumentView.classList.add('hidden');
        els.previewIframe.classList.remove('hidden');
        els.previewIframe.srcdoc = state.currentArtifact.content;
      } else {
        els.tabSourceView.className = 'px-2.5 py-1 rounded-md bg-white text-slate-900 shadow-2xs transition cursor-pointer';
        els.tabLiveView.className = 'px-2.5 py-1 rounded-md text-slate-600 hover:text-slate-900 transition cursor-pointer';
        els.previewIframe.classList.add('hidden');
        els.previewDocumentView.classList.add('hidden');
        els.previewCodeView.classList.remove('hidden');
        els.previewCodeContent.textContent = state.currentArtifact.content;
      }
    }

    els.tabLiveView.onclick = () => showPreviewTab('live');
    els.tabSourceView.onclick = () => showPreviewTab('source');
    document.getElementById('closePreviewPaneBtn').onclick = () => els.previewPane.classList.add('hidden');
    document.getElementById('togglePreviewPaneBtn').onclick = () => els.previewPane.classList.toggle('hidden');

    document.getElementById('printPdfBtn').onclick = () => {
      if (!state.currentArtifact || state.currentArtifact.type !== 'document') return;
      const printArea = document.getElementById('printArea');
      printArea.innerHTML = `<div style="border-bottom:2px solid #2563EB;padding-bottom:8px;margin-bottom:16px;font-family:sans-serif;"><strong>Oforge AI</strong> • Belge Çıktısı</div>` + parseMarkdownSafe(state.currentArtifact.content);
      window.print();
    };

    document.getElementById('copyArtifactBtn').onclick = () => {
      if (!state.currentArtifact) return;
      navigator.clipboard.writeText(state.currentArtifact.content || '');
    };

    document.getElementById('downloadArtifactBtn').onclick = () => {
      if (!state.currentArtifact) return;
      const blob = new Blob([state.currentArtifact.content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `oforge-ai-calisma.${state.currentArtifact.ext || 'txt'}`;
      a.click();
    };

    window.copyRawText = function(btn, text) {
      navigator.clipboard.writeText(text);
      const span = btn.querySelector('span');
      if (span) {
        span.textContent = 'Kopyalandı ✓';
        span.classList.add('text-emerald-600');
        setTimeout(() => { span.textContent = 'Kopyala'; span.classList.remove('text-emerald-600'); }, 2000);
        return;
      }
      const old = btn.innerHTML;
      btn.innerHTML = msgIcon('check');
      btn.classList.add('text-emerald-600');
      forgeToast('Yanıt panoya kopyalandı', 1400);
      setTimeout(() => { btn.innerHTML = old; btn.classList.remove('text-emerald-600'); }, 1600);
    };

    window.previewFullResponse = function(content) {
      const htmlMatch = content.match(/```html\s*([\s\S]*?)```/i);
      if (htmlMatch && htmlMatch[1]) {
        openArtifactPreview({
          title: 'Canlı Web Çalışması Önizlemesi',
          type: 'html',
          content: htmlMatch[1].trim(),
          lang: 'html',
          ext: 'html'
        });
      } else {
        openArtifactPreview({
          title: 'Oforge AI Belge & Rapor Önizlemesi',
          type: 'document',
          content: content,
          ext: 'md'
        });
      }
    };

    window.speakText = function(text) {
      if (!('speechSynthesis' in window)) return;
      if (window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
        return;
      }
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'tr-TR';
      window.speechSynthesis.speak(utterance);
    };

    window.openLightbox = function(src) {
      els.lightboxImg.src = src;
      els.imageLightbox.classList.remove('hidden');
    };

    // Bulut eşitleme (Firebase) modülü bu kancaları gerçek işlevlerle değiştirir.
    window.forgeCloud = { push() {}, remove() {} };

    function syncStorage() {
      if (!storage.setJSON(KEYS.CHATS, state.chats)) console.warn('Yerel depolama sınırına ulaşıldı.');
      try { window.forgeCloud.push(); } catch (_) {}
    }

    function updateApiBadge() {
      const valid = keyOk();
      const sel = document.getElementById('modelSelect');
      if (sel && sel.value !== curModel().id) sel.value = curModel().id;
      els.keyStatusBadge.className = `w-2 h-2 rounded-full ${valid ? 'bg-emerald-500' : 'bg-rose-500'}`;
      const warningEl = document.getElementById('noKeyWarning');
      if (warningEl) warningEl.classList.toggle('hidden', valid);
    }

    function isImageFile(file) {
      return (file.type && file.type.startsWith('image/')) || /\.(jpe?g|png|webp|gif|bmp|avif|heic|heif)$/i.test(file.name || '');
    }

    function handleMultipleImages(files) {
      if (!files || files.length === 0) return;
      const failed = [];
      const MAX_DIM = 1600;
      const addImage = (file, source, w, h) => {
        let width = w, height = h;
        if (width > MAX_DIM || height > MAX_DIM) {
          if (width > height) { height = Math.round((height * MAX_DIM) / width); width = MAX_DIM; }
          else { width = Math.round((width * MAX_DIM) / height); height = MAX_DIM; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, width, height); // şeffaf PNG'ler siyah çıkmasın
        ctx.drawImage(source, 0, 0, width, height);
        state.attachedImages.push({
          id: 'img_' + Math.random().toString(36).substring(2, 9),
          name: file.name || 'fotoğraf.jpg',
          dataUrl: canvas.toDataURL('image/jpeg', 0.92)
        });
        renderAttachmentsBar();
      };
      const loadOne = (file) => new Promise((resolve) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => { try { addImage(file, img, img.naturalWidth || img.width, img.naturalHeight || img.height); } catch (_) { failed.push(file.name); } URL.revokeObjectURL(url); resolve(); };
        img.onerror = async () => {
          URL.revokeObjectURL(url);
          try {
            const bmp = await createImageBitmap(file);
            addImage(file, bmp, bmp.width, bmp.height);
          } catch (_) { failed.push(file.name || 'görsel'); }
          resolve();
        };
        img.src = url;
      });
      Promise.all(Array.from(files).filter(isImageFile).map(loadOne)).then(() => {
        if (failed.length) alert('Bu fotoğraf okunamadı (HEIC/HEIF gibi desteklenmeyen bir biçim olabilir): ' + failed.join(', ') + '\nLütfen JPG, PNG veya WEBP olarak ekleyin.');
      });
    }

    function handleMultipleDocuments(files) {
      if (!files || files.length === 0) return;
      Array.from(files).forEach(file => {
        if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
          const reader = new FileReader();
          reader.onload = (ev) => {
            const dataUrl = ev.target.result;
            const base64Data = dataUrl.split(',')[1];
            state.attachedFiles.push({
              id: 'doc_' + Math.random().toString(36).substring(2, 9),
              name: file.name,
              type: 'pdf',
              base64Data: base64Data,
              mimeType: 'application/pdf'
            });
            renderAttachmentsBar();
          };
          reader.readAsDataURL(file);
        } else {
          const reader = new FileReader();
          reader.onload = (ev) => {
            state.attachedFiles.push({
              id: 'doc_' + Math.random().toString(36).substring(2, 9),
              name: file.name,
              type: 'text',
              content: ev.target.result
            });
            renderAttachmentsBar();
          };
          reader.readAsText(file);
        }
      });
    }

    window.removeAttachedImage = function(id) {
      state.attachedImages = state.attachedImages.filter(img => img.id !== id);
      renderAttachmentsBar();
    };

    window.removeAttachedFile = function(id) {
      state.attachedFiles = state.attachedFiles.filter(f => f.id !== id);
      renderAttachmentsBar();
    };

    function renderAttachmentsBar() {
      const bar = els.attachmentsPreviewBar;
      bar.innerHTML = '';
      const hasAny = state.attachedImages.length > 0 || state.attachedFiles.length > 0;
      bar.classList.toggle('hidden', !hasAny);

      state.attachedImages.forEach(img => {
        const card = document.createElement('div');
        card.className = 'relative group bg-white p-1.5 rounded-2xl border border-blue-200 shadow-xs flex items-center gap-2 pr-3';
        card.innerHTML = `
          <img src="${img.dataUrl}" class="w-10 h-10 object-cover rounded-xl border border-slate-100" />
          <div class="text-xs">
            <p class="font-semibold text-slate-800 max-w-[120px] truncate">${escapeHtml(img.name)}</p>
            <span class="text-[10px] text-blue-600 font-medium">Fotoğraf</span>
          </div>
          <button type="button" onclick="removeAttachedImage('${img.id}')" class="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition ml-1" title="Kaldır">
            <i data-lucide="x" class="w-3.5 h-3.5"></i>
          </button>
        `;
        bar.appendChild(card);
      });

      state.attachedFiles.forEach(f => {
        const card = document.createElement('div');
        card.className = 'inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-xs font-medium';
        const iconName = f.type === 'pdf' ? 'file-text' : 'file-code';
        card.innerHTML = `
          <i data-lucide="${iconName}" class="w-4 h-4 text-blue-600 shrink-0"></i>
          <span class="max-w-[160px] truncate">${escapeHtml(f.name)}</span>
          <button type="button" onclick="removeAttachedFile('${f.id}')" class="text-blue-500 hover:text-rose-600 ml-1">
            <i data-lucide="x" class="w-3.5 h-3.5"></i>
          </button>
        `;
        bar.appendChild(card);
      });
      refreshIcons();
    }

    function clearAllAttachments() {
      state.attachedImages = [];
      state.attachedFiles = [];
      els.imageInput.value = '';
      els.fileInput.value = '';
      renderAttachmentsBar();
    }

    let dragCounter = 0;
    window.addEventListener('dragenter', (e) => {
      e.preventDefault();
      dragCounter++;
      els.dropZoneOverlay.classList.remove('hidden');
    });
    window.addEventListener('dragleave', (e) => {
      e.preventDefault();
      dragCounter--;
      if (dragCounter <= 0) {
        dragCounter = 0;
        els.dropZoneOverlay.classList.add('hidden');
      }
    });
    window.addEventListener('dragover', (e) => e.preventDefault());
    window.addEventListener('drop', (e) => {
      e.preventDefault();
      dragCounter = 0;
      els.dropZoneOverlay.classList.add('hidden');
      const files = e.dataTransfer?.files;
      if (!files || files.length === 0) return;
      
      const imgFiles = Array.from(files).filter(isImageFile);
      const docFiles = Array.from(files).filter(f => !isImageFile(f));
      if (imgFiles.length > 0) handleMultipleImages(imgFiles);
      if (docFiles.length > 0) handleMultipleDocuments(docFiles);
    });

    window.addEventListener('paste', (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          handleMultipleImages([item.getAsFile()]);
          break;
        }
      }
    });

    document.getElementById('attachImageBtn').onclick = () => els.imageInput.click();
    els.imageInput.onchange = (e) => { const f = Array.from(e.target.files || []); e.target.value = ''; handleMultipleImages(f); };

    document.getElementById('attachFileBtn').onclick = () => els.fileInput.click();
    els.fileInput.onchange = (e) => { const f = Array.from(e.target.files || []); e.target.value = ''; handleMultipleDocuments(f); };

    function toggleSidebar(show) {
      els.sidebar.classList.toggle('-translate-x-full', !show);
      els.sidebarOverlay.classList.toggle('hidden', !show);
    }
    document.getElementById('openSidebarBtn').onclick = () => toggleSidebar(true);
    document.getElementById('closeSidebarBtn').onclick = () => toggleSidebar(false);
    els.sidebarOverlay.onclick = () => toggleSidebar(false);

    const selectedChats = new Set();
    function updateBulkBar() {
      const bar = document.getElementById('bulkBar');
      if (!bar) return;
      const n = selectedChats.size;
      bar.classList.toggle('hidden', n === 0);
      els.chatList.dataset.selecting = n ? '1' : '';
      document.getElementById('bulkCount').textContent = n + ' seçili';
      const q = (els.searchChatsInput.value || '').toLowerCase();
      const shown = state.chats.filter(c => c.title.toLowerCase().includes(q));
      document.getElementById('bulkAllBtn').textContent = shown.length && shown.every(c => selectedChats.has(c.id)) ? 'Seçimi kaldır' : 'Tümünü seç';
    }

    function renderChatList(filter = '') {
      els.chatList.innerHTML = '';
      [...selectedChats].forEach(id => { if (!state.chats.some(c => c.id === id)) selectedChats.delete(id); });
      updateBulkBar();
      const filtered = state.chats.filter(c => c.title.toLowerCase().includes(filter.toLowerCase()));

      if (filtered.length === 0) {
        els.chatList.innerHTML = `<div class="text-center py-8 text-xs text-slate-400">Kayıtlı çalışma bulunamadı.</div>`;
        return;
      }

      filtered.forEach(chat => {
        const active = chat.id === state.activeChatId;
        const item = document.createElement('div');
        item.className = `group flex items-center justify-between px-3 py-2.5 rounded-xl text-[15px] cursor-pointer transition ${
          active ? 'bg-[#E9E7E0] text-slate-900 font-medium' : 'text-slate-700 hover:bg-[#EFEDE7]'
        }`;
        item.innerHTML = `
          <div class="flex items-center min-w-0 flex-1">
            <span class="chat-sel-wrap flex items-center shrink-0 cursor-pointer" title="Silmek için seç">
              <input type="checkbox" class="chat-sel w-3.5 h-3.5 accent-blue-600 cursor-pointer" ${selectedChats.has(chat.id) ? 'checked' : ''} aria-label="Sohbeti seç">
            </span>
            <span class="truncate">${escapeHtml(chat.title)}</span>
          </div>
          <button type="button" class="delete-chat opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-600 rounded-md transition" title="Sil">
            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
          </button>
        `;
        item.onclick = async (e) => {
          const selWrap = e.target.closest('.chat-sel-wrap');
          if (selWrap) {
            const cb = selWrap.querySelector('.chat-sel');
            if (e.target !== cb) cb.checked = !cb.checked;
            if (cb.checked) selectedChats.add(chat.id); else selectedChats.delete(chat.id);
            updateBulkBar();
            return;
          }
          if (e.target.closest('.delete-chat')) {
            if (!(await forgeDialog('Bu çalışma kalıcı olarak silinsin mi?', { confirm: true, danger: true, okText: 'Sil' }))) return;
            chat.messages.forEach(m => { if (m.hasAttach) AttachDB.del(m.id); });
            state.chats = state.chats.filter(c => c.id !== chat.id);
            selectedChats.delete(chat.id);
            try { window.forgeCloud.remove([chat.id]); } catch (_) {}
            if (state.activeChatId === chat.id) state.activeChatId = null;
            syncStorage();
            renderChatList(els.searchChatsInput.value);
            renderMessages();
            return;
          }
          state.activeChatId = chat.id;
          renderChatList(els.searchChatsInput.value);
          renderMessages();
          toggleSidebar(false);
        };
        els.chatList.appendChild(item);
      });
      refreshIcons();
    }

    document.getElementById('bulkAllBtn').onclick = () => {
      const q = (els.searchChatsInput.value || '').toLowerCase();
      const shown = state.chats.filter(c => c.title.toLowerCase().includes(q));
      const allOn = shown.length > 0 && shown.every(c => selectedChats.has(c.id));
      shown.forEach(c => { if (allOn) selectedChats.delete(c.id); else selectedChats.add(c.id); });
      renderChatList(els.searchChatsInput.value);
    };
    document.getElementById('bulkCancelBtn').onclick = () => {
      selectedChats.clear();
      renderChatList(els.searchChatsInput.value);
    };
    document.getElementById('bulkDeleteBtn').onclick = async () => {
      const ids = [...selectedChats];
      if (!ids.length) return;
      if (!(await forgeDialog('Seçilen ' + ids.length + ' çalışma kalıcı olarak silinsin mi?', { confirm: true, danger: true, okText: 'Sil' }))) return;
      state.chats.filter(c => selectedChats.has(c.id)).forEach(c => c.messages.forEach(m => { if (m.hasAttach) AttachDB.del(m.id); }));
      try { window.forgeCloud.remove(ids); } catch (_) {}
      state.chats = state.chats.filter(c => !selectedChats.has(c.id));
      if (selectedChats.has(state.activeChatId)) state.activeChatId = null;
      selectedChats.clear();
      syncStorage();
      renderChatList(els.searchChatsInput.value);
      renderMessages();
    };

    function getWelcomeScreenHtml() {
      const hasValidKey = keyOk();
      return `
        <div id="welcomeScreen" class="min-h-full flex flex-col items-center justify-center max-w-3xl mx-auto text-center py-8">
          <div class="fm-brand w-16 h-16 rounded-2xl bg-[#0F1629] border border-slate-700/40 flex items-center justify-center text-white shadow-xl mb-5">
            <span data-forge-logo data-fm="once" class="block w-10 h-10"></span>
          </div>
          
          <h1 class="text-slate-900"><span class="owm owm-hero" role="img" aria-label="Oforge AI"><span class="owm-o" aria-hidden="true">O</span><span class="owm-f" aria-hidden="true">forge</span><span class="owm-aiwrap" aria-hidden="true"><span class="owm-ai">AI</span><span class="owm-sub">asistanı</span></span></span></h1>
          <p class="text-sm sm:text-base text-slate-500 max-w-md mb-8 leading-relaxed">
            ${(currentUser && currentUser.name) ? 'Merhaba, ' + escapeHtml(String(currentUser.name).split(' ')[0]) + '. ' : ''}Size nasıl yardımcı olabilirim?
          </p>

          <div id="noKeyWarning" class="${hasValidKey ? 'hidden' : ''} w-full max-w-lg mb-8 p-4 rounded-2xl bg-amber-50 border border-amber-200/80 text-left flex items-start gap-3 shadow-2xs">
            <i data-lucide="key-round" class="w-5 h-5 text-amber-600 shrink-0 mt-0.5"></i>
            <div class="text-xs text-amber-900 space-y-1">
              <p class="font-semibold">Oforge AI Motor Aktivasyonu Gerekli</p>
              <p class="text-amber-700">Sol alttaki <strong>Oforge AI Motor Ayarları</strong> bölümüne API erişim anahtarınızı kaydedin.</p>
            </div>
          </div>


        </div>
      `;
    }

    window.usePromptCard = function(btn) {
      const p = btn.querySelector('p');
      if (p) {
        els.userInput.value = p.textContent;
        els.userInput.focus();
      }
    };

    window.applySlashCmd = function(cmdText) {
      els.userInput.value = cmdText;
      els.slashMenu.classList.add('hidden');
      els.userInput.focus();
    };

    // ===== v6.9.33 · Yanıtın başına dön · Paylaş / Beğen · Limit uyarısı =====
    let limitBannerTimer = null;
    let sharePop = null;

    const FB_ICON_UP = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 10v12"/><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z"/></svg>';
    const FB_ICON_DOWN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 14V2"/><path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z"/></svg>';

    // --- Yanıt altı işlem satırı (Gemini tarzı simgeler): Beğen · Beğenme · Kopyala · Önizle/PDF · ⋯ (Dinle, Paylaş)
    const MSG_ICONS = {
      copy: '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
      check: '<path d="M20 6 9 17l-5-5"/>',
      doc: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
      more: '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
      speak: '<path d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z"/><path d="M16 9a5 5 0 0 1 0 6"/><path d="M19.364 18.364a9 9 0 0 0 0-12.728"/>',
      share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" x2="15.42" y1="13.51" y2="17.49"/><line x1="15.41" x2="8.59" y1="6.51" y2="10.49"/>',
      wa: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
      mail: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
      dl: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>'
    };
    function msgIcon(name) {
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + MSG_ICONS[name] + '</svg>';
    }
    function msgActionsHtml() {
      const ib = 'fb-btn p-2 rounded-full hover:bg-slate-100 hover:text-slate-700 transition cursor-pointer';
      const btn = (act, label, icon, extra) => '<button type="button" data-action="' + act + '" class="' + ib + (extra ? ' ' + extra : '') + '" title="' + label + '" aria-label="' + label + '">' + icon + '</button>';
      return btn('like', 'Beğendim', FB_ICON_UP, 'hover:!text-emerald-600').replace('class="', 'aria-pressed="false" class="') +
             btn('dislike', 'Beğenmedim', FB_ICON_DOWN, 'hover:!text-rose-600').replace('class="', 'aria-pressed="false" class="') +
             btn('copy', 'Kopyala', msgIcon('copy')) +
             btn('preview', 'Önizle / PDF', msgIcon('doc')) +
             btn('more', 'Diğer', msgIcon('more')).replace('class="', 'aria-haspopup="menu" class="');
    }

    function paintFeedback(row, fb) {
      [['like', 'up', 'is-on-up', 'text-emerald-600'], ['dislike', 'down', 'is-on-down', 'text-rose-600']].forEach(([act, kind, onCls, txtCls]) => {
        const b = row.querySelector('[data-action="' + act + '"]');
        if (!b) return;
        const active = fb === kind;
        b.classList.toggle(onCls, active);
        b.classList.toggle(txtCls, active);
        b.setAttribute('aria-pressed', String(active));
      });
    }

    function toggleFeedback(row, kind) {
      const chat = state.chats.find(c => c.id === state.activeChatId);
      const idx = parseInt(row.dataset.idx, 10);
      const msg = chat && chat.messages[idx];
      if (!msg || msg.role !== 'assistant') return;
      if (msg.feedback === kind) delete msg.feedback; else msg.feedback = kind;
      paintFeedback(row, msg.feedback);
      syncStorage();
      forgeToast(!msg.feedback ? 'İşaret kaldırıldı' : kind === 'up' ? 'Yanıt beğenildi olarak işaretlendi' : 'Yanıt beğenilmedi olarak işaretlendi');
    }

    function forgeToast(text, ms) {
      let t = document.getElementById('forgeToast');
      if (!t) {
        t = document.createElement('div');
        t.id = 'forgeToast';
        t.setAttribute('role', 'status');
        t.className = 'fixed left-1/2 -translate-x-1/2 bottom-24 z-[80] max-w-[90vw] px-4 py-2 rounded-xl bg-slate-900 text-white text-sm shadow-float transition-opacity duration-200 opacity-0 pointer-events-none';
        document.body.appendChild(t);
      }
      t.textContent = text;
      t.classList.remove('opacity-0');
      clearTimeout(t._h);
      t._h = setTimeout(() => t.classList.add('opacity-0'), ms || 2200);
    }

    // --- Paylaş menüsü
    function closeSharePopover() { if (sharePop) { sharePop.remove(); sharePop = null; } }
    try {
    document.addEventListener('click', (e) => {
      if (!sharePop) return;
      if (e.target.closest('#sharePop') || e.target.closest('[data-action="more"]')) return;
      closeSharePopover();
    }, true);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSharePopover(); });
    els.messagesContainer.addEventListener('scroll', closeSharePopover, { passive: true });
    } catch (e) { console.warn('Oforge AI: paylaş menüsü başlatılamadı', e); }

    function openSharePopover(btn, text) {
      if (sharePop && sharePop._btn === btn) { closeSharePopover(); return; }
      closeSharePopover();
      const body = String(text || '').trim();
      if (!body) return;
      const SIGN = '\n\n— Oforge AI ile oluşturuldu';
      const full = body + SIGN;
      const LIM = 1500;
      const truncated = full.length > LIM;
      const short = truncated ? body.slice(0, LIM - SIGN.length - 1).trimEnd() + '…' + SIGN : full;
      const items = [];
      items.push(['Sesli dinle', () => window.speakText(text), 'speak']);
      if (navigator.share) items.push(['Paylaş…', async () => { try { await navigator.share({ title: 'Oforge AI yanıtı', text: full }); } catch (_) {} }, 'share']);
      items.push(['WhatsApp', () => { window.open('https://wa.me/?text=' + encodeURIComponent(short), '_blank', 'noopener'); }, 'wa']);
      items.push(['E-posta', () => { window.location.href = 'mailto:?subject=' + encodeURIComponent('Oforge AI yanıtı') + '&body=' + encodeURIComponent(short); }, 'mail']);
      items.push(['Markdown (.md) olarak indir', () => {
        const blob = new Blob([full], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'Oforge-AI-Yanit-' + new Date().toISOString().slice(0, 10) + '.md';
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }, 'dl']);

      const pop = document.createElement('div');
      pop.id = 'sharePop';
      pop.setAttribute('role', 'menu');
      pop.className = 'fixed z-[70] w-64 bg-white border border-slate-200 rounded-2xl shadow-float p-1.5';
      items.forEach(([label, fn, ico]) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.setAttribute('role', 'menuitem');
        b.className = 'w-full text-left px-3 py-2 rounded-xl text-sm text-slate-700 hover:bg-slate-100 transition cursor-pointer flex items-center gap-3';
        b.innerHTML = '<span class="w-[18px] h-[18px] shrink-0 text-slate-500 [&>svg]:w-full [&>svg]:h-full">' + msgIcon(ico) + '</span><span></span>';
        b.lastChild.textContent = label;
        b.onclick = () => { closeSharePopover(); fn(); };
        pop.appendChild(b);
      });
      if (truncated) {
        const n = document.createElement('p');
        n.className = 'px-3 pt-1.5 pb-1 text-[11px] leading-snug text-slate-400';
        n.textContent = 'WhatsApp ve e-postada uzun yanıt kısaltılır; tamamı için kopyalama simgesini veya indirmeyi kullanın.';
        pop.appendChild(n);
      }
      document.body.appendChild(pop);
      const r = btn.getBoundingClientRect();
      const ph = pop.offsetHeight, pw = pop.offsetWidth;
      let top = r.bottom + 6;
      if (top + ph > window.innerHeight - 8) top = Math.max(8, r.top - ph - 6);
      pop.style.top = top + 'px';
      pop.style.left = Math.min(Math.max(8, r.left), Math.max(8, window.innerWidth - pw - 8)) + 'px';
      pop._btn = btn;
      sharePop = pop;
    }

    // --- Limit uyarısı (Claude tarzı: "limit doldu · şu saatte sıfırlanır")
    function formatResetText(ts, approx) {
      const d = new Date(ts), now = new Date();
      const time = d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
      const startOf = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
      const dayDiff = Math.round((startOf(d) - startOf(now)) / 86400000);
      const day = dayDiff <= 0 ? 'bugün' : dayDiff === 1 ? 'yarın' : d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });
      return 'Sıfırlanma: ' + (approx ? 'yaklaşık ' : '') + day + ' ' + time;
    }
    function formatRemaining(ms) {
      const t = Math.max(0, Math.ceil(ms / 1000));
      const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
      if (h > 0) return h + ' sa ' + m + ' dk';
      if (m > 0) return m + ' dk ' + s + ' sn';
      return s + ' sn';
    }
    function applyLimitToMessage(m, q) {
      m.isLimit = true;
      m.limitResetAt = q.resetAt;
      m.limitDaily = !!q.daily;
      m.limitApprox = !!q.approx;
      m.limitModel = q.model || '';
      m.content = 'Kullanım sınırına ulaşıldı. ' + formatResetText(q.resetAt, q.approx);
    }
    function renderLimitCard(row, m, isLast) {
      const prose = row.querySelector('.prose');
      if (!prose) return;
      const acts = row.querySelector('.msg-actions'); if (acts) acts.classList.add('hidden');
      const disc = row.querySelector('.msg-disclaimer'); if (disc) disc.classList.add('hidden');
      const title = m.limitDaily ? 'Günlük kullanım limitine ulaştınız' : 'Kullanım sınırına ulaştınız';
      const sub = (m.limitDaily ? 'Bu motorun günlük istek hakkı doldu.' : 'Kısa süreli istek sınırı aşıldı; biraz bekleyip yeniden deneyebilirsiniz.') + (m.limitModel ? ' (' + m.limitModel + ')' : '');
      prose.innerHTML = `
        <div class="not-prose rounded-2xl border border-amber-200 bg-amber-50/70 p-4 flex gap-3" role="alert">
          <div class="shrink-0 w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center text-lg" aria-hidden="true">⏳</div>
          <div class="min-w-0 flex-1">
            <p class="text-sm font-bold text-amber-900">${escapeHtml(title)}</p>
            <p class="mt-0.5 text-sm text-amber-800/90">${escapeHtml(sub)}</p>
            <p class="mt-2 text-sm font-semibold text-amber-900" data-limit-reset></p>
            <p class="text-xs font-mono text-amber-700 tabular-nums" data-limit-remaining></p>
            <div class="mt-3 flex flex-wrap gap-2">
              ${isLast ? '<button type="button" data-action="limit-retry" disabled class="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition">Yeniden dene</button>' : ''}
              <button type="button" data-action="limit-settings" class="px-3 py-1.5 rounded-xl bg-white border border-amber-200 text-amber-800 text-xs font-semibold hover:bg-amber-100 cursor-pointer transition">Motor ayarları</button>
            </div>
          </div>
        </div>`;
      const resetEl = prose.querySelector('[data-limit-reset]');
      const remEl = prose.querySelector('[data-limit-remaining]');
      const retryBtn = prose.querySelector('[data-action="limit-retry"]');
      const tick = () => {
        if (!row.isConnected) { clearInterval(timer); return; }
        const left = m.limitResetAt - Date.now();
        if (left <= 0) {
          resetEl.textContent = 'Limit sıfırlandı. Yeniden deneyebilirsiniz.';
          remEl.textContent = '';
          if (retryBtn) retryBtn.disabled = false;
          clearInterval(timer);
          return;
        }
        resetEl.textContent = formatResetText(m.limitResetAt, m.limitApprox);
        remEl.textContent = 'Kalan süre: ' + formatRemaining(left);
      };
      const timer = setInterval(tick, 1000);
      tick();
    }
    function retryAfterLimit(row) {
      if (state.isGenerating) return;
      const chat = state.chats.find(c => c.id === state.activeChatId);
      const idx = parseInt(row.dataset.idx, 10);
      const msg = chat && chat.messages[idx];
      if (!msg || !msg.isLimit || idx !== chat.messages.length - 1) return;
      if (!keyOk()) { els.settingsModal.classList.remove('hidden'); return; }
      chat.messages.splice(idx, 1);
      syncStorage();
      renderMessages();
      generateReply(chat, Promise.resolve());
    }
    function saveLimitState(q) {
      storage.setJSON(KEYS.LIMIT, { resetAt: q.resetAt, daily: !!q.daily, approx: !!q.approx, model: q.model || '' });
      showLimitBanner();
    }
    function clearLimitState() {
      storage.remove(KEYS.LIMIT);
      showLimitBanner();
    }
    function showLimitBanner() {
      const el = document.getElementById('limitBanner');
      clearInterval(limitBannerTimer);
      if (!el) return;
      let q = null;
      q = storage.getJSON(KEYS.LIMIT, null);
      if (!q || !q.resetAt || q.resetAt <= Date.now()) {
        el.classList.add('hidden');
        if (q) { storage.remove(KEYS.LIMIT); }
        return;
      }
      el.classList.remove('hidden');
      const txt = el.querySelector('[data-limit-banner-text]');
      const paint = () => {
        const left = q.resetAt - Date.now();
        if (left <= 0) { showLimitBanner(); return; }
        txt.textContent = (q.daily ? 'Günlük limit doldu' : 'Kullanım sınırına ulaşıldı') + ' · ' + formatResetText(q.resetAt, q.approx) + ' · kalan ' + formatRemaining(left);
      };
      paint();
      limitBannerTimer = setInterval(paint, 1000);
    }
    (function initLimitBanner() {
    try {
      const close = document.getElementById('limitBannerClose');
      if (close) close.onclick = () => { clearInterval(limitBannerTimer); document.getElementById('limitBanner').classList.add('hidden'); };
      showLimitBanner();
    } catch (e) { console.warn('Oforge AI: initLimitBanner başlatılamadı', e); }
    })();

    // --- Akış sırasında kullanıcı yukarı kaydırdıysa otomatik alta çekme
    (function initAutoStick() {
    try {
      const c = els.messagesContainer;
      state.autoStick = true;
      c.addEventListener('wheel', (e) => { if (e.deltaY < 0) state.autoStick = false; }, { passive: true });
      c.addEventListener('touchmove', () => { state.autoStick = false; }, { passive: true });
      c.addEventListener('scroll', () => { if (c.scrollHeight - c.scrollTop - c.clientHeight < 80) state.autoStick = true; }, { passive: true });
    } catch (e) { console.warn('Oforge AI: initAutoStick başlatılamadı', e); }
    })();

    // --- "Yanıtın başına dön" düğmesi
    (function initJumpTop() {
    try {
      const c = els.messagesContainer;
      const btn = document.getElementById('jumpTopBtn');
      if (!c || !btn) return;
      let queued = false, target = null;
      const update = () => {
        queued = false;
        const cTop = c.getBoundingClientRect().top;
        const rows = c.querySelectorAll('.msg-row');
        let cur = null;
        for (let i = rows.length - 1; i >= 0; i--) {
          if (rows[i].getBoundingClientRect().top - cTop <= 80) { cur = rows[i]; break; }
        }
        let show = false;
        if (cur && cur.querySelector('.forge-avatar')) {
          const rect = cur.getBoundingClientRect();
          show = (cTop - rect.top > 160) && (rect.bottom - cTop > 80);
        }
        target = show ? cur : null;
        btn.classList.toggle('is-hidden', !show);
        btn.tabIndex = show ? 0 : -1;
      };
      const schedule = () => { if (!queued) { queued = true; requestAnimationFrame(update); } };
      c.addEventListener('scroll', schedule, { passive: true });
      window.addEventListener('resize', schedule);
      new MutationObserver(schedule).observe(c, { childList: true, subtree: true, characterData: true });
      btn.addEventListener('click', () => {
        if (!target) return;
        const top = target.getBoundingClientRect().top - c.getBoundingClientRect().top + c.scrollTop - 12;
        state.autoStick = false;
        c.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
      });
      schedule();
    } catch (e) { console.warn('Oforge AI: initJumpTop başlatılamadı', e); }
    })();

    function renderMessages() {
      const chat = state.chats.find(c => c.id === state.activeChatId);
      els.messagesContainer.innerHTML = '';

      if (!chat || chat.messages.length === 0) {
        els.messagesContainer.innerHTML = getWelcomeScreenHtml();
        refreshIcons();
        return;
      }

      chat.messages.forEach((m, i) => {
        const r = createMessageBubble(m.role, m.content, m.filesSummary, m.imagesCount, i);
        if (m.sources) renderSources(r, m.sources);
        if (m.role === 'assistant' && m.suggestions && i === chat.messages.length - 1) renderSuggestions(r, m.suggestions);
        if (m.role === 'assistant' && Number.isFinite(m.elapsedMs)) {
          const note = r.querySelector('.msg-fallback-note');
          if (note) note.textContent = engineNoteText(m);
        }
        if (m.role === 'assistant' && m.feedback) paintFeedback(r, m.feedback);
        if (m.role === 'assistant' && m.isLimit) renderLimitCard(r, m, i === chat.messages.length - 1);
      });
      els.messagesContainer.scrollTop = els.messagesContainer.scrollHeight;
      refreshIcons();
    }

    const msgTextStore = new WeakMap();
    function formatElapsedTime(ms) {
      const totalSeconds = Math.max(0, Math.floor(ms / 1000));
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      return String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');
    }

    function createMessageBubble(role, content, filesSummary = null, imagesCount = 0, msgIndex = -1) {
      const row = document.createElement('div');
      row.className = `msg-row max-w-4xl mx-auto flex gap-3.5 ${role === 'user' ? 'justify-end items-start' : 'justify-start'}`;
      if (msgIndex >= 0) row.dataset.idx = String(msgIndex);

      if (role === 'user') {
        const badgeImg = imagesCount > 0 ? `<div class="mb-1.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-700/40 text-blue-50 text-[11px] font-mono"><i data-lucide="image" class="w-3 h-3"></i>${imagesCount} Adet Fotoğraf Eklendi</div><br>` : '';
        const badgeFiles = filesSummary ? `<div class="mb-1.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-700/40 text-indigo-50 text-[11px] font-mono"><i data-lucide="files" class="w-3 h-3"></i>${escapeHtml(filesSummary)}</div><br>` : '';
        row.innerHTML = `
          <button type="button" data-action="edit" class="mt-2 p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer shrink-0" title="Soruyu düzenle">
            <i data-lucide="pencil" class="w-3.5 h-3.5"></i>
          </button>
          <div class="msg-user-bubble bg-blue-600 text-white px-4 py-3 rounded-2xl rounded-tr-xs max-w-[85%] text-base shadow-xs leading-relaxed whitespace-pre-wrap">${badgeImg}${badgeFiles}${escapeHtml(content)}</div>
        `;
      } else {
        msgTextStore.set(row, content || '');
        row.innerHTML = `
          <div class="forge-avatar w-8 h-8 rounded-xl bg-[#0F1629] border border-slate-700/40 flex items-center justify-center text-white shadow-2xs shrink-0 mt-0.5">
            <span data-forge-logo class="block w-[19px] h-[19px]"></span>
          </div>
          <div class="flex-1 min-w-0 pt-1">
            <div class="prose max-w-none">${content ? parseMarkdownSafe(content) : '<details class="forge-progress not-prose py-1" aria-live="polite"><summary class="fm-psum"><span class="fm-spin" aria-hidden="true"></span><span data-progress-label class="fm-dots">Düşünülüyor</span><span data-elapsed-time class="fm-ptime">00:00</span><svg class="fm-chev" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></summary><div class="fm-pbody"><p data-progress-detail class="text-sm font-medium text-slate-600 mb-2">Oforge AI isteğinizi hazırlıyor…</p><ol class="space-y-1.5 text-sm text-slate-500"><li data-progress-step="0" class="flex items-center gap-2"><span data-progress-mark class="w-4 text-center text-blue-600">●</span><span>Mesajı ve sohbet bağlamını hazırlıyorum</span></li><li data-progress-step="1" class="flex items-center gap-2"><span data-progress-mark class="w-4 text-center">○</span><span>Sohbet geçmişi ve ekleri kontrol ediyorum</span></li><li data-progress-step="2" class="flex items-center gap-2"><span data-progress-mark class="w-4 text-center">○</span><span>Oforge AI isteğiniz için uygun motoru seçiyor</span></li><li data-progress-step="3" class="flex items-center gap-2"><span data-progress-mark class="w-4 text-center">○</span><span>Oforge AI hizmetine bağlanıyor</span></li><li data-progress-step="4" class="flex items-center gap-2"><span data-progress-mark class="w-4 text-center">○</span><span>Oforge AI yanıtınızı oluşturuyor</span></li></ol></div></details>'}</div>
            <div class="msg-actions -ml-2 mt-2 flex flex-wrap items-center gap-0.5 text-slate-400 ${content ? '' : 'hidden'}">${msgActionsHtml()}</div>
            <p class="msg-disclaimer mt-1 text-[11px] text-slate-400 ${content ? '' : 'hidden'}"><span>Yapay zekâ hata yapabilir; önemli bilgileri doğrulayın.</span><span class="msg-fallback-note"></span></p>
          </div>
        `;
        if (content) {
          enhanceRenderedContent(row.querySelector('.prose'));
        }
      }
      els.messagesContainer.appendChild(row);
      return row;
    }

    function escapeHtml(str) {
      if (!str) return '';
      const div = document.createElement('div');
      div.textContent = str;
      return div.innerHTML;
    }

    async function sendMessage(e) {
      if (e) e.preventDefault();
      let text = els.userInput.value.trim();
      const hasFiles = state.attachedFiles.length > 0 || state.attachedImages.length > 0;
      if (!text && !hasFiles) return;
      if (state.isGenerating) return;

      if (!keyOk()) {
        els.settingsModal.classList.remove('hidden');
        return;
      }

      if (!text && state.attachedImages.length > 0) {
        text = 'Eklediğim fotoğrafları ışık, renk dengesi ve kompozisyon açısından analiz et.';
      } else if (!text && state.attachedFiles.length > 0) {
        text = 'Eklediğim belgeleri incele, aralarındaki ilişkileri karşılaştır ve kapsamlı bir özet sun.';
      }

      if (!state.activeChatId) {
        const titleSource = text || state.attachedFiles[0]?.name || state.attachedImages[0]?.name || 'Çoklu Belge Çalışması';
        const newChat = { id: Date.now().toString(), title: titleSource.slice(0, 40), messages: [] };
        state.chats.unshift(newChat);
        state.activeChatId = newChat.id;
      }

      const currentChat = state.chats.find(c => c.id === state.activeChatId);
      if (currentChat.messages.length === 0) {
        currentChat.title = (text || state.attachedFiles[0]?.name || state.attachedImages[0]?.name).slice(0, 40);
      }

      let apiTextPayload = text;
      const imagesPayload = [...state.attachedImages];
      const filesPayload = [...state.attachedFiles];

      filesPayload.forEach(f => {
        if (f.type === 'text') {
          apiTextPayload += `\n\n--- Belge: ${f.name} ---\n\`\`\`\n${f.content}\n\`\`\``;
        }
      });

      const filesSummaryText = filesPayload.length > 0 ? `${filesPayload.length} Adet Belge Eklendi (${filesPayload.map(f=>f.name).join(', ')})` : null;

      const msgId = 'm_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
      const hasAttach = imagesPayload.length > 0 || filesPayload.length > 0;
      // put() asla reject etmez (hata olursa bellek yedeğine düşer)
      const attachSave = hasAttach
        ? AttachDB.put({ id: msgId, apiText: apiTextPayload, images: imagesPayload, pdfs: filesPayload.filter(f => f.type === 'pdf') })
        : Promise.resolve();

      currentChat.messages.push({
        id: msgId,
        role: 'user',
        content: text,
        apiText: hasAttach ? undefined : apiTextPayload,
        filesSummary: filesSummaryText,
        imagesCount: imagesPayload.length,
        hasAttach
      });
      
      els.userInput.value = '';
      els.userInput.style.height = 'auto';
      els.slashMenu.classList.add('hidden');
      clearAllAttachments();
      syncStorage();
      renderChatList();
      renderMessages();

      await generateReply(currentChat, attachSave);
    }

    // ===== Motor mantığı engines/ klasörüne taşındı; burada yalnızca ekranda gösterilen not metni kalır =====
    function engineNoteText(m) {
      return Number.isFinite(m.elapsedMs) ? ' · ' + (m.webSearch ? 'Web araması + yanıt' : 'Yanıt süresi') + ': ' + formatElapsedTime(m.elapsedMs) : '';
    }

    // ===== Alternatif yönlendirme: yanıtın sonundaki [[ONERI]] bloğu düğmelere çevrilir, metinden çıkarılır =====
    const SUGGEST_RE = new RegExp('\\n*' + SUGGEST_OPEN.replace(/[[\]]/g, '\\$&') + '([\\s\\S]*?)(?:' + SUGGEST_CLOSE.replace(/[[\]\/]/g, '\\$&') + '|$)');
    function splitSuggestions(text) {
      const src = String(text || '');
      const m = SUGGEST_RE.exec(src);
      if (!m) return { text: src, list: [] };
      const list = m[1].split('\n').map(l => l.replace(/^\s*(?:[-*\u2022]|\d+[.)])\s*/, '').replace(/^["\u201c\u201d]|["\u201c\u201d]$/g, '').trim()).filter(l => l.length > 2 && l.length <= 100).slice(0, 3);
      return { text: src.slice(0, m.index).trimEnd(), list };
    }
    // Akış sırasında henüz tamamlanmamış öneri bloğunu da gizler.
    function hideSuggestions(text) {
      const t = String(text || ''), i = t.indexOf('[[O');
      return i >= 0 ? t.slice(0, i).trimEnd() : t.replace(/\n*\[{1,2}(?:O(?:N(?:E(?:R(?:I)?)?)?)?)?$/, '');
    }
    const SG_ARROW = '<svg class="fm-sg-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 10 5 5-5 5"/><path d="M4 4v7a4 4 0 0 0 4 4h12"/></svg>';
    function renderSuggestions(row, list) {
      if (!row) return;
      const old = row.querySelector('.msg-suggest'); if (old) old.remove();
      if (!Array.isArray(list) || !list.length) return;
      const box = document.createElement('div');
      box.className = 'msg-suggest';
      list.forEach((t) => {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'fm-sg';
        const lbl = document.createElement('span'); lbl.textContent = t;
        b.appendChild(lbl);
        b.insertAdjacentHTML('beforeend', SG_ARROW);
        b.onclick = () => { if (state.isGenerating) return; els.userInput.value = t; els.chatForm.requestSubmit(); };
        box.appendChild(b);
      });
      const d = row.querySelector('.msg-disclaimer');
      if (d) d.parentNode.insertBefore(box, d); else row.appendChild(box);
    }

    async function generateReply(currentChat, attachSave) {
      state.isGenerating = true;
      document.documentElement.classList.add('forge-busy');
      state.abortController = new AbortController();
      els.sendBtn.classList.add('hidden');
      els.stopBtn.classList.remove('hidden');

      const aiMsg = { role: 'assistant', content: '' };
      currentChat.messages.push(aiMsg);
      const bubble = createMessageBubble('assistant', '');
      bubble.dataset.idx = String(currentChat.messages.indexOf(aiMsg));
      state.autoStick = true;
      refreshIcons();
      const liveAvatar = bubble.querySelector('.forge-avatar');
      if (liveAvatar) liveAvatar.classList.add('fm-hot');
      const proseEl = bubble.querySelector('.prose');
      if (proseEl) proseEl.classList.add('is-streaming');
      bubble.classList.add('fm-enter');
      const actionsEl = bubble.querySelector('.msg-actions');
      const progressEl = bubble.querySelector('.forge-progress');
      const generationStartedAt = Date.now();
      let elapsedMs = 0;
      const elapsedEl = progressEl && progressEl.querySelector('[data-elapsed-time]');
      const updateElapsedTime = () => {
        elapsedMs = Date.now() - generationStartedAt;
        if (elapsedEl) elapsedEl.textContent = 'Geçen süre: ' + formatElapsedTime(elapsedMs);
      };
      updateElapsedTime();
      const elapsedTimer = setInterval(updateElapsedTime, 1000);
      let progressStep = 0;
      const updateProgress = (step, detail) => {
        if (!progressEl) return;
        progressStep = Math.max(progressStep, step);
        const detailEl = progressEl.querySelector('[data-progress-detail]');
        if (detailEl && detail) detailEl.textContent = detail;
        const labelEl = progressEl.querySelector('[data-progress-label]');
        if (labelEl) labelEl.textContent = progressStep >= 4 ? 'Yanıt yazılıyor' : 'Düşünülüyor';
        progressEl.querySelectorAll('[data-progress-step]').forEach((item) => {
          const index = Number(item.dataset.progressStep);
          const mark = item.querySelector('[data-progress-mark]');
          const done = index < progressStep;
          const active = index === progressStep;
          item.className = 'flex items-center gap-2 ' + (done ? 'text-emerald-700' : active ? 'text-blue-700 font-semibold' : 'text-slate-400');
          if (mark) mark.textContent = done ? '✓' : active ? '●' : '○';
        });
      };

      try {
        updateProgress(0, 'Oforge AI isteğinizi hazırlıyor…');
        await attachSave;
        updateProgress(1, 'Sohbet geçmişi ve ekleri kontrol ediliyor…');
        const hist = [];
        for (const m of currentChat.messages.slice(0, -1)) {
          const rec = m.hasAttach ? await AttachDB.get(m.id) : null;
          const msgText = (rec && rec.apiText) || m.apiText || m.content;
          const images = (rec && Array.isArray(rec.images)) ? rec.images : [];
          const pdfs = (rec && Array.isArray(rec.pdfs)) ? rec.pdfs : [];
          if (!msgText && !images.length && !pdfs.length) continue;
          hist.push({ role: m.role, msgText, images, pdfs });
        }

        const sel = curModel();
        if (navigator.onLine === false) throw mkErr('network', 'İnternet bağlantısı yok.');
        const { candidates, reqType } = planRequest({ selected: sel, hist, creds: engineCreds() });

        // Akış ekrana kare başına en fazla bir kez yansıtılır.
        let renderQueued = false, streamDone = false;
        const flushRender = (force) => {
          renderQueued = false;
          if (streamDone && force !== true) return;   // bekleyen kare, son (zenginleştirilmiş) görünümün üzerine yazmasın
          proseEl.innerHTML = parseMarkdownSafe(hideSuggestions(aiMsg.content));
          if (state.autoStick !== false) els.messagesContainer.scrollTop = els.messagesContainer.scrollHeight;
        };
        const scheduleRender = () => {
          if (!renderQueued) { renderQueued = true; requestAnimationFrame(() => flushRender()); }
        };

        const r = await runWithFallback({
          candidates, hist,
          systemText: buildSystemText(state.systemPrompt, currentUser),
          webOn: storage.get(KEYS.WEB) === '1' || reqType === 'academic',
          creds: { apiKey: state.apiKey, getIdToken },
          signal: state.abortController.signal,
          hooks: {
            onAttemptStart: () => { aiMsg.content = ''; },
            onStage: (stage, info) => {
              if (stage === 'prepare') updateProgress(2, info.media ? 'Sohbeti ve eklenen görsel/PDF dosyalarını hazırlıyorum…' : 'Sohbet geçmişini ve talimatları hazırlıyorum…');
              else if (stage === 'connect') updateProgress(3, 'Oforge AI uygun yanıtı hazırlamak için bağlantı kuruyor…');
              else if (stage === 'stream') updateProgress(4, 'Oforge AI yanıtınızı hazırlıyor…');
              else if (stage === 'switch') updateProgress(3, 'Yanıt için yedek model deneniyor…');
            },
            onText: (piece) => {
              if (progressEl) progressEl.querySelector('[data-progress-detail]').textContent = 'Oforge AI yanıtınızı yazıyor…';
              aiMsg.content += piece;
              scheduleRender();
            }
          }
        });
        aiMsg.engine = r.model.label;

        updateElapsedTime();
        clearInterval(elapsedTimer);
        aiMsg.elapsedMs = elapsedMs;
        aiMsg.webSearch = storage.get(KEYS.WEB) === '1' || reqType === 'academic';
        if (progressEl) progressEl.remove();
        { const sp = splitSuggestions(aiMsg.content); aiMsg.content = sp.text; aiMsg.suggestions = sp.list; }
        streamDone = true;
        flushRender(true);
        if (r.sources.length) aiMsg.sources = r.sources;
        if (r.finishReason === 'MAX_TOKENS') {
          aiMsg.content += '\n\n*(Yanıt uzunluk sınırında kesildi. "Devam et" yazarak sürdürebilirsiniz.)*';
          flushRender(true);
        }

        enhanceRenderedContent(proseEl);

        msgTextStore.set(bubble, aiMsg.content);
        actionsEl.innerHTML = msgActionsHtml();
        actionsEl.classList.remove('hidden');
        clearLimitState();
        const discEl = bubble.querySelector('.msg-disclaimer');
        if (discEl) {
          discEl.classList.remove('hidden');
          const note = discEl.querySelector('.msg-fallback-note');
          if (note) note.textContent = engineNoteText(aiMsg);
          renderSources(bubble, aiMsg.sources);
        }
        renderSuggestions(bubble, aiMsg.suggestions);
        syncStorage();

        if (window.ForgeSound) ForgeSound.complete();
        if (window.ForgeNotify) ForgeNotify.done(currentChat.title, elapsedMs, aiMsg.content);
        const htmlMatch = aiMsg.content.match(/```html\s*([\s\S]*?)```/i);
        if (htmlMatch && htmlMatch[1]) {
          openArtifactPreview({
            title: 'Canlı Web Çalışması Önizlemesi',
            type: 'html',
            content: htmlMatch[1].trim(),
            lang: 'html',
            ext: 'html'
          });
        }

      } catch (err) {
        updateElapsedTime();
        aiMsg.elapsedMs = elapsedMs;
        aiMsg.webSearch = storage.get(KEYS.WEB) === '1';
        if (err.name === 'AbortError') {
          aiMsg.content += '\n\n*(İşlem kullanıcı tarafından durduruldu.)*';
        } else if (err.quota) {
          applyLimitToMessage(aiMsg, err.quota);
          saveLimitState(err.quota);
        } else {
          aiMsg.content = formatFailure(err);
        }
        if (!aiMsg.isLimit) aiMsg.content += `\n\n*İşlem süresi: ${formatElapsedTime(elapsedMs)}*`;
        if (progressEl) progressEl.remove();
        if (aiMsg.isLimit) renderLimitCard(bubble, aiMsg, true);
        else proseEl.innerHTML = parseMarkdownSafe(aiMsg.content);
        syncStorage();
      } finally {
        clearInterval(elapsedTimer);
        state.isGenerating = false;
        document.documentElement.classList.remove('forge-busy');
        if (liveAvatar) liveAvatar.classList.remove('fm-hot');
        if (proseEl) proseEl.classList.remove('is-streaming');
        state.abortController = null;
        els.stopBtn.classList.add('hidden');
        els.sendBtn.classList.remove('hidden');
      }
    }

    document.getElementById('newChatBtn').onclick = () => {
      if (state.isGenerating && state.abortController) {
        state.abortController.abort();
      }
      state.activeChatId = null;
      clearAllAttachments();
      els.userInput.value = '';
      els.userInput.style.height = 'auto';
      els.previewPane.classList.add('hidden');
      renderChatList(els.searchChatsInput.value);
      renderMessages();
      toggleSidebar(false);
      els.userInput.focus();
    };

    document.getElementById('backupJsonBtn').onclick = () => {
      const dataStr = JSON.stringify(state.chats, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `OforgeAI-Yedek-${new Date().toISOString().slice(0,10)}.json`;
      a.click();
    };

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.lang = 'tr-TR';
      recognition.interimResults = false;

      document.getElementById('micBtn').onclick = () => {
        recognition.start();
        document.getElementById('micLabel').textContent = 'Dinleniyor...';
        document.getElementById('micBtn').classList.add('text-rose-600', 'bg-rose-50');
      };

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        els.userInput.value += (els.userInput.value ? ' ' : '') + transcript;
        els.userInput.dispatchEvent(new Event('input'));
      };

      recognition.onend = () => {
        document.getElementById('micLabel').textContent = 'Sesli';
        document.getElementById('micBtn').classList.remove('text-rose-600', 'bg-rose-50');
      };
    } else {
      document.getElementById('micBtn').classList.add('hidden');
    }

    els.chatForm.onsubmit = sendMessage;

    els.messagesContainer.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]');
      if (!btn) return;
      const row = btn.closest('.msg-row');
      const text = row ? (msgTextStore.get(row) || '') : '';
      const action = btn.dataset.action;
      if (action === 'edit') startEditMessage(row);
      else if (action === 'preview') window.previewFullResponse(text);
      else if (action === 'copy') window.copyRawText(btn, text);
      else if (action === 'speak') window.speakText(text);
      else if (action === 'more') openSharePopover(btn, text);
      else if (action === 'like') toggleFeedback(row, 'up');
      else if (action === 'dislike') toggleFeedback(row, 'down');
      else if (action === 'limit-retry') retryAfterLimit(row);
      else if (action === 'limit-settings') els.settingsModal.classList.remove('hidden');
    });
    // --- SORUYU DÜZENLE & YENİDEN GÖNDER ---
    function startEditMessage(row) {
      if (!row || row.querySelector('.edit-box')) return;
      if (state.isGenerating) {
        forgeDialog('Yanıt sürerken soru düzenlenemez. Önce "Durdur" düğmesine basın.');
        return;
      }
      const chat = state.chats.find(c => c.id === state.activeChatId);
      const idx = parseInt(row.dataset.idx, 10);
      const msg = chat && chat.messages[idx];
      if (!msg || msg.role !== 'user') return;

      const bubble = row.querySelector('.msg-user-bubble');
      const editBtn = row.querySelector('button[data-action="edit"]');
      if (editBtn) editBtn.classList.add('hidden');
      bubble.classList.add('hidden');

      const box = document.createElement('div');
      box.className = 'edit-box w-full max-w-[85%] bg-white border border-blue-300 ring-4 ring-blue-500/10 rounded-2xl p-3 shadow-xs';
      box.innerHTML =
        '<textarea rows="3" class="w-full text-sm sm:text-[15px] text-slate-900 leading-relaxed resize-none focus:outline-none bg-transparent"></textarea>' +
        (msg.hasAttach ? '<div class="text-[11px] text-slate-400 mt-1">Ekli dosyalar korunur.</div>' : '') +
        '<div class="flex justify-end gap-2 mt-2">' +
          '<button type="button" class="edit-cancel px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition cursor-pointer">İptal</button>' +
          '<button type="button" class="edit-save px-3 py-1.5 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 transition cursor-pointer">Kaydet ve Gönder</button>' +
        '</div>';
      row.appendChild(box);
      const ta = box.querySelector('textarea');
      ta.value = msg.content;
      const fit = () => { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 260) + 'px'; };
      ta.addEventListener('input', fit);
      fit();
      ta.focus();
      ta.setSelectionRange(ta.value.length, ta.value.length);

      const cancel = () => renderMessages();
      box.querySelector('.edit-cancel').onclick = cancel;
      box.querySelector('.edit-save').onclick = () => submitEditedMessage(idx, ta.value.trim());
      ta.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') { e.preventDefault(); cancel(); }
        else if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitEditedMessage(idx, ta.value.trim()); }
      });
    }

    async function submitEditedMessage(idx, newText) {
      if (state.isGenerating) return;
      const chat = state.chats.find(c => c.id === state.activeChatId);
      const msg = chat && chat.messages[idx];
      if (!msg || msg.role !== 'user') return;
      if (!newText) { forgeDialog('Soru boş olamaz.'); return; }
      if (!keyOk()) { els.settingsModal.classList.remove('hidden'); return; }

      // Metin değişmediyse yine de aynı soruya yeni yanıt üretilir (yeniden dene)
      const oldText = msg.content;
      let attachSave = Promise.resolve();
      if (msg.hasAttach) {
        // Ek metni (belge içerikleri) korunur; yalnızca sorunun kendisi değişir
        attachSave = (async () => {
          const rec = await AttachDB.get(msg.id);
          if (rec) {
            const base = (rec.apiText || '');
            rec.apiText = base.startsWith(oldText) ? newText + base.slice(oldText.length) : newText + '\n\n' + base;
            await AttachDB.put(rec);
          }
        })();
      } else {
        msg.apiText = newText;
      }
      msg.content = newText;
      if (idx === 0) chat.title = newText.slice(0, 40);

      // Bu sorudan sonraki tüm mesajlar (ve eklentileri) silinir
      chat.messages.slice(idx + 1).forEach(m => { if (m.hasAttach) AttachDB.del(m.id); });
      chat.messages.length = idx + 1;

      syncStorage();
      renderChatList(els.searchChatsInput.value);
      renderMessages();
      await generateReply(chat, attachSave);
    }

    els.stopBtn.onclick = () => state.abortController && state.abortController.abort();

    els.userInput.addEventListener('input', function() {
      this.style.height = 'auto';
      this.style.height = this.scrollHeight + 'px';
      if (this.value.trim() === '/') {
        els.slashMenu.classList.remove('hidden');
      } else {
        els.slashMenu.classList.add('hidden');
      }
    });

    els.userInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    els.searchChatsInput.oninput = (e) => renderChatList(e.target.value);

    document.getElementById('exportChatBtn').onclick = () => {
      const chat = state.chats.find(c => c.id === state.activeChatId);
      if (!chat || chat.messages.length === 0) return;
      let md = `# Oforge AI Çalışma Kaydı: ${chat.title}\n*Kaynak: ozgulerforge.com.tr*\n\n---\n\n`;
      chat.messages.forEach(m => {
        md += `### ${m.role === 'user' ? 'Kullanıcı' : 'Oforge AI'}\n${m.content}\n\n`;
      });
      const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `OforgeAI-${chat.id}.md`;
      a.click();
    };

    document.getElementById('openSettingsBtn').onclick = () => {
      els.apiKeyInput.value = state.apiKey;
      els.systemPromptInput.value = state.systemPrompt;
      els.settingsModal.classList.remove('hidden');
    };
    document.getElementById('closeSettingsBtn').onclick = () => els.settingsModal.classList.add('hidden');
    document.getElementById('cancelSettingsBtn').onclick = () => els.settingsModal.classList.add('hidden');

    document.getElementById('saveSettingsBtn').onclick = () => {
      state.apiKey = els.apiKeyInput.value.trim();
      storage.remove(KEYS.OR_API);   // OpenRouter kaldırıldı; eski kayıtlı anahtar silinir
      state.systemPrompt = els.systemPromptInput.value.trim() || BASE_IDENTITY;
      storage.set(KEYS.API, state.apiKey);
      storage.set(KEYS.SYSTEM, state.systemPrompt);
      Health.clearAll();
      updateApiBadge();
      
      const warningEl = document.getElementById('noKeyWarning');
      if (warningEl) warningEl.classList.add('hidden');
      renderMessages();

      els.settingsModal.classList.add('hidden');
    };

    document.getElementById('openAboutBtn').onclick = () => els.aboutModal.classList.remove('hidden');
    document.getElementById('closeAboutBtn').onclick = () => els.aboutModal.classList.add('hidden');
    document.getElementById('okAboutBtn').onclick = () => els.aboutModal.classList.add('hidden');

    const LEGAL_TEXTS = {
      usage: {
        title: 'Kullanım Politikası',
        sections: [
          ['Kabul edilebilir kullanım', 'Oforge AI; hukuka uygun, güvenli ve başkalarının haklarına saygılı amaçlarla kullanılmalıdır. Hizmeti yasa dışı faaliyet, zararlı yazılım, dolandırıcılık, taciz veya güvenlik önlemlerini aşma amacıyla kullanmayın.'],
          ['İçerik ve ekler', 'Yüklediğiniz metin, görsel ve belgeleri kullanma yetkiniz olmalıdır. Başkasına ait kişisel, gizli veya telif korumalı bilgileri gerekli izin ve hukuki dayanak olmadan paylaşmayın.'],
          ['Yapay zekâ çıktıları', 'Yanıtlar otomatik oluşturulur; hatalı, eksik veya güncel olmayan bilgi içerebilir. Önemli kararlar öncesinde çıktıları bağımsız kaynaklardan doğrulayın.']
        ]
      },
      privacy: {
        title: 'Gizlilik ve KVKK Bilgilendirmesi',
        sections: [
          ['Veri sorumlusu ve iletişim', 'Bu taslakta veri sorumlusu Ozguler Forge olarak belirtilmiştir. Gizlilik ve kişisel veri talepleri için iletisim@ozgulerforge.com.tr adresi kullanılabilir. Yayımdan önce veri sorumlusunun tam ticari unvanı ve iletişim bilgileri doğrulanmalıdır.'],
          ['İşlenen bilgiler ve amaçlar', 'Sohbet mesajları, eklediğiniz metin/görsel/belgeler, uygulama tercihleri ve API anahtarınız işlevleri sunmak ve sohbetleri saklamak amacıyla işlenebilir. API anahtarı bu uygulamada tarayıcınızın yerel depolamasında tutulur. Sohbetler ve ekler cihazınızda saklanır; ek dosyalar IndexedDB içinde tutulabilir.'],
          ['Üçüncü taraf hizmetler ve aktarım', 'Yanıt üretmek için mesajlarınız, ekleriniz ve isteğe bağlı web araması Google Gemini hizmetine gönderilir. Google ile giriş/bulut eşitleme özelliklerini kullanırsanız kimlik ve sohbet verileri ilgili Google/Firebase altyapısına aktarılabilir; ek dosyalar bulut eşitlemesine dahil edilmez. Üçüncü tarafların kendi şart ve gizlilik bildirimleri de geçerlidir.'],
          ['Saklama, silme ve başvuru', 'Sohbetler siz silene veya tarayıcı verilerini temizleyene kadar cihazınızda kalabilir. Bulut eşitleme açıksa bulut kopyalarının silinmesi de uygulama üzerinden yapılmalıdır. 6698 sayılı KVKK kapsamındaki başvurularınızı yukarıdaki e-posta adresine iletebilirsiniz; bu metin tek başına aydınlatma yükümlülüğünün yerine geçtiği anlamına gelmez.']
        ]
      },
      terms: {
        title: 'Hizmet Şartları',
        sections: [
          ['Hizmetin kapsamı', 'Oforge AI; metin, görsel ve belge girdileriyle yapay zekâ yanıtı üretir. Hizmet ve özellikler zaman içinde değiştirilebilir, sınırlandırılabilir veya durdurulabilir.'],
          ['Kullanıcı sorumlulukları', 'Hesap ve API anahtarlarınızın güvenliğinden, paylaştığınız içerik üzerindeki haklardan ve oluşturulan çıktıları kullanmadan önce doğrulamaktan siz sorumlusunuz. API anahtarınızı herkese açık veya güvenilmeyen cihazlarda kullanmayın.'],
          ['Garanti ve sorumluluk sınırı', 'Hizmet “olduğu gibi” sunulur. Kesintisiz çalışma, çıktının doğruluğu veya belirli bir amaca uygunluğu garanti edilmez. Yapay zekâ çıktıları profesyonel hukuk, sağlık, mali veya benzeri danışmanlık yerine geçmez. Kanunen sınırlandırılamayan sorumluluklar saklıdır.'],
          ['Fikri haklar', 'Kullanıcı, yüklediği içerik için gerekli hak ve izinlere sahip olduğunu kabul eder. Çıktıların benzersizliği veya üçüncü kişilerin haklarını ihlal etmediği garanti edilmez; kullanım öncesi gerekli kontroller kullanıcıya aittir.']
        ]
      },
      licenses: {
        title: 'Yazılım Lisansları ve Bildirimler',
        sections: [
          ['Açık kaynak bileşenler', 'Uygulama; Tailwind CSS (MIT), Lucide ikonları (ISC), Marked (MIT), DOMPurify (Apache-2.0/MPL-2.0), highlight.js (BSD-3-Clause), Firebase JavaScript SDK (Apache-2.0), Plus Jakarta Sans ve JetBrains Mono yazı tipleri (SIL Open Font License) gibi üçüncü taraf bileşenler kullanır. Bileşenlerin kendi lisans ve bildirimleri geçerlidir.'],
          ['Harici platform ve servisler', 'Google Identity Services, Google Gemini API, Google Fonts ve CDN üzerinden yüklenen kütüphaneler ilgili sağlayıcıların şartlarına tabidir. Bu bildirim, üçüncü tarafların marka veya hizmetleri üzerinde hak iddiası oluşturmaz.'],
          ['Lisans metinleri', 'Dağıtım yaparken kullanılan sürümlerin lisans dosyalarını ve gerekli bildirimleri ilgili upstream projelerden doğrulayın; bu özet resmi lisans metinlerinin yerine geçmez.']
        ]
      }
    };
    const legalToggleBtn = document.getElementById('legalToggleBtn');
    const legalSubmenu = document.getElementById('legalSubmenu');
    legalToggleBtn.onclick = () => {
      const open = legalSubmenu.classList.toggle('hidden') === false;
      legalToggleBtn.setAttribute('aria-expanded', String(open));
    };
    document.querySelectorAll('[data-legal]').forEach((button) => {
      button.onclick = () => {
        const doc = LEGAL_TEXTS[button.dataset.legal];
        if (!doc) return;
        document.getElementById('legalTitle').textContent = doc.title;
        const body = document.getElementById('legalContent');
        body.replaceChildren();
        doc.sections.forEach(([heading, text]) => {
          const section = document.createElement('section');
          section.className = 'space-y-1';
          const h = document.createElement('h4'); h.className = 'font-semibold text-slate-900'; h.textContent = heading;
          const p = document.createElement('p'); p.textContent = text;
          section.append(h, p); body.appendChild(section);
        });
        els.legalModal.classList.remove('hidden');
        refreshIcons();
      };
    });
    const closeLegalModal = () => els.legalModal.classList.add('hidden');
    document.getElementById('closeLegalBtn').onclick = closeLegalModal;
    document.getElementById('okLegalBtn').onclick = closeLegalModal;
    els.legalModal.addEventListener('click', (e) => { if (e.target === els.legalModal) closeLegalModal(); });




    // --- SES KİMLİĞİ: "Tamamlandı" sesi (Web Audio ile üretilir, dosya gerekmez) ---
    window.ForgeSound = (function () {
            let ctx = null;
      const enabled = () => storage.get(KEYS.SOUND) !== '0';
      function ensure() {
        if (!ctx) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null; ctx = new AC(); }
        if (ctx.state === 'suspended') ctx.resume();
        return ctx;
      }
      function tone(c, t, freq, dur, gain, dest) {
        const o = c.createOscillator(), h = c.createOscillator(), g = c.createGain(), hg = c.createGain();
        o.type = 'sine'; o.frequency.setValueAtTime(freq, t);
        h.type = 'triangle'; h.frequency.setValueAtTime(freq * 2, t); hg.gain.value = 0.16;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g); h.connect(hg); hg.connect(g); g.connect(dest);
        o.start(t); h.start(t); o.stop(t + dur + 0.05); h.stop(t + dur + 0.05);
      }
      function complete(force) {
        if (!force && !enabled()) return;
        const c = ensure(); if (!c) return;
        const t = c.currentTime + 0.02;
        const master = c.createGain(); master.gain.value = 0.5;
        const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 5200;
        const dl = c.createDelay(); dl.delayTime.value = 0.14;
        const fb = c.createGain(); fb.gain.value = 0.27;
        const wet = c.createGain(); wet.gain.value = 0.32;
        master.connect(lp); lp.connect(c.destination);
        lp.connect(dl); dl.connect(fb); fb.connect(dl); dl.connect(wet); wet.connect(c.destination);
        tone(c, t, 3136, 0.05, 0.06, master);          // örse çekiç vuruşu: kısa metalik "tık"
        tone(c, t + 0.03, 783.99, 0.55, 0.22, master); // G5
        tone(c, t + 0.12, 1174.66, 0.8, 0.2, master);  // D6 (saf beşli, yukarı)
        tone(c, t + 0.12, 2349.32, 0.5, 0.035, master);// hafif parıltı
        setTimeout(() => { try { master.disconnect(); lp.disconnect(); dl.disconnect(); fb.disconnect(); wet.disconnect(); } catch (_) {} }, 2500);
      }
      const unlock = () => { ensure(); };
      ['pointerdown', 'keydown'].forEach((ev) => window.addEventListener(ev, unlock, { once: true, passive: true }));
      return { complete, enabled, setEnabled: (v) => { storage.set(KEYS.SOUND, v ? '1' : '0'); } };
    })();
    (function initSoundToggle() {
      const btn = document.getElementById('soundToggleBtn');
      const paint = () => {
        const on = ForgeSound.enabled();
        btn.setAttribute('aria-checked', String(on));
        document.getElementById('soundState').textContent = on ? 'Açık' : 'Kapalı';
        btn.querySelectorAll('.snd-on').forEach((e) => e.classList.toggle('hidden', !on));
        btn.querySelectorAll('.snd-off').forEach((e) => e.classList.toggle('hidden', on));
      };
      btn.onclick = () => { const on = !ForgeSound.enabled(); ForgeSound.setEnabled(on); paint(); refreshIcons(); if (on) ForgeSound.complete(true); };
      paint();
    })();

    // --- TANITIM TURU: "Bir proje seç, kodunu okuyayım, mimari özet çıkaralım" ---
    (function initForgeTour() {
            const modal = document.getElementById('tourModal');
      const body = document.getElementById('tourBody');
      const dots = document.getElementById('tourDots');
      const logo = document.getElementById('tourLogo');
      const IGNORE_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'out', '.next', '.nuxt', '.cache', 'coverage', 'vendor', '__pycache__', '.venv', 'venv', 'env', 'target', 'bin', 'obj', '.idea', '.vscode', '.gradle', 'pods', '.dart_tool', '.turbo', '.svelte-kit', '.parcel-cache', '.pytest_cache', '.mypy_cache']);
      const TEXT_EXT = new Set('js jsx ts tsx mjs cjs json html htm css scss sass less vue svelte py rb php java kt kts swift go rs c h cpp hpp cs sql sh bash ps1 bat yml yaml toml ini cfg conf md txt xml gradle properties dart lua r scala ex exs graphql proto tf prisma'.split(' '));
      const TEXT_NAMES = new Set(['dockerfile', 'makefile', 'procfile', 'gemfile', 'rakefile', 'cmakelists.txt']);
      const SKIP_NAMES = /(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|composer\.lock|cargo\.lock|poetry\.lock|\.ds_store)$|\.min\.(js|css)$|\.map$/i;
      const LANG = { js:'JavaScript', jsx:'JavaScript', mjs:'JavaScript', cjs:'JavaScript', ts:'TypeScript', tsx:'TypeScript', py:'Python', java:'Java', kt:'Kotlin', kts:'Kotlin', swift:'Swift', go:'Go', rs:'Rust', rb:'Ruby', php:'PHP', c:'C', h:'C', cpp:'C++', hpp:'C++', cs:'C#', html:'HTML', htm:'HTML', css:'CSS', scss:'CSS', sass:'CSS', less:'CSS', vue:'Vue', svelte:'Svelte', sql:'SQL', sh:'Shell', bash:'Shell', ps1:'Shell', bat:'Shell', dart:'Dart', lua:'Lua', scala:'Scala', ex:'Elixir', exs:'Elixir' };
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      let step = 0, cancelled = false, project = null;

      const getName = () => (currentUser && currentUser.name ? String(currentUser.name).split(' ')[0] : (storage.get(KEYS.NAME) || ''));
      const kb = (n) => n < 1024 ? n + ' B' : n < 1048576 ? (n / 1024).toFixed(0) + ' KB' : (n / 1048576).toFixed(1) + ' MB';
      const redact = (t) => t
        .replace(/AIza[0-9A-Za-z_\-]{30,}/g, '[GİZLENDİ]')
        .replace(/\bsk-[A-Za-z0-9_\-]{20,}/g, '[GİZLENDİ]')
        .replace(/\bgh[pousr]_[A-Za-z0-9]{30,}/g, '[GİZLENDİ]')
        .replace(/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, '[GİZLENDİ]');
      const btn = (id, label, cls) => `<button id="${id}" type="button" class="${cls}">${label}</button>`;
      const PRIMARY = 'px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow-sm transition cursor-pointer';
      const GHOST = 'px-4 py-2.5 text-sm font-medium text-slate-500 hover:text-slate-800 rounded-xl hover:bg-slate-100 transition cursor-pointer';

      function paintLogo(mode) {
        logo.classList.remove('fm-loop', 'fm-once');
        logo.innerHTML = window.FORGE_MARK;
        if (mode) logo.classList.add('fm-' + mode);
      }
      function setDots() {
        dots.innerHTML = [0, 1, 2].map((i) => `<span class="h-1.5 rounded-full transition-all ${i === step ? 'w-6' : 'w-1.5'}" style="background:${i === step ? '#60A5FA' : '#334155'}"></span>`).join('');
      }
      function close(markDone) {
        cancelled = true;
        modal.classList.add('hidden');
        if (markDone !== false) { storage.set(KEYS.ONBOARDED, '1'); }
      }

      function render() {
        setDots();
        if (step === 0) renderWelcome();
        else if (step === 1) renderPick();
        else renderRead();
        refreshIcons();
      }

      function renderWelcome() {
        paintLogo('once');
        const name = getName();
        body.innerHTML = `
          <h2 class="text-2xl font-bold text-slate-900 tracking-tight">${name ? 'Merhaba, ' + escapeHtml(name) + '!' : 'Merhaba!'}</h2>
          <p class="mt-2 text-base text-slate-600 leading-relaxed">Ben Oforge AI. 30 saniyede gücümü göstereyim: bir proje seç, <strong>ben kodunu okuyayım</strong>, sana <strong>mimari bir özet</strong> çıkaralım.</p>
          ${name ? '' : `<label class="block mt-5 text-sm font-medium text-slate-700">Sana nasıl hitap edeyim?
            <input id="tourName" type="text" maxlength="40" autocomplete="given-name" placeholder="Adın" class="mt-1.5 w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-base text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500"></label>`}
          <div class="mt-6 flex items-center justify-between gap-3">
            ${btn('tourSkip', 'Şimdi değil', GHOST)}
            ${btn('tourNext', 'Başla', PRIMARY)}
          </div>`;
        document.getElementById('tourSkip').onclick = () => close(true);
        document.getElementById('tourNext').onclick = () => {
          const inp = document.getElementById('tourName');
          if (inp && inp.value.trim()) { storage.set(KEYS.NAME, inp.value.trim()); }
          step = 1; render();
        };
        const inp = document.getElementById('tourName'); if (inp) setTimeout(() => inp.focus(), 50);
      }

      function renderPick() {
        paintLogo(null);
        const ready = keyOk();
        const name = getName();
        body.innerHTML = `
          <h2 class="text-2xl font-bold text-slate-900 tracking-tight">${name ? escapeHtml(name) + ', b' : 'B'}ir proje seç</h2>
          <p class="mt-2 text-base text-slate-600 leading-relaxed">Klasörü cihazında okurum; yalnızca metin/kod dosyalarının özeti yanıt için Google Gemini'ye gönderilir. <strong>node_modules</strong>, <strong>.git</strong>, <strong>.env</strong> gibi klasör ve dosyalar atlanır; anahtar benzeri değerler gizlenir.</p>
          ${ready ? '' : `<div class="mt-4 p-3.5 rounded-xl bg-amber-50 border border-amber-200/80 text-sm text-amber-900">Analiz için önce <strong>Oforge AI Motor Ayarları</strong>'na API anahtarını kaydetmelisin.
            <div class="mt-2">${btn('tourOpenSettings', 'Motor Ayarları’nı aç', 'px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-lg cursor-pointer')}</div></div>`}
          <div class="mt-5 grid gap-3 ${ready ? '' : 'opacity-50 pointer-events-none'}">
            <button id="tourPickDir" type="button" class="text-left p-4 rounded-2xl border border-slate-200 hover:border-blue-400 hover:bg-blue-50 transition flex items-center gap-4 cursor-pointer">
              <span class="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0"><i data-lucide="folder-open" class="w-5 h-5"></i></span>
              <span><span class="block text-base font-semibold text-slate-900">Proje klasörü seç</span><span class="block text-sm text-slate-500 mt-0.5">Bilgisayarındaki bir kod projesini okuyayım.</span></span>
            </button>
            <button id="tourPickSelf" type="button" class="text-left p-4 rounded-2xl border border-slate-200 hover:border-blue-400 hover:bg-blue-50 transition flex items-center gap-4 cursor-pointer">
              <span class="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0"><i data-lucide="flame" class="w-5 h-5"></i></span>
              <span><span class="block text-base font-semibold text-slate-900">Oforge AI'ın kendi kodunu oku</span><span class="block text-sm text-slate-500 mt-0.5">Hazır proje yok mu? Beni kendi içimden analiz edeyim.</span></span>
            </button>
          </div>
          <div class="mt-5 flex items-center justify-between gap-3">
            ${btn('tourBack', 'Geri', GHOST)}
            <span class="text-xs text-slate-400">Seçtiğin dosyalar sohbete ek olarak eklenir.</span>
          </div>`;
        document.getElementById('tourBack').onclick = () => { step = 0; render(); };
        const os = document.getElementById('tourOpenSettings');
        if (os) os.onclick = () => { close(false); els.settingsModal.classList.remove('hidden'); };
        document.getElementById('tourPickSelf').onclick = () => { project = { name: 'forge-ai', source: { type: 'self' } }; step = 2; render(); };
        document.getElementById('tourPickDir').onclick = async () => {
          if (window.showDirectoryPicker) {
            try {
              const h = await window.showDirectoryPicker({ mode: 'read' });
              project = { name: h.name, source: { type: 'handle', handle: h } };
              step = 2; render();
            } catch (e) { if (e && e.name !== 'AbortError') pickWithInput(); }
          } else pickWithInput();
        };
      }
      function pickWithInput() {
        const inp = document.createElement('input');
        inp.type = 'file'; inp.multiple = true; inp.setAttribute('webkitdirectory', ''); inp.className = 'hidden';
        inp.onchange = () => {
          const files = Array.from(inp.files || []);
          inp.remove();
          if (!files.length) return;
          const root = ((files[0].webkitRelativePath || '').split('/')[0]) || 'proje';
          project = { name: root, source: { type: 'files', files } };
          step = 2; render();
        };
        document.body.appendChild(inp);
        inp.click();
      }

      // ---- okuma ----
      const wantedName = (name) => {
        const low = name.toLowerCase();
        if (SKIP_NAMES.test(low)) return false;
        if (low === '.env' || (low.startsWith('.env') && !low.endsWith('.example') && !low.endsWith('.sample'))) return false;
        if (TEXT_NAMES.has(low)) return true;
        const i = low.lastIndexOf('.');
        return i > -1 && TEXT_EXT.has(low.slice(i + 1));
      };
      async function collect(ui) {
        const items = []; let visited = 0, skipped = 0, truncated = false;
        const src = project.source;
        const tick = async () => { ui(visited, items.length); await sleep(0); };
        if (src.type === 'handle') {
          const walk = async (dir, prefix, depth) => {
            for await (const [name, h] of dir.entries()) {
              if (cancelled || truncated) return;
              if (h.kind === 'directory') {
                if (IGNORE_DIRS.has(name.toLowerCase()) || depth >= 8) continue;
                await walk(h, prefix + name + '/', depth + 1);
              } else {
                visited++;
                if (visited > 4000) { truncated = true; return; }
                if (!wantedName(name)) { skipped++; continue; }
                const file = await h.getFile();
                if (file.size > 400 * 1024) { skipped++; continue; }
                items.push({ path: prefix + name, size: file.size, file });
                if (visited % 15 === 0) await tick();
              }
            }
          };
          await walk(src.handle, '', 0);
        } else if (src.type === 'files') {
          for (const f of src.files) {
            if (cancelled) return { items, skipped, truncated };
            const parts = (f.webkitRelativePath || f.name).split('/');
            const rel = parts.slice(1);
            const dirs = rel.slice(0, -1);
            visited++;
            if (visited > 4000) { truncated = true; break; }
            if (dirs.some((d) => IGNORE_DIRS.has(d.toLowerCase())) || dirs.length > 8) continue;
            const name = parts[parts.length - 1];
            if (!wantedName(name) || f.size > 400 * 1024) { skipped++; continue; }
            items.push({ path: rel.join('/') || name, size: f.size, file: f });
            if (visited % 60 === 0) await tick();
          }
        } else {
          for (const n of ['README.md', 'manifest.json', 'sw.js', 'index.html']) {
            try {
              const res = await fetch('./' + n, { cache: 'no-store' });
              if (!res.ok) continue;
              const text = await res.text();
              visited++; items.push({ path: n, size: text.length, text });
              await tick();
            } catch (_) {}
          }
          if (!items.some((i) => i.path === 'index.html')) throw new Error('Kendi kodum bu adresten okunamadı (dosya olarak açılmış olabilir). Bir proje klasörü seçmeyi dene.');
        }
        return { items, skipped, truncated };
      }
      const prio = (p) => {
        const b = p.split('/').pop().toLowerCase();
        if (/^readme/.test(b)) return 0;
        if (['package.json', 'pyproject.toml', 'requirements.txt', 'go.mod', 'cargo.toml', 'pom.xml', 'build.gradle', 'composer.json', 'gemfile', 'pubspec.yaml', 'dockerfile', 'docker-compose.yml', 'docker-compose.yaml', 'manifest.json'].includes(b)) return 1;
        if (/^(index|main|app|server|manage|program|__main__)\./.test(b)) return 2;
        return 3 + Math.min(p.split('/').length, 6);
      };
      const DEPS = { react:'React', next:'Next.js', vue:'Vue', nuxt:'Nuxt', svelte:'Svelte', '@angular/core':'Angular', express:'Express', fastify:'Fastify', '@nestjs/core':'NestJS', vite:'Vite', webpack:'Webpack', tailwindcss:'Tailwind', typescript:'TypeScript', jest:'Jest', vitest:'Vitest', prisma:'Prisma', mongoose:'MongoDB', firebase:'Firebase', electron:'Electron', three:'Three.js', django:'Django', flask:'Flask', fastapi:'FastAPI', pandas:'Pandas', numpy:'NumPy', torch:'PyTorch', tensorflow:'TensorFlow' };
      function detectTech(items, texts) {
        const found = new Set();
        const pj = texts.get('package.json');
        if (pj) { try { const j = JSON.parse(pj); Object.keys(Object.assign({}, j.dependencies, j.devDependencies)).forEach((d) => { if (DEPS[d]) found.add(DEPS[d]); }); } catch (_) {} }
        ['requirements.txt', 'pyproject.toml'].forEach((f) => { const t = (texts.get(f) || '').toLowerCase(); Object.keys(DEPS).forEach((d) => { if (/^[a-z]+$/.test(d) && new RegExp('(^|[^a-z])' + d + '([^a-z]|$)').test(t)) found.add(DEPS[d]); }); });
        items.forEach((i) => { const b = i.path.toLowerCase(); if (b.endsWith('dockerfile')) found.add('Docker'); if (b.startsWith('.github/workflows')) found.add('GitHub Actions'); });
        const idx = texts.get('index.html') || '';
        if (idx.includes('cdn.tailwindcss.com')) found.add('Tailwind');
        if (idx.includes('firebasejs')) found.add('Firebase');
        if (idx.includes('generativelanguage.googleapis.com')) found.add('Gemini API');
        if (texts.has('sw.js') || idx.includes('serviceWorker')) found.add('PWA');
        return [...found];
      }

      async function renderRead() {
        paintLogo('loop');
        cancelled = false;
        const name = getName();
        body.innerHTML = `
          <h2 class="text-2xl font-bold text-slate-900 tracking-tight">${name ? escapeHtml(name) + ', k' : 'K'}odu okuyorum…</h2>
          <p id="tourStatus" class="mt-2 text-base text-slate-600">Dosyalar taranıyor</p>
          <div class="mt-5 grid grid-cols-3 gap-3 text-center">
            <div class="rounded-xl bg-slate-50 border border-slate-200/80 py-3"><div id="stFiles" class="text-xl font-bold text-slate-900 tabular-nums">0</div><div class="text-xs text-slate-500">Dosya</div></div>
            <div class="rounded-xl bg-slate-50 border border-slate-200/80 py-3"><div id="stRead" class="text-xl font-bold text-slate-900 tabular-nums">0</div><div class="text-xs text-slate-500">Okunan</div></div>
            <div class="rounded-xl bg-slate-50 border border-slate-200/80 py-3"><div id="stSize" class="text-xl font-bold text-slate-900 tabular-nums">0 B</div><div class="text-xs text-slate-500">Boyut</div></div>
          </div>
          <div id="tourChips" class="mt-4 flex flex-wrap gap-2 min-h-[2rem]"></div>
          <div class="mt-5 flex justify-start">${btn('tourCancel', 'Vazgeç', GHOST)}</div>`;
        document.getElementById('tourCancel').onclick = () => { cancelled = true; step = 1; render(); };
        const $ = (id) => document.getElementById(id);
        const status = (t) => { const e = $('tourStatus'); if (e) e.textContent = t; };
        try {
          const { items, skipped, truncated } = await collect((v, n) => { if ($('stFiles')) $('stFiles').textContent = String(n); status('Dosyalar taranıyor · ' + v + ' öğe gezildi'); });
          if (cancelled) return;
          if (!items.length) throw new Error('Bu klasörde okunabilir kod/metin dosyası bulamadım. Başka bir proje klasörü dene.');
          items.sort((a, b) => prio(a.path) - prio(b.path) || a.size - b.size || a.path.localeCompare(b.path));
          $('stFiles').textContent = String(items.length);
          status('Önemli dosyalar okunuyor');

          const isSelf = project.source.type === 'self';
          const BUDGET = isSelf ? 140000 : 180000;
          let used = 0, read = 0, bytes = 0; const blocks = []; const texts = new Map();
          for (const it of items) {
            if (cancelled) return;
            if (used >= BUDGET) break;
            let text;
            try { text = it.text != null ? it.text : await it.file.text(); } catch (_) { continue; }
            const cap = isSelf ? 90000 : (prio(it.path) <= 1 ? 9000 : 12000);
            texts.set(it.path.toLowerCase(), text);
            let t = redact(text);
            let note = '';
            if (t.length > cap) { t = t.slice(0, cap); note = ' [kırpıldı]'; }
            used += t.length; read++; bytes += it.size;
            blocks.push(`=== DOSYA: ${it.path} (${kb(it.size)})${note} ===\n${t}`);
            $('stRead').textContent = String(read); $('stSize').textContent = kb(bytes);
            if (read % 4 === 0) await sleep(0);
          }
          if (cancelled) return;

          const langCount = {};
          items.forEach((i) => { const e = i.path.split('.').pop().toLowerCase(); const l = LANG[e]; if (l) langCount[l] = (langCount[l] || 0) + 1; });
          const langs = Object.entries(langCount).sort((a, b) => b[1] - a[1]).slice(0, 4);
          const tech = detectTech(items, texts).slice(0, 8);
          const chips = langs.map(([l, n]) => `<span class="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 text-sm font-medium">${escapeHtml(l)} · ${n}</span>`)
            .concat(tech.map((t) => `<span class="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-sm font-medium">${escapeHtml(t)}</span>`)).join('');
          $('tourChips').innerHTML = chips;
          status('Yapıyı çözümlüyorum…');
          await sleep(1300);
          if (cancelled) return;

          const tree = items.map((i) => i.path).slice(0, 600).join('\n');
          const digest = `# Proje: ${project.name}\nTaranan öğe: ${items.length} okunabilir dosya${skipped ? ', ' + skipped + ' dosya atlandı' : ''}${truncated ? ' (tarama sınırına ulaşıldı)' : ''}\nOkunan: ${read}/${items.length} dosya (içerik bütçesi nedeniyle bir kısmı okunmamış veya kırpılmış olabilir)\nDiller: ${langs.map(([l, n]) => l + ' ' + n).join(', ') || '-'}\nAlgılanan teknolojiler: ${tech.join(', ') || '-'}\n\n## DOSYA AĞACI\n${tree}${items.length > 600 ? '\n… (+' + (items.length - 600) + ' dosya)' : ''}\n\n## DOSYA İÇERİKLERİ\n\n${blocks.join('\n\n')}`;

          status('Mimari özet hazırlanıyor…');
          await sleep(500);
          if (cancelled) return;
          handOff(digest);
        } catch (err) {
          if (cancelled) return;
          paintLogo(null);
          body.innerHTML = `<h2 class="text-xl font-bold text-slate-900">Okuyamadım</h2>
            <p class="mt-2 text-base text-slate-600">${escapeHtml(err && err.message ? err.message : 'Bilinmeyen hata')}</p>
            <div class="mt-5 flex justify-between">${btn('tourErrBack', 'Geri dön', PRIMARY)}${btn('tourErrClose', 'Kapat', GHOST)}</div>`;
          document.getElementById('tourErrBack').onclick = () => { step = 1; render(); };
          document.getElementById('tourErrClose').onclick = () => close(true);
        }
      }

      function handOff(digest) {
        const who = getName();
        const prompt = `Mimari özet: ${project.name} projesi. Ekteki dosyaları oku ve bana şunları çıkar: 1) Projenin amacı ve teknoloji yığını, 2) Klasör/modül yapısı ve her parçanın sorumluluğu, 3) Giriş noktasından sonuca ana akış (gerekirse metin tabanlı kısa bir şema), 4) Güçlü yönler ile risk ve teknik borçlar, 5) En değerli 3 iyileştirme önerisi. Dosyaların bir kısmı kırpılmış olabilir; emin olmadığın yerde varsayım yaptığını belirt.${who ? ' (Kullanıcının adı ' + who + '.)' : ''}`;
        close(true);
        if (state.isGenerating) { forgeDialog('Şu an bir yanıt üretiliyor. Bitince tekrar deneyin.'); return; }
        state.activeChatId = null;
        clearAllAttachments();
        state.attachedFiles.push({ id: 'doc_' + Math.random().toString(36).slice(2, 9), name: 'proje-ozeti-' + String(project.name).replace(/[^\w.\-]+/g, '_') + '.txt', type: 'text', content: digest });
        renderAttachmentsBar();
        els.userInput.value = prompt;
        sendMessage();
      }

      window.startForgeTour = function () {
        cancelled = false; project = null; step = 0;
        modal.classList.remove('hidden');
        render();
      };
      document.getElementById('tourCloseBtn').onclick = () => close(true);
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modal.classList.contains('hidden')) close(true); });
      // "Gücümü göster" turu arayüzden kaldırıldı (giriş noktası yok, otomatik başlamaz); kod ileride yeniden kullanılabilir.
    })();


    // --- BİLDİRİMLER (yanıt uzun sürdüyse ve sekme arka plandaysa) ---
    window.ForgeNotify = (function () {
            const supported = 'Notification' in window;
      const enabled = () => { try { return supported && storage.get(KEYS.NOTIFY) === '1' && Notification.permission === 'granted'; } catch (_) { return false; } };
      async function setEnabled(on) {
        if (!supported) { await forgeDialog('Bu tarayıcı bildirimleri desteklemiyor.'); return false; }
        if (on) {
          let p = Notification.permission;
          if (p === 'default') p = await Notification.requestPermission();
          if (p !== 'granted') { storage.set(KEYS.NOTIFY, '0'); await forgeDialog('Bildirim izni verilmedi. Tarayıcının site ayarlarından bu siteye bildirim izni verebilirsiniz.'); return false; }
        }
        storage.set(KEYS.NOTIFY, on ? '1' : '0');
        return on;
      }
      function done(title, ms, content) {
        if (!enabled() || !document.hidden || ms < 8000) return;
        const body = String(content || '').replace(/[#*`>_\[\]]/g, '').replace(/\s+/g, ' ').trim().slice(0, 110) || 'Yanıtınız hazır.';
        const opts = { body, icon: './icon-v5-192.png', badge: './icon-v5-192.png', tag: 'forge-done', renotify: true };
        const t = 'Oforge AI · yanıt hazır' + (title ? ': ' + String(title).slice(0, 40) : '');
        const fallback = () => { try { new Notification(t, opts); } catch (_) {} };
        if (navigator.serviceWorker && navigator.serviceWorker.getRegistration) navigator.serviceWorker.getRegistration().then((r) => (r ? r.showNotification(t, opts) : fallback())).catch(fallback);
        else fallback();
      }
      return { supported, enabled, setEnabled, done };
    })();
    (function initNotifyToggle() {
      const btn = document.getElementById('notifyToggleBtn');
      const paint = () => {
        const on = ForgeNotify.enabled();
        btn.setAttribute('aria-checked', String(on));
        document.getElementById('notifyState').textContent = !ForgeNotify.supported ? 'Desteklenmiyor' : on ? 'Açık' : (Notification.permission === 'denied' ? 'Engelli' : 'Kapalı');
      };
      btn.onclick = async () => { await ForgeNotify.setEnabled(!ForgeNotify.enabled()); paint(); };
      window.paintNotifyToggle = paint;
      paint();
    })();

    // --- KOMUT PALETİ (Ctrl/⌘ + K) ---
    window.ForgeCmdk = (function () {
      const modal = document.getElementById('cmdk'), input = document.getElementById('cmdkInput'), list = document.getElementById('cmdkList');
      const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '');
      document.querySelectorAll('[data-kbd-k]').forEach((e) => { e.textContent = (isMac ? '⌘' : 'Ctrl') + ' K'; });
      let items = [], shown = [], sel = 0;
      const fold = (t) => String(t).toLocaleLowerCase('tr').replace(/ı/g, 'i').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      function score(q, t) {
        if (!q) return 1;
        const i = t.indexOf(q);
        if (i >= 0) return 200 - i + (i === 0 ? 40 : 0) - t.length * 0.1;
        let qi = 0, sc = 0, last = -2;
        for (let k = 0; k < t.length && qi < q.length; k++) {
          if (t[k] === q[qi]) { sc += (k === last + 1 ? 6 : 1) + ((k === 0 || t[k - 1] === ' ') ? 4 : 0); last = k; qi++; }
        }
        return qi === q.length ? sc : 0;
      }
      const click = (id) => () => document.getElementById(id).click();
      function build() {
        const A = [];
        const add = (group, title, icon, run, kw, hint) => A.push({ group, title, icon, run, kw: kw || '', hint: hint || '' });
        const web = storage.get(KEYS.WEB) === '1';
        const th = ForgeTheme.get();
        add('Eylemler', 'Yeni çalışma', 'plus', click('newChatBtn'), 'yeni sohbet new chat');
        if (state.isGenerating) add('Eylemler', 'Yanıtı durdur', 'square', click('stopBtn'), 'durdur iptal stop');
        add('Eylemler', 'Çalışma listesini süz', 'list-filter', () => { toggleSidebar(true); const w = document.getElementById('searchWrap'); if (w.classList.contains('hidden')) document.getElementById('searchToggleBtn').click(); else els.searchChatsInput.focus(); }, 'ara filtre');
        add('Eylemler', 'Sohbeti Markdown olarak dışa aktar', 'file-down', click('exportChatBtn'), 'indir export md');
        add('Eylemler', 'Web aramasını aç / kapat', 'globe', click('webSearchBtn'), 'google internet kaynak', web ? 'Açık' : 'Kapalı');
        add('Hızlı eylemler', 'Belgeleri özetle (/ozetle)', 'files', () => applySlashCmd("/ozetle Eklediğim çoklu belgeleri ve PDF'leri karşılaştırarak analiz et ve özetle."), 'pdf belge özet');
        add('Hızlı eylemler', 'Resmi yazı taslağı (/resmi-yazi)', 'mail', () => applySlashCmd('/resmi-yazi Kurumsal, resmi ve akıcı bir dille dilekçe / proje teklif yazısı taslağı oluştur: '), 'dilekçe teklif');
        add('Hızlı eylemler', 'Web sayfası tasarla (/web-tasarla)', 'layout-template', () => applySlashCmd('/web-tasarla Tek dosya halinde modern ve şık bir HTML/Tailwind web sayfası tasarla: '), 'html site tasarım');
        [['system', 'Sistem'], ['light', 'Açık'], ['dark', 'Koyu'], ['forge', 'Oforge']].forEach(([k, n]) => add('Görünüm', 'Tema: ' + n, 'sun-moon', () => ForgeTheme.set(k), 'tema görünüm renk', th === k ? 'Etkin' : ''));
        add('Görünüm', 'Yüksek kontrastı aç / kapat', 'contrast', () => ForgeTheme.toggleContrast(), 'erişilebilirlik kontrast', ForgeTheme.contrast() ? 'Açık' : 'Kapalı');
        add('Görünüm', 'Tamamlanma sesini aç / kapat', 'volume-2', click('soundToggleBtn'), 'ses sound', ForgeSound.enabled() ? 'Açık' : 'Kapalı');
        add('Görünüm', 'Bildirimleri aç / kapat', 'bell', click('notifyToggleBtn'), 'bildirim notification', ForgeNotify.enabled() ? 'Açık' : 'Kapalı');
        add('Hesap ve veri', 'Oforge AI Motor Ayarları', 'settings', click('openSettingsBtn'), 'api anahtar ayar key gemini');
        add('Hesap ve veri', 'Sohbetleri bulutla eşitle', 'cloud', click('cloudBtn'), 'firebase google giriş sync');
        add('Hesap ve veri', 'Tüm çalışmaları yedekle (JSON)', 'archive', click('backupJsonBtn'), 'yedek backup');
        add('Hesap ve veri', 'Uygulamayı indir / kur', 'download', click('installPwaBtn'), 'pwa yükle ana ekran');
        add('Yardım', 'Kullanım kılavuzu', 'book-open', click('openGuideBtn'), 'yardım nasıl');
        add('Yardım', 'Ozguler Forge hakkında', 'info', click('openAboutBtn'), 'sürüm iletişim');
        [['usage', 'Kullanım Politikası'], ['privacy', 'Gizlilik ve KVKK'], ['terms', 'Hizmet Şartları'], ['licenses', 'Yazılım Lisansları']].forEach(([k, n]) => add('Yasal', n, 'scale', () => document.querySelector('[data-legal="' + k + '"]').click(), 'yasal hukuk'));
        state.chats.slice(0, 60).forEach((c) => add('Geçmiş', c.title || 'Başlıksız çalışma', 'message-square', () => { state.activeChatId = c.id; renderChatList(els.searchChatsInput.value); renderMessages(); toggleSidebar(false); }, 'çalışma sohbet geçmiş'));
        return A;
      }
      function filter() {
        const q = fold(input.value.trim());
        if (!q) { shown = items.filter((x) => x.group !== 'Geçmiş' || items.filter((y) => y.group === 'Geçmiş').indexOf(x) < 5 && true); }
        else shown = items.map((x) => ({ x, s: score(q, fold(x.title + ' ' + x.kw + ' ' + x.group)) })).filter((r) => r.s > 0).sort((a, b) => b.s - a.s).map((r) => r.x).slice(0, 40);
        sel = 0; paint();
      }
      function paint() {
        list.innerHTML = '';
        if (!shown.length) { const e = document.createElement('div'); e.className = 'px-4 py-8 text-center text-sm text-slate-400'; e.textContent = 'Eşleşen komut veya çalışma yok.'; list.appendChild(e); return; }
        const noQuery = !input.value.trim(); let lastGroup = '';
        shown.forEach((x, i) => {
          if (noQuery && x.group !== lastGroup) { const g = document.createElement('div'); g.className = 'cmdk-group'; g.textContent = x.group; list.appendChild(g); lastGroup = x.group; }
          const row = document.createElement('button');
          row.type = 'button'; row.className = 'cmdk-row'; row.setAttribute('role', 'option'); row.setAttribute('aria-selected', String(i === sel)); row.dataset.i = i;
          row.innerHTML = '<i data-lucide="' + x.icon + '" class="w-[18px] h-[18px] text-slate-500 shrink-0"></i><span class="truncate"></span><span class="cmdk-tag"></span>';
          row.children[1].textContent = x.title; row.children[2].textContent = x.hint || (noQuery ? '' : x.group);
          row.onmousemove = () => { if (sel !== i) { sel = i; mark(); } };
          row.onclick = () => run(i);
          list.appendChild(row);
        });
        refreshIcons();
      }
      function mark() {
        list.querySelectorAll('.cmdk-row').forEach((r) => { const on = Number(r.dataset.i) === sel; r.setAttribute('aria-selected', String(on)); if (on) r.scrollIntoView({ block: 'nearest' }); });
      }
      function run(i) { const x = shown[i]; if (!x) return; close(); setTimeout(() => { try { x.run(); } catch (_) {} }, 0); }
      function open(prefill) {
        items = build(); input.value = prefill || ''; modal.classList.remove('hidden'); filter(); setTimeout(() => input.focus(), 0);
      }
      function close() { modal.classList.add('hidden'); }
      input.addEventListener('input', filter);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(sel + 1, shown.length - 1); mark(); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(sel - 1, 0); mark(); }
        else if (e.key === 'Home') { sel = 0; mark(); } else if (e.key === 'End') { sel = Math.max(shown.length - 1, 0); mark(); }
        else if (e.key === 'Enter') { e.preventDefault(); run(sel); }
      });
      modal.addEventListener('mousedown', (e) => { if (e.target === modal) close(); });
      window.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'k') { e.preventDefault(); modal.classList.contains('hidden') ? open() : close(); }
        else if (e.key === 'Escape' && !modal.classList.contains('hidden')) { e.stopPropagation(); close(); }
      }, true);
      document.getElementById('openCmdkBtn').onclick = () => { toggleSidebar(false); open(); };
      document.getElementById('openPaletteBtn').onclick = () => open();
      return { open, close };
    })();

    // --- ÇEVRİMDIŞI ŞERİDİ ve KISAYOL EYLEMLERİ (PWA) ---
    (function initPwaExtras() {
      const bar = document.getElementById('offlineBar');
      const upd = () => bar.classList.toggle('hidden', navigator.onLine);
      window.addEventListener('online', upd); window.addEventListener('offline', upd); upd();
      try {
        const a = new URLSearchParams(location.search).get('action');
        if (!a) return;
        history.replaceState(null, '', location.pathname);
        const wait = document.getElementById('forgeSplash') ? 2300 : 400;
        if (a === 'tour') setTimeout(() => window.startForgeTour(), wait);
        else if (a === 'palette') setTimeout(() => ForgeCmdk.open(), wait);
        else if (a === 'new') setTimeout(() => document.getElementById('newChatBtn').click(), 200);
      } catch (_) {}
    })();

    // --- TEMA: Sistem / Açık / Koyu / Oforge + Yüksek kontrast ---
    window.ForgeTheme = (function initTheme() {
            const NAMES = { system: 'Sistem', light: 'Açık', dark: 'Koyu', forge: 'Oforge' };
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const mqc = window.matchMedia('(prefers-contrast: more)');
      const meta = document.querySelector('meta[name="theme-color"]');
      const root = document.documentElement;
      const get = () => { const v = storage.get(KEYS.THEME); return NAMES[v] ? v : 'system'; };
      const contrast = () => { const v = storage.get(KEYS.CONTRAST); return v === null ? mqc.matches : v === '1'; };
      const paint = () => {
        const mode = get();
        const dark = mode === 'dark' || mode === 'forge' || (mode === 'system' && mq.matches);
        root.classList.toggle('dark', dark); root.classList.toggle('forge', mode === 'forge'); root.classList.toggle('hc', contrast());
        if (meta) meta.setAttribute('content', mode === 'forge' ? '#14110F' : dark ? '#1A1A1C' : '#0F172A');
        document.getElementById('themeCurrent').textContent = NAMES[mode] + (contrast() ? ' · YK' : '');
        document.querySelectorAll('[data-theme-opt]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.themeOpt === mode)));
        document.getElementById('contrastToggleBtn').setAttribute('aria-checked', String(contrast()));
        if (typeof rerenderDiagrams === 'function') rerenderDiagrams();
      };
      const set = (m) => { storage.set(KEYS.THEME, m); paint(); };
      const toggleContrast = () => { storage.set(KEYS.CONTRAST, contrast() ? '0' : '1'); paint(); };
      document.querySelectorAll('[data-theme-opt]').forEach((b) => { b.onclick = () => set(b.dataset.themeOpt); });
      document.getElementById('contrastToggleBtn').onclick = toggleContrast;
      const tbtn = document.getElementById('themeToggleBtn');
      const tsub = document.getElementById('themeSubmenu');
      tbtn.onclick = () => { const open = tsub.classList.toggle('hidden') === false; tbtn.setAttribute('aria-expanded', String(open)); };
      const onSys = () => { if (get() === 'system') paint(); };
      if (mq.addEventListener) { mq.addEventListener('change', onSys); mqc.addEventListener('change', () => { if (storage.get(KEYS.CONTRAST) === null) paint(); }); }
      paint();
      return { get, set, contrast, toggleContrast, NAMES };
    })();
    document.querySelectorAll('[data-app-version]').forEach((el) => { el.textContent = 'v' + APP_VERSION; });

    // --- KULLANIM KILAVUZU ---
    const GUIDE_SECTIONS = [
      ['Hızlı başlangıç', [
        'Alttaki yazı kutusuna sorunuzu yazın, Enter ile gönderin (alt satıra geçmek için Shift + Enter).',
        'Oforge AI’yı ilk kez kullanıyorsanız sol alttaki ⋯ menüsünden “Oforge AI Motor Ayarları”nı açıp Gemini API anahtarınızı girin. Anahtar yalnızca bu tarayıcıda saklanır.',
        'Her konuşma sol listede bir “çalışma” olarak kaydedilir. Yeni bir konu için “Yeni Çalışma”ya basın.'
      ]],
      ['Belge ve fotoğraf ekleme', [
        'Yazı kutusunun altındaki “Fotoğraf” ve “PDF / Belgeler” düğmeleriyle birden fazla dosya ekleyebilirsiniz; dosyaları sohbet alanına sürükleyip bırakmak da yeterlidir.',
        'Desteklenen belgeler: PDF, TXT, MD, JSON, CSV, JS, PY, HTML, CSS, XML ve SQL. Fotoğraflar: JPG, PNG, WEBP, GIF.',
        'Ekler cihazınızda saklanır; takip sorularında Oforge AI ekleri görmeye devam eder. Tek istek yaklaşık 20 MB’ı aşarsa uyarı alırsınız, dosyaları azaltıp tekrar deneyin.'
      ]],
      ['Hızlı komutlar', [
        'Yazı kutusuna “/” yazınca komut menüsü açılır.',
        '/ozetle: eklediğiniz belgeleri karşılaştırarak özetler.',
        '/resmi-yazi: dilekçe veya proje teklifi gibi resmi yazı taslağı hazırlar.',
        '/web-tasarla: tek dosyalık bir web sayfası üretir; sonucu “Önizle” ile görürsünüz.'
      ]],
      ['Web araması ve kaynaklar', [
        'Yazı kutusundaki “Web” düğmesi açıkken Oforge AI güncel bilgi için Google Arama kullanır.',
        'Kullanılan kaynak bağlantıları yanıtın altında gösterilir. Süre bilgisi “Web araması + yanıt” olarak etiketlenir.',
        'Güncel olmasına gerek olmayan sorularda düğmeyi kapalı tutmak yanıtı hızlandırır.'
      ]],
      ['Motorlar', [
        'İki motor vardır: “AI Ultra 3.8” (varsayılan) en güçlü ve ayrıntılı yanıtı verir; “AI Lite” günlük sorular için daha hızlıdır. Seçim Ayarlar bölümündedir.',
        'Kota ya da bağlantı hatası olursa nedeni ayrı bir kartta gösterilir; AI Ultra 3.8 gerekirse yedek modeline kendiliğinden geçer.',
        'Yanıtın altındaki öneri düğmeleri konuyu derinleştirmek ya da farklı bir yönden devam etmek içindir; dokununca soru olarak gönderilir.'
      ]],
      ['Yanıtlarla çalışma', [
        'Her yanıtın altında Önizle, Kopyala ve Sesli Dinle düğmeleri bulunur.',
        'Kendi mesajınızı düzenleyip yeniden gönderebilirsiniz.',
        'Üretilen web sayfası, belge ve kod çıktılarını sağ üstteki “Önizleme” düğmesiyle yan panelde açabilirsiniz.',
        'Yazı yerine konuşmak için mikrofon düğmesine (“Sesli”) basın.',
        'Yapay zekâ hata yapabilir; önemli bilgileri mutlaka doğrulayın.'
      ]],
      ['Çalışmaları yönetme', [
        '“Ara” ile çalışma başlıklarında arama yapın.',
        'Listede bir satırın üzerine gelince çıkan kutuyu işaretleyerek birden çok çalışmayı seçin; üstte beliren çubuktan “Tümünü seç”, “Vazgeç” veya “Sil” seçeneklerini kullanın. Silme işlemi onay ister ve çalışmanın eklerini de siler.',
        'Üstteki dışa aktar düğmesi geçerli sohbeti Markdown olarak kaydeder. ⋯ menüsündeki “Tüm çalışmaları yedekle” tüm çalışmaları JSON dosyası olarak indirir.'
      ]],
      ['Google ile giriş ve bulut eşitleme', [
        'Sol alttaki Google düğmesiyle giriş yaptığınızda Oforge AI size adınızla hitap eder.',
        '⋯ menüsündeki “Sohbetleri bulutla eşitle” sohbetlerinizi hesabınıza yazar ve diğer cihazlarınızda görünür kılar. Silmeler de eşitlenir.',
        'Ekler (PDF ve fotoğraf) cihazda kalır, eşitlenmez. Tek sohbet yaklaşık 900 KB’ı aşarsa eşitlenmez.'
      ]],
      ['Komut paleti (Ctrl / ⌘ + K)', [
        'Ctrl + K (Mac’te ⌘ + K) ile paleti açın; sol paneldeki “Ara” da aynı paleti açar.',
        'Komutları, ayarları ve geçmiş çalışmaları yazarak arayın (yazım hatalarını ve Türkçe karakterleri tolere eder). ↑ ↓ ile gezin, Enter ile çalıştırın, Esc ile kapatın.',
        'Palette: yeni çalışma, tema değiştirme, ses ve bildirim ayarı, yedekleme, hızlı komutlar, turu başlatma ve yasal metinler vardır.'
      ]],
      ['Zengin yanıtlar', [
        'Diyagramlar: Oforge AI akış/mimari şemalarını çizilebilir diyagram olarak verir; “Kod”, “SVG indir” ve “Kopyala” düğmeleri vardır.',
        'Matematik denklemleri LaTeX olarak güzel biçimde gösterilir. Tablolar kaydırılabilir kartta açılır ve “CSV kopyala” ile alınabilir.',
        'Kod değişiklikleri “diff” bloğunda eklenen/silinen satır renkleriyle ve +/− sayısıyla gösterilir. “Not / İpucu / Uyarı” kutuları da desteklenir.',
        'Diyagram ve denklemler ilk kullanımda küçük bir kütüphane indirir; çevrimdışıyken kaynak kod görünür.'
      ]],
      ['Tema ve erişilebilirlik', [
        '⋯ menüsü → Tema: Sistem, Açık, Koyu veya Oforge (koyu taban, ateş turuncusu vurgu). “Yüksek kontrast” seçeneği metin ve kenarlık kontrastını artırır; cihazınızda “kontrastı artır” açıksa kendiliğinden devreye girer.',
        'Tüm düğmeler klavyeyle kullanılabilir; odak halkaları görünürdür.'
      ]],
      ['Bildirimler ve çevrimdışı kullanım', [
        '⋯ menüsü → Bildirimler açıksa, yanıt 8 saniyeden uzun sürüp siz başka sekmedeyken bitince bildirim alırsınız. Bildirime basınca Oforge AI öne gelir.',
        'Uygulama kapalıyken (sunucudan) bildirim gönderilmez; bunun için ayrı bir sunucu gerekir. Sekme veya yüklü uygulama arka planda açık olmalıdır.',
        'Çevrimdışıyken uygulama ve kayıtlı çalışmalar açılır, üstte uyarı şeridi görünür; yeni yanıt için internet gerekir.',
        'Uygulamayı kurduktan sonra simgeye uzun basarak (veya sağ tıklayarak) “Yeni çalışma” ve “Komut paleti” kısayollarını kullanabilirsiniz.'
      ]],
      ['Sesler ve animasyonlar', [
        'Yanıt tamamlandığında kısa bir “tamamlandı” sesi çalar. ⋯ menüsündeki “Tamamlanma sesi” ile kapatabilirsiniz.',
        'Oforge AI yanıt hazırlarken logo ve yanıt simgesi sıcak bir ısı ışıltısıyla parlar; açılışta ve tur sırasında çekiç örse vurur.',
        'Cihazınızda “hareketi azalt” seçiliyse animasyonlar otomatik olarak kapanır.'
      ]],
      ['Uygulamayı cihaza kurma', [
        '⋯ menüsündeki veya üstteki “İndir” düğmesi Oforge AI’yı uygulama olarak kurar. Kurulum penceresi açılmazsa tarayıcının menüsünden “Ana ekrana ekle” veya “Uygulamayı yükle” seçeneğini kullanın.',
        'Uygulama güncellendiğinde, o sırada yazı yazmıyorsanız otomatik yenilenir; aksi halde “Yenile” bildirimi görürsünüz.'
      ]]
    ];
    (function initGuide() {
      const modal = document.getElementById('guideModal');
      const body = document.getElementById('guideContent');
      GUIDE_SECTIONS.forEach(([title, items], idx) => {
        const d = document.createElement('details');
        d.className = 'group rounded-xl border border-slate-200 bg-white';
        if (idx === 0) d.open = true;
        const sum = document.createElement('summary');
        sum.className = 'flex items-center justify-between gap-3 cursor-pointer select-none px-4 py-3 text-base font-semibold text-slate-900 list-none';
        const t = document.createElement('span'); t.textContent = title;
        const chev = document.createElement('span'); chev.className = 'text-slate-400 transition-transform group-open:rotate-180'; chev.textContent = '⌄';
        sum.append(t, chev);
        const ul = document.createElement('ul');
        ul.className = 'px-4 pb-4 space-y-2 text-[15px] leading-relaxed text-slate-700 list-disc ml-9 mr-4';
        items.forEach((x) => { const li = document.createElement('li'); li.textContent = x; ul.appendChild(li); });
        d.append(sum, ul);
        body.appendChild(d);
      });
      const close = () => modal.classList.add('hidden');
      document.getElementById('openGuideBtn').onclick = () => { modal.classList.remove('hidden'); body.scrollTop = 0; };
      document.getElementById('closeGuideBtn').onclick = close;
      document.getElementById('okGuideBtn').onclick = close;
      modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
    })();

    document.getElementById('closeInstallGuideBtn').onclick = () => els.installGuideModal.classList.add('hidden');
    document.getElementById('okInstallGuideBtn').onclick = () => els.installGuideModal.classList.add('hidden');


    let deferredPrompt = null;
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
    });

    async function triggerAppInstall() {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        await deferredPrompt.userChoice;
        deferredPrompt = null;
      } else {
        els.installGuideModal.classList.remove('hidden');
      }
    }

    document.getElementById('installPwaBtn').onclick = triggerAppInstall;
    document.getElementById('headerInstallBtn').onclick = triggerAppInstall;

    // --- SÜRÜM DENETİMİ & GÜNCELLEME ---
    // Tarayıcı sw.js dosyasını kendisi bayt bazında karşılaştırır; yeni sürüm "waiting" durumuna düşer.
    // Kullanıcı meşgul değilse otomatik uygulanır, meşgulse (yazıyor / cevap akıyor / ek var) bildirim gösterilir.
    let swReg = null;
    let updateRequested = false;

    function isUserBusy() {
      return state.isGenerating ||
        els.userInput.value.trim() !== '' ||
        state.attachedFiles.length > 0 ||
        state.attachedImages.length > 0;
    }

    function applyUpdate(worker) {
      updateRequested = true;
      worker.postMessage({ type: 'SKIP_WAITING' });
    }

    function showUpdateToast(worker) {
      if (document.getElementById('updateToast')) return;
      const t = document.createElement('div');
      t.id = 'updateToast';
      t.className = 'fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] bg-slate-900 text-white text-xs rounded-xl shadow-float px-4 py-2.5 flex items-center gap-3';
      t.innerHTML = '<span>Oforge AI\'nın yeni sürümü hazır.</span>' +
        '<button type="button" id="updateNowBtn" class="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 font-semibold cursor-pointer">Yenile</button>' +
        '<button type="button" id="updateLaterBtn" class="text-slate-400 hover:text-white cursor-pointer">Sonra</button>';
      document.body.appendChild(t);
      document.getElementById('updateNowBtn').onclick = () => applyUpdate(worker);
      document.getElementById('updateLaterBtn').onclick = () => t.remove();
    }

    function handleWaitingWorker(worker) {
      if (!worker) return;
      if (isUserBusy()) showUpdateToast(worker);
      else applyUpdate(worker);
    }

    function checkForUpdates() {
      if (swReg) swReg.update().catch(() => {});
    }

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).then((reg) => {
        swReg = reg;
        if (reg.waiting && navigator.serviceWorker.controller) handleWaitingWorker(reg.waiting);
        reg.addEventListener('updatefound', () => {
          const nw = reg.installing;
          if (!nw) return;
          nw.addEventListener('statechange', () => {
            if (nw.state === 'installed' && navigator.serviceWorker.controller) handleWaitingWorker(nw);
          });
        });
      }).catch(() => {});

      // Sadece kullanıcı/uygulama güncellemeyi onayladıysa yenile (ilk kurulumda gereksiz yenileme olmaz)
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (updateRequested) window.location.reload();
      });
    }

    setInterval(checkForUpdates, 30 * 60 * 1000);
    window.addEventListener('focus', checkForUpdates);


    // --- KAYNAKLAR VE WEB ARAMA DÜĞMESİ ---
    function renderSources(row, list) {
      if (!row || !Array.isArray(list) || !list.length) return;
      const old = row.querySelector('.msg-sources'); if (old) old.remove();
      const box = document.createElement('div');
      box.className = 'msg-sources mt-3 flex flex-wrap items-center gap-1.5 text-[11px]';
      const h = document.createElement('span'); h.className = 'text-slate-400 font-semibold'; h.textContent = 'Kaynaklar:'; box.appendChild(h);
      list.slice(0, 8).forEach((x) => {
        const a = document.createElement('a');
        a.href = x.uri; a.target = '_blank'; a.rel = 'noopener noreferrer';
        a.className = 'px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-700 truncate max-w-[200px] transition';
        a.textContent = x.title; box.appendChild(a);
      });
      const d = row.querySelector('.msg-disclaimer');
      if (d) d.parentNode.insertBefore(box, d); else row.appendChild(box);
    }

    (function initWebToggle() {
      const b = document.getElementById('webSearchBtn');
      const paint = () => {
        const on = storage.get(KEYS.WEB) === '1';
        b.setAttribute('aria-pressed', String(on));
        b.className = 'p-2 rounded-xl transition flex items-center gap-1.5 text-xs font-medium cursor-pointer ' + (on ? 'text-blue-700 bg-blue-50 border border-blue-200' : 'text-slate-500 hover:text-blue-600 hover:bg-slate-100 border border-transparent');
      };
      b.onclick = () => { storage.set(KEYS.WEB, storage.get(KEYS.WEB) === '1' ? '0' : '1'); paint(); };
      paint();
    })();

    // --- HESAP MENÜSÜ ve ARAMA ---
    (function initAccountMenu() {
      const menu = document.getElementById('accountMenu');
      const btn = document.getElementById('accountMenuBtn');
      const chip = document.getElementById('userSignedIn');
      const setOpen = (open) => {
        menu.classList.toggle('hidden', !open);
        btn.setAttribute('aria-expanded', String(open));
      };
      const toggle = (e) => { e.stopPropagation(); setOpen(menu.classList.contains('hidden')); };
      btn.onclick = toggle;
      chip.onclick = toggle;
      chip.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(e); } };
      menu.addEventListener('click', (e) => {
        e.stopPropagation();
        const b = e.target.closest('button');
        if (!b || b.id === 'legalToggleBtn' || b.id === 'cloudBtn' || b.id === 'themeToggleBtn' || b.id === 'soundToggleBtn' || b.id === 'notifyToggleBtn' || b.id === 'contrastToggleBtn' || b.hasAttribute('data-theme-opt')) return;
        setOpen(false);
      });
      document.addEventListener('click', (e) => { if (!menu.contains(e.target)) setOpen(false); });
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setOpen(false); });

      const searchBtn = document.getElementById('searchToggleBtn');
      const searchWrap = document.getElementById('searchWrap');
      searchBtn.onclick = () => {
        const show = searchWrap.classList.toggle('hidden') === false;
        searchBtn.setAttribute('aria-expanded', String(show));
        if (show) { els.searchChatsInput.focus(); }
        else { els.searchChatsInput.value = ''; renderChatList(''); }
      };
    })();

    // --- GOOGLE İLE GİRİŞ ---
    function decodeJwt(token) {
      const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      const bin = atob(b64.padEnd(b64.length + (4 - b64.length % 4) % 4, '='));
      return JSON.parse(decodeURIComponent(Array.from(bin, c => '%' + c.charCodeAt(0).toString(16).padStart(2, '0')).join('')));
    }
    function renderUserArea() {
      const inEl = document.getElementById('userSignedIn');
      const outEl = document.getElementById('userSignedOut');
      if (currentUser) {
        inEl.classList.remove('hidden'); outEl.classList.add('hidden');
        const me = document.getElementById('menuEmail'); me.textContent = currentUser.email || ''; me.classList.toggle('hidden', !currentUser.email);
        document.getElementById('menuSignOutWrap').classList.remove('hidden');
        document.getElementById('userName').textContent = currentUser.name || '';
        document.getElementById('userEmail').textContent = currentUser.email || '';
        const av = document.getElementById('userAvatar');
        if (currentUser.picture) av.src = currentUser.picture; else av.removeAttribute('src');
      } else {
        inEl.classList.add('hidden'); outEl.classList.remove('hidden');
        document.getElementById('menuEmail').classList.add('hidden');
        document.getElementById('menuSignOutWrap').classList.add('hidden');
      }
    }
    function handleGoogleCredential(resp) {
      try {
        const p = decodeJwt(resp.credential);
        currentUser = { sub: p.sub, name: p.name || p.given_name || 'Kullanıcı', email: p.email || '', picture: p.picture || '' };
        storage.setJSON(KEYS.USER, currentUser);
        storage.set(KEYS.TOKEN, resp.credential);
        renderUserArea();
      } catch (err) { forgeDialog('Google girişi tamamlanamadı: ' + err.message); }
    }
    function initGoogleSignIn(tries) {
      tries = tries || 0;
      const host = document.getElementById('googleBtnHost');
      const setup = document.getElementById('googleSetupBtn');
      if (!GOOGLE_CLIENT_ID) {
        setup.classList.remove('hidden');
        setup.onclick = () => forgeDialog('Google girişi için index.html içindeki GOOGLE_CLIENT_ID değerine Google Cloud Console\'dan aldığınız OAuth Web Client ID\'yi yazın ve sitenizin adresini "Authorized JavaScript origins" listesine ekleyin. Ayrıntılar README.md dosyasında.');
        return;
      }
      if (!(window.google && google.accounts && google.accounts.id)) {
        if (tries < 40) setTimeout(() => initGoogleSignIn(tries + 1), 250);
        return;
      }
      google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: handleGoogleCredential, auto_select: true });
      if (PROXY_URL && currentUser && !getIdToken()) google.accounts.id.prompt();
      google.accounts.id.renderButton(host, { theme: 'outline', size: 'large', text: 'signin_with', shape: 'pill', locale: 'tr', width: 240 });
    }
    document.getElementById('signOutBtn').onclick = () => {
      if (window.google && google.accounts && google.accounts.id) google.accounts.id.disableAutoSelect();
      currentUser = null;
      storage.remove(KEYS.USER);
      storage.remove(KEYS.TOKEN);
      renderUserArea();
    };
    renderUserArea();
    initGoogleSignIn();

    // Bulut modülünün (Firebase) uygulama durumuna eriştiği köprü
    window.forgeBridge = {
      dialog: (msg) => forgeDialog(msg),
      getChats: () => state.chats,
      isBusy: () => state.isGenerating,
      activeId: () => state.activeChatId,
      persist: () => { storage.setJSON(KEYS.CHATS, state.chats); },
      addLocal: (c) => { state.chats.unshift(c); },
      replaceLocal: (id, p) => { const c = state.chats.find(x => x.id === id); if (c) { c.title = p.title; c.messages = p.messages; } },
      removeLocal: (id) => {
        state.chats = state.chats.filter(c => c.id !== id);
        selectedChats.delete(id);
        if (state.activeChatId === id) state.activeChatId = null;
      },
      refresh: (full) => { renderChatList(els.searchChatsInput.value); if (full) renderMessages(); },
      setUser: (u) => {
        if (currentUser) return;
        currentUser = u;
        storage.setJSON(KEYS.USER, u);
        renderUserArea();
      }
    };

    (function initModelSelect() {
      const sel = document.getElementById('modelSelect');
      ENGINES.forEach((m) => {
        const o = document.createElement('option');
        o.value = m.id; o.textContent = m.label + ': ' + m.desc;
        sel.appendChild(o);
      });
      sel.value = curModel().id;
      sel.onchange = () => {
        storage.set(KEYS.MODEL, sel.value);
        updateApiBadge();
      };
    })();

    updateApiBadge();
    renderChatList();
    renderMessages();
