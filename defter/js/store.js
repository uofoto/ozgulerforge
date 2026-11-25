const KEY='defter-v1',P={home:'M3 11l9-8 9 8M5 10v10h14V10',arc:'M3 4h18v4H3zM5 8v12h14V8M10 12h4',cloud:'M7 18a4 4 0 0 1-.5-8 6 6 0 0 1 11.5 1.5A3.5 3.5 0 0 1 17.5 18z',set:'M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0',plus:'M12 5v14M5 12h14',star:'M12 3l2.8 5.8 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.3l1-6.2L3 9.7l6.2-.9z',search:'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-5-5',trash:'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3'};
const ic=n=>{const s=document.createElementNS('http://www.w3.org/2000/svg','svg');s.setAttribute('viewBox','0 0 24 24');s.setAttribute('class','i');s.setAttribute('aria-hidden','true');const p=document.createElementNS(s.namespaceURI,'path');p.setAttribute('d',P[n]);s.append(p);return s};
const $=s=>document.querySelector(s);
function el(t,c,x){const e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e}
let D={notes:[],set:{theme:'auto',size:1,time:'09:00'},lastBackup:0};
const META='defter-meta';
try{const m=JSON.parse(localStorage.getItem(META)||'null');if(m)D=Object.assign(D,m)}catch(e){}
let db=null;
const idb=(m,f,st='n')=>new Promise((ok,no)=>{const t=db.transaction(st,m),r=f(t.objectStore(st));t.oncomplete=()=>ok(r&&r.result);t.onerror=()=>no(t.error)});
const openDB=()=>new Promise((ok,no)=>{const r=indexedDB.open('defter',2);r.onupgradeneeded=()=>{const d=r.result;if(!d.objectStoreNames.contains('n'))d.createObjectStore('n',{keyPath:'id'});if(!d.objectStoreNames.contains('s'))d.createObjectStore('s',{keyPath:'k'})};r.onsuccess=()=>{db=r.result;db.onversionchange=()=>db.close();ok()};r.onerror=()=>no(r.error)});
function save(n){if(n&&db)idb('readwrite',s=>s.put(n)).then(()=>bc&&bc.postMessage(1)).catch(()=>toast('Kayıt yapılamadı'));if(n&&!db)D.mem=true;try{localStorage.setItem(META,JSON.stringify({set:D.set,lastBackup:D.lastBackup,snapT:D.snapT,autoT:D.autoT}))}catch(e){}}
const remove=n=>db&&idb('readwrite',s=>s.delete(n.id));
const putAll=a=>db&&idb('readwrite',s=>{a.forEach(x=>s.put(x))});
async function loadNotes(){
  try{await openDB();D.notes=await idb('readonly',s=>s.getAll());
    const dead=D.notes.filter(n=>n.x&&Date.now()-n.x>7776e6);if(dead.length){D.notes=D.notes.filter(n=>!dead.includes(n));await idb('readwrite',s=>{dead.forEach(n=>s.delete(n.id))})}
    const ch=D.notes.filter(norm);if(ch.length)await putAll(ch);
    if(D.notes.length&&Date.now()-(D.autoT||0)>864e5){await idb('readwrite',s=>s.put({k:'auto',notes:D.notes}),'s');D.autoT=Date.now();save()}
    const old=JSON.parse(localStorage.getItem('defter-v1')||'null');
    if(old&&Array.isArray(old.notes)){const ids=new Set(D.notes.map(n=>n.id)),add=old.notes.filter(n=>!ids.has(n.id));add.forEach(norm);await putAll(add);D.notes=D.notes.concat(add);if(old.set)D.set=old.set;if(old.lastBackup)D.lastBackup=old.lastBackup;save();localStorage.removeItem('defter-v1')}
    if(navigator.storage&&navigator.storage.persist)navigator.storage.persist();
  }catch(e){D.notes=[];D.mem=true}
}
let LIM=30,view='home',tag='Tümü',q='',sub='fav',cur=null,kind='soz',hi=0;
function toast(m,lb,fn){const d=el('div','toast',m);if(lb){const b=el('button','',lb);b.style.cssText='margin-left:12px;font-weight:600;text-decoration:underline';b.onclick=()=>{d.remove();fn()};d.append(b)}document.body.append(d);setTimeout(()=>d.remove(),lb?5000:1800)}
function applySet(){const r=document.documentElement,t=D.set.theme;if(t==='auto')r.removeAttribute('data-theme');else r.setAttribute('data-theme',t);r.style.setProperty('--fs',D.set.size)}
const live=()=>D.notes.filter(n=>!n.d&&!n.x);
const tags=()=>[...new Set(live().map(n=>n.g).filter(Boolean))];
const tint=g=>'var(--t'+(Math.max(0,tags().indexOf(g))%4)+')';

const V=2;
const uid=()=>(crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2,10));
function norm(n){if(n.v===V)return false;
  if(!n.x){n.k=n.k==='makale'?'makale':'soz';['t','b','w','g'].forEach(f=>n[f]=n[f]==null?'':String(n[f]));n.f=!!n.f;n.c=n.c||(typeof n.id==='number'?n.id:Date.now())}
  n.m=+n.m||+n.c||Date.now();n.v=V;return true}
function merge(list){const m=new Map(D.notes.map(n=>[n.id,n])),ch=[];
  list.forEach(n=>{if(!n||typeof n!=='object'||n.id==null||!/^(string|number)$/.test(typeof n.id))return;n.v=0;norm(n);const o=m.get(n.id);if(!o||n.m>o.m){m.set(n.id,n);ch.push(n)}});
  D.notes=[...m.values()];return ch}
async function snap(){await idb('readwrite',s=>s.put({k:'last',notes:D.notes}),'s');D.snapT=Date.now();save()}
async function undoRestore(k='last'){if(k==='auto'&&!confirm('Tüm notlar otomatik kopyadaki hâle dönecek. Devam edilsin mi?'))return;const r=await idb('readonly',s=>s.get(k),'s');if(!r)return toast('Geri dönülecek kayıt yok');if(k==='auto')await snap();
  D.notes=r.notes;await idb('readwrite',s=>{s.clear();r.notes.forEach(x=>s.put(x))});D.snapT=0;save();render();toast('Önceki hâle dönüldü')}

const bc=window.BroadcastChannel?new BroadcastChannel('defter'):null;
if(bc)bc.onmessage=async()=>{if(!db||$('#ed').open)return;try{D.notes=await idb('readonly',s=>s.getAll());render()}catch(e){}};
function render(){try{draw()}catch(e){crash(e)}}
function crash(e){console.error(e);const a=$('#app');a.replaceChildren();const p=el('div','panel');
  p.append(el('h2','','Bir şey ters gitti'),el('p','','Notların güvende. Yedeği indirebilir ya da sayfayı yenileyebilirsin.'));
  const r=el('div','row'),x=el('button','btn g','Yedeği indir'),y=el('button','btn','Yeniden yükle');
  x.onclick=()=>{try{exp()}catch(_){}};y.onclick=()=>location.reload();r.append(x,y);p.append(r);a.append(p)}
const warn=()=>{if(!document.querySelector('.toast'))toast('Beklenmedik bir sorun oldu')};
addEventListener('error',e=>{if(e.message)warn()});addEventListener('unhandledrejection',warn);
