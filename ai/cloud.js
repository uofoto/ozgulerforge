    import { storage } from './storage.js';
    import { KEYS } from './config.js';

    // Firebase yapılandırması
    const firebaseConfig = {
      apiKey: "AIzaSyAlZLrHCBuvEUbgELeFumaL4q_mD_X7HT8",
      authDomain: "forge-ai-83cea.firebaseapp.com",
      projectId: "forge-ai-83cea",
      storageBucket: "forge-ai-83cea.firebasestorage.app",
      messagingSenderId: "912627097805",
      appId: "1:912627097805:web:0de9478c8d0ba511ef4984"
    };

    const V = "13.3.0";
    // Uygulamanın diyalog penceresi (app.js modül olduğu için global değildir; köprüden gelir).
    const dialog = (msg) => window.forgeBridge.dialog(msg);
    const btn = document.getElementById('cloudBtn');
    const btnText = document.getElementById('cloudBtnText');
    const statusEl = document.getElementById('cloudStatus');
    const setStatus = (t, err) => {
      statusEl.textContent = t || '';
      statusEl.classList.toggle('hidden', !t);
      statusEl.className = 'mt-1 text-[10px] text-center leading-snug ' + (err ? 'text-rose-500' : 'text-slate-400') + (t ? '' : ' hidden');
    };

    try {
      const [{ initializeApp }, A, F] = await Promise.all([
        import(`https://www.gstatic.com/firebasejs/${V}/firebase-app.js`),
        import(`https://www.gstatic.com/firebasejs/${V}/firebase-auth.js`),
        import(`https://www.gstatic.com/firebasejs/${V}/firebase-firestore.js`)
      ]);
      const app = initializeApp(firebaseConfig);
      window.firebaseApp = app;
      const B = window.forgeBridge;
      const auth = A.getAuth(app);
      const db = F.getFirestore(app);

      const DEVICE = (() => {
        let d = storage.get(KEYS.CLOUD_DEVICE);
        if (!d) { d = Math.random().toString(36).slice(2) + Date.now().toString(36); storage.set(KEYS.CLOUD_DEVICE, d); }
        return d;
      })();
      let meta = storage.getJSON(KEYS.CLOUD_META, {}) || {};
      const saveMeta = () => { storage.setJSON(KEYS.CLOUD_META, meta); };
      const hash = (str) => { let h = 5381; for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0; return h + ':' + str.length; };
      const contentOf = (c) => JSON.stringify({ title: c.title, messages: c.messages });
      const MAX_DOC = 900 * 1024;

      let uid = null, unsub = null, pushTimer = null, pushing = false;

      const explain = (e) => {
        const code = (e && e.code) || '';
        if (code.includes('configuration-not-found')) return 'Firebase Authentication henüz başlatılmamış: Console > Build > Authentication > "Get started" deyip Google girişini etkinleştirin.';
        if (code.includes('operation-not-allowed')) return 'Firebase Console > Authentication > Sign-in method bölümünde Google girişi etkinleştirilmemiş.';
        if (code.includes('unauthorized-domain')) return 'Bu site adresi (' + location.hostname + ') Firebase > Authentication > Settings > Authorized domains listesinde yok. Bu adresi "Add domain" ile ekleyin.';
        if (code.includes('popup-blocked')) return 'Tarayıcı açılır pencereyi engelledi. Bu site için açılır pencerelere izin verin.';
        if (code.includes('permission-denied')) return 'Firestore kuralları erişime izin vermiyor. Kuralları README\'deki gibi ayarlayın.';
        if (code.includes('popup-closed') || code.includes('cancelled-popup')) return '';
        return (e && e.message) || 'Bilinmeyen hata';
      };

      async function pushNow() {
        if (!uid || pushing) return;
        if (B.isBusy()) { schedulePush(); return; }
        pushing = true;
        try {
          for (const c of [...B.getChats()]) {
            const content = contentOf(c);
            const h = hash(content);
            if (meta[c.id] && meta[c.id].h === h) continue;
            if (content.length > MAX_DOC) { setStatus('“' + c.title + '” çok büyük olduğu için eşitlenmedi.', true); continue; }
            const t = Date.now();
            await F.setDoc(F.doc(db, 'users', uid, 'chats', c.id), { title: c.title, messages: JSON.stringify(c.messages), updatedAt: t, deviceId: DEVICE });
            meta[c.id] = { h, t };
            saveMeta();
          }
          setStatus('Eşitlendi ✓ ' + new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }));
        } catch (e) {
          setStatus('Eşitleme hatası: ' + explain(e), true);
        } finally { pushing = false; }
      }
      function schedulePush() {
        if (!uid) return;
        clearTimeout(pushTimer);
        pushTimer = setTimeout(pushNow, 1500);
      }

      function listen() {
        if (unsub) unsub();
        setStatus('Eşitleniyor…');
        unsub = F.onSnapshot(F.collection(db, 'users', uid, 'chats'), (snap) => {
          let changed = false, activeAffected = false;
          const activeId = B.activeId();
          snap.docChanges().forEach((ch) => {
            const id = ch.doc.id, d = ch.doc.data();
            if (ch.type === 'removed') {
              if (B.getChats().some(c => c.id === id) && !(B.isBusy() && activeId === id)) {
                B.removeLocal(id); delete meta[id]; changed = true; if (id === activeId) activeAffected = true;
              }
              return;
            }
            if (d.deviceId === DEVICE && meta[id] && meta[id].t === d.updatedAt) return; // kendi yazdığımız
            let msgs; try { msgs = JSON.parse(d.messages); } catch (_) { return; }
            const local = B.getChats().find(c => c.id === id);
            if (!local) {
              const nc = { id, title: d.title, messages: msgs };
              B.addLocal(nc); meta[id] = { h: hash(contentOf(nc)), t: d.updatedAt }; changed = true; return;
            }
            const m = meta[id];
            const localDirty = !m || hash(contentOf(local)) !== m.h;
            if (localDirty) return;                       // yerel değişiklik var, o gönderilecek
            if (d.updatedAt <= m.t) return;
            if (B.isBusy() && activeId === id) return;
            B.replaceLocal(id, { title: d.title, messages: msgs });
            meta[id] = { h: hash(contentOf(local)), t: d.updatedAt };
            changed = true; if (id === activeId) activeAffected = true;
          });
          // Daha önce eşitlenmiş ama sunucuda artık olmayan sohbetler başka cihazda silinmiştir
          if (!snap.metadata.fromCache) {
            const remoteIds = new Set(snap.docs.map(x => x.id));
            B.getChats().filter(c => meta[c.id] && !remoteIds.has(c.id) && !(B.isBusy() && B.activeId() === c.id)).forEach((c) => {
              B.removeLocal(c.id); delete meta[c.id]; changed = true; if (c.id === activeId) activeAffected = true;
            });
          }
          saveMeta();
          if (changed) { B.persist(); B.refresh(activeAffected || !B.activeId()); }
          setStatus('Eşitlendi ✓ ' + new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }));
          schedulePush();
        }, (e) => setStatus('Eşitleme hatası: ' + explain(e), true));
      }

      window.forgeCloud.push = schedulePush;
      window.forgeCloud.remove = (ids) => {
        ids.forEach((id) => {
          delete meta[id];
          if (uid) F.deleteDoc(F.doc(db, 'users', uid, 'chats', id)).catch((e) => setStatus('Silme hatası: ' + explain(e), true));
        });
        saveMeta();
      };

      A.onAuthStateChanged(auth, (user) => {
        if (user) {
          const lastUid = storage.get(KEYS.CLOUD_UID);
          if (lastUid && lastUid !== user.uid) { meta = {}; saveMeta(); }   // farklı hesap: yerel sohbetler yeni hesaba yüklenir
          storage.set(KEYS.CLOUD_UID, user.uid);
          uid = user.uid;
          B.setUser({ sub: user.uid, name: user.displayName || 'Kullanıcı', email: user.email || '', picture: user.photoURL || '' });
          btnText.textContent = '☁️ Bulut eşitleme açık · Kapat';
          listen();
        } else {
          uid = null; if (unsub) { unsub(); unsub = null; }
          btnText.textContent = '☁️ Sohbetleri bulutla eşitle';
          setStatus('');
        }
      });

      btn.onclick = async () => {
        if (uid) {
          try { await A.signOut(auth); } catch (e) { setStatus(explain(e), true); }
          return;
        }
        try { await A.signInWithPopup(auth, new A.GoogleAuthProvider()); }
        catch (e) { const m = explain(e); if (m) dialog('Bulut girişi tamamlanamadı: ' + m); }
      };
    } catch (e) {
      console.warn('Firebase yüklenemedi:', e);
      btn.onclick = () => dialog('Bulut eşitleme şu an yüklenemedi (internet bağlantınızı kontrol edin).');
    }
