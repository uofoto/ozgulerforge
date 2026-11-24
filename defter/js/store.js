const KEY='defter-v1',P={home:'M3 11l9-8 9 8M5 10v10h14V10',arc:'M3 4h18v4H3zM5 8v12h14V8M10 12h4',cloud:'M7 18a4 4 0 0 1-.5-8 6 6 0 0 1 11.5 1.5A3.5 3.5 0 0 1 17.5 18z',set:'M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0',plus:'M12 5v14M5 12h14',star:'M12 3l2.8 5.8 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.3l1-6.2L3 9.7l6.2-.9z',search:'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-5-5'};
const ic=n=>{const s=document.createElementNS('http://www.w3.org/2000/svg','svg');s.setAttribute('viewBox','0 0 24 24');s.setAttribute('class','i');s.setAttribute('aria-hidden','true');const p=document.createElementNS(s.namespaceURI,'path');p.setAttribute('d',P[n]);s.append(p);return s};
const $=s=>document.querySelector(s);
function el(t,c,x){const e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e}
let D={notes:[],set:{theme:'auto',size:1,time:'09:00'},lastBackup:0};
const META='defter-meta';
try{const m=JSON.parse(localStorage.getItem(META)||'null');if(m)D=Object.assign(D,m)}catch(e){}
let db=null;
const idb=(m,f,st='n')=>new Promise((ok,no)=>{const t=db.transaction(st,m),r=f(t.objectStore(st));t.oncomplete=()=>ok(r&&r.result);t.onerror=()=>no(t.error)});
const openDB=()=>new Promise((ok,no)=>{const r=indexedDB.open('defter',2);r.onupgradeneeded=()=>{const d=r.result;if(!d.objectStoreNames.contains('n'))d.createObjectStore('n',{keyPath:'id'});if(!d.objectStoreNames.contains('s'))d.createObjectStore('s',{keyPath:'k'})};r.onsuccess=()=>{db=r.result;ok()};r.onerror=()=>no(r.error)});
function save(n){if(n&&db)idb('readwrite',s=>s.put(n)).catch(()=>toast('Kayıt yapılamadı'));try{localStorage.setItem(META,JSON.stringify({set:D.set,lastBackup:D.lastBackup,snapT:D.snapT}))}catch(e){}}
const remove=n=>db&&idb('readwrite',s=>s.delete(n.id));
const putAll=a=>db&&idb('readwrite',s=>{a.forEach(x=>s.put(x))});
async function loadNotes(){
  try{await openDB();D.notes=await idb('readonly',s=>s.getAll());
    const dead=D.notes.filter(n=>n.x&&Date.now()-n.x>7776e6);if(dead.length){D.notes=D.notes.filter(n=>!dead.includes(n));await idb('readwrite',s=>{dead.forEach(n=>s.delete(n.id))})}
    const ch=D.notes.filter(norm);if(ch.length)await putAll(ch);
    const old=JSON.parse(localStorage.getItem('defter-v1')||'null');
    if(old&&Array.isArray(old.notes)){const ids=new Set(D.notes.map(n=>n.id)),add=old.notes.filter(n=>!ids.has(n.id));add.forEach(norm);await putAll(add);D.notes=D.notes.concat(add);if(old.set)D.set=old.set;if(old.lastBackup)D.lastBackup=old.lastBackup;save();localStorage.removeItem('defter-v1')}
    if(navigator.storage&&navigator.storage.persist)navigator.storage.persist();
  }catch(e){D.notes=[];toast('Veritabanı açılamadı')}
}
let LIM=30,view='home',tag='Tümü',q='',sub='fav',cur=null,kind='soz',hi=0;
function toast(m){const d=el('div','toast',m);document.body.append(d);setTimeout(()=>d.remove(),1800)}
function applySet(){const r=document.documentElement,t=D.set.theme;if(t==='auto')r.removeAttribute('data-theme');else r.setAttribute('data-theme',t);r.style.setProperty('--fs',D.set.size)}
const live=()=>D.notes.filter(n=>!n.d&&!n.x);
const tags=()=>[...new Set(live().map(n=>n.g).filter(Boolean))];
const tint=g=>'var(--t'+(Math.max(0,tags().indexOf(g))%4)+')';

const V=2;
const uid=()=>(crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2,10));
function norm(n){if(n.v===V)return false;
  if(!n.x){n.k=n.k||'soz';['t','b','w','g'].forEach(f=>n[f]=n[f]||'');n.f=!!n.f;n.c=n.c||(typeof n.id==='number'?n.id:Date.now())}
  n.m=n.m||n.c||Date.now();n.v=V;return true}
function merge(list){const m=new Map(D.notes.map(n=>[n.id,n])),ch=[];
  list.forEach(n=>{if(!n||typeof n!=='object'||n.id==null)return;norm(n);const o=m.get(n.id);if(!o||n.m>o.m){m.set(n.id,n);ch.push(n)}});
  D.notes=[...m.values()];return ch}
async function snap(){await idb('readwrite',s=>s.put({k:'last',notes:D.notes}),'s');D.snapT=Date.now();save()}
async function undoRestore(){const r=await idb('readonly',s=>s.get('last'),'s');if(!r)return toast('Geri dönülecek kayıt yok');
  D.notes=r.notes;await idb('readwrite',s=>{s.clear();r.notes.forEach(x=>s.put(x))});D.snapT=0;save();render();toast('Önceki hâle dönüldü')}
