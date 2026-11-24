function safeUrl(u){if(!u)return'';try{const p=new URL(u.startsWith('http://')||u.startsWith('https://')?u:'https://'+u);return p.protocol==='http:'||p.protocol==='https:'?p.href:''}catch(e){return''}}
function hostOf(u){try{return new URL(u).hostname.replace(/^www\./,'')}catch(e){return u}}
function card(n){
  const c=el('div','card'+(n.k==='makale'?' mk':''));c.tabIndex=0;c.setAttribute('role','button');
  if(n.t)c.append(el('h3','',n.t));
  const lim=n.k==='makale'?260:200;
  c.append(el('p',n.k==='soz'?'q':'ex',n.b.length>lim?n.b.slice(0,lim)+'…':n.b));
  if(n.w)c.append(el('p','w',n.w));
  if(n.k==='makale'){
    const mt=el('div','meta');
    const st=el('span','badge'+(n.r?' done':''),n.r?'Okundu':'Okunacak');
    mt.append(st);
    const href=safeUrl(n.u);
    if(href){
      const a=el('a','ext');a.href=href;a.target='_blank';a.rel='noopener noreferrer';
      const icl=ic('link');icl.style.width='14px';icl.style.height='14px';
      a.append(icl,el('span','',hostOf(href)));
      a.onclick=e=>e.stopPropagation();
      mt.append(a);
    }
    c.append(mt);
  }
  const ft=el('div','ft');if(n.g){const t=el('span','tag',n.g);t.style.background=tint(n.g);ft.append(t)}else ft.append(el('span'));
  const dl=el('button','dl');dl.type='button';dl.setAttribute('aria-label',n.d?'Kalıcı sil':'Çöpe taşı');dl.append(ic('trash'));dl.onclick=e=>{e.stopPropagation();trashNote(n)};ft.append(dl);c.append(ft);
  if(!n.d){const s=el('button','star'+(n.f?' on':''));s.type='button';s.setAttribute('aria-label','Favori');s.append(ic('star'));s.onclick=e=>{e.stopPropagation();n.f=!n.f;n.m=Date.now();save(n);render()};c.append(s)}
  c.onclick=()=>openEd(n);c.onkeydown=e=>{if(e.key==='Enter'&&e.target===c)openEd(n)};return c}
function trashNote(n){
  if(n.d){if(!confirm('Bu not kalıcı olarak silinsin mi?'))return;const t={id:n.id,x:Date.now(),m:Date.now(),v:V};D.notes[D.notes.indexOf(n)]=t;save(t);render();toast('Kalıcı olarak silindi')}
  else{n.d=n.m=Date.now();save(n);render();toast('Çöpe taşındı','Geri al',()=>{delete n.d;n.m=Date.now();save(n);render()})}}
function grid(list,msg){const g=el('div','grid'),w=el('div');list.slice(0,LIM).forEach(n=>{try{g.append(card(n))}catch(e){}});w.append(g);if(!list.length)w.append(el('div','empty',msg));if(list.length>LIM){const b=el('button','btn g','Daha fazla göster ('+(list.length-LIM)+')');b.type='button';b.style.cssText='display:block;margin:6px auto 12px';b.onclick=()=>{LIM+=30;render()};w.append(b)}return w}
function hero(){
  const h=el('section','hero'),qs=live().filter(n=>n.k==='soz'),fv=qs.filter(n=>n.f),pool=fv.length?fv:qs;
  const lbl=hi===0?'Günün sözü':'Seçki';
  h.append(el('small','',new Date().toLocaleDateString('tr-TR',{day:'numeric',month:'long'})+' · '+lbl));
  if(!pool.length){h.append(el('blockquote','','İlk özlü sözünü ekle, burada her gün biri karşına çıksın.'));return h}
  const n=pool[(localDay()+hi)%pool.length];
  h.append(el('blockquote','',n.b));const by=el('div','by');by.append(el('span','',n.w||n.t||''));
  const acts=el('div','acts');
  if(hi!==0){const d=el('button','ghost','Günün sözü');d.type='button';d.onclick=()=>{hi=0;render()};acts.append(d)}
  const b=el('button','','Rastgele söz');b.type='button';b.onclick=()=>{hi=Math.floor(Math.random()*pool.length)+1;render()};acts.append(b);
  by.append(acts);h.append(by);return h}
function home(a){
  if(D.mem){const b=el('div','bn'),x=el('button','btn','Yedeği indir');x.type='button';b.append(el('span','','Bu tarayıcı kayıt saklamaya izin vermiyor. Çıkmadan önce yedeği indir.'));x.onclick=exp;b.append(x);a.append(b)}
  a.append(hero());
  const days=(Date.now()-Math.max(D.lastBackup||0,D.cf.lastCloud||0))/864e5;
  if(live().length&&days>7){const b=el('div','bn');b.append(el('span','',(D.lastBackup||D.cf.lastCloud)?Math.floor(days)+' gündür yedek almadın.':'Henüz yedek almadın.'));const x=el('button','btn','Yedeğe git');x.type='button';x.onclick=()=>go('bak');b.append(x);a.append(b)}
  const s=el('label','search');s.append(ic('search'));const i=el('input');i.type='search';i.placeholder='Söz, yazar, başlık veya makale ara';i.value=q;i.setAttribute('aria-label','Ara');
  const out=el('div');i.oninput=()=>{q=i.value;LIM=30;out.replaceChildren(list())};s.append(i);a.append(s);
  const kf=el('div','filters');
  [['all','Tümü'],['soz','Özlü sözler'],['makale','Makaleler'],['unread','Okunacaklar']].forEach(([v,l])=>{
    const b=el('button','fchip',l);b.type='button';b.setAttribute('aria-pressed',v===kflt);
    b.onclick=()=>{kflt=v;LIM=30;render()};kf.append(b);
  });
  a.append(kf);
  const c=el('div','chips');['Tümü',...tags()].forEach(t=>{const b=el('button','chip',t);b.type='button';b.setAttribute('aria-pressed',t===tag);b.onclick=()=>{tag=t;LIM=30;render()};c.append(b)});a.append(c);
  out.append(list());a.append(out)}
function list(){const s=q.trim().toLocaleLowerCase('tr');
  const r=live().filter(n=>{
    if(kflt==='soz'&&n.k!=='soz')return false;
    if(kflt==='makale'&&n.k!=='makale')return false;
    if(kflt==='unread'&&(n.k!=='makale'||n.r))return false;
    if(tag!=='Tümü'&&n.g!==tag)return false;
    if(s&&![n.t,n.b,n.w,n.g,n.u].join(' ').toLocaleLowerCase('tr').includes(s))return false;
    return true;
  }).sort((a,b)=>b.c-a.c);
  return grid(r,live().length?'Sonuç yok. Filtreyi veya aramayı değiştir.':'Henüz not yok. Sağ alttaki düğmeyle ilk notunu ekle.')}
function segs(a,items,val,fn){const s=el('div','seg');items.forEach(([v,l])=>{const b=el('button','',l);b.type='button';b.setAttribute('aria-pressed',v==val);b.onclick=()=>fn(v);s.append(b)});a.append(s)}
function arc(a){
  const h=el('div','top');h.append(el('h1','','Arşiv'));a.append(h);
  segs(a,[['fav','Favoriler'],['trash','Çöp kutusu']],sub,v=>{sub=v;LIM=30;render()});
  if(sub==='fav')a.append(grid(live().filter(n=>n.f).sort((a,b)=>b.m-a.m),'Henüz favorin yok. Kartın köşesindeki yıldıza dokun.'));
  else a.append(grid(D.notes.filter(n=>n.d&&!n.x).sort((a,b)=>b.d-a.d),'Çöp kutusu boş.'))}
function bak(a){
  const h=el('div','top');h.append(el('h1','','Yedek'));a.append(h);
  const p=el('div','panel');p.append(el('h2','','Bu cihaza yedekle'));
  p.append(el('p','',D.lastBackup?'Son yerel yedek: '+new Date(D.lastBackup).toLocaleString('tr-TR'):'Henüz yerel yedek almadın.'));
  const r=el('div','row'),b1=el('button','btn','Yedeği indir'),b2=el('button','btn g','Yedekten geri yükle');b1.type='button';b2.type='button';b1.onclick=exp;b2.onclick=()=>$('#file').click();r.append(b2,b1);if(D.snapT){const u=el('button','btn g','Son geri yüklemeyi geri al');u.type='button';u.onclick=()=>undoRestore();r.prepend(u)}if(D.autoT){const u2=el('button','btn g','Otomatik kopyaya dön ('+new Date(D.autoT).toLocaleDateString('tr-TR')+')');u2.type='button';u2.onclick=()=>undoRestore('auto');r.prepend(u2)}p.append(r);a.append(p);

  const c=el('div','panel');c.append(el('h2','','Cloudflare bulut yedeği'));
  c.append(el('p','',D.cf.lastCloud?'Son bulut yedeği: '+new Date(D.cf.lastCloud).toLocaleString('tr-TR')+' · Veriler cihazında AES-GCM ile şifrelenerek gönderilir.':'Verilerin tarayıcıda AES-GCM ile şifrelenir; Cloudflare Worker yalnızca şifreli paketi saklar.'));
  const fld=el('div','fld');
  const lu=el('label','', 'Worker adresi');const iu=el('input','f');iu.type='url';iu.placeholder='https://defter-yedek.kullanici.workers.dev';iu.value=D.cf.url||'';iu.oninput=()=>{D.cf.url=iu.value.trim();save()};lu.append(iu);
  const lk=el('label','', 'Erişim anahtarı (Bearer Token)');const ik=el('input','f');ik.type='password';ik.placeholder='Worker gizli anahtarı';ik.value=D.cf.key||'';ik.oninput=()=>{D.cf.key=ik.value.trim();save()};lk.append(ik);
  const lp=el('label','', 'Şifreleme parolası (uçtan uca)');const ip=el('input','f');ip.type='password';ip.placeholder='En az 6 karakter';ip.value=D.cf.pass||'';ip.oninput=()=>{D.cf.pass=ip.value;save()};lp.append(ip);
  fld.append(lu,lk,lp);c.append(fld);
  const cr=el('div','row');
  const cb2=el('button','btn g',cfBusy?'İşleniyor…':'Buluttan geri yükle');cb2.type='button';cb2.disabled=cfBusy;cb2.onclick=()=>cfPull();
  const cb1=el('button','btn',cfBusy?'İşleniyor…':'Buluta yedekle');cb1.type='button';cb1.disabled=cfBusy;cb1.onclick=()=>cfPush();
  cr.append(cb2,cb1);c.append(cr);a.append(c)}
function sett(a){
  const h=el('div','top');h.append(el('h1','','Ayarlar'));a.append(h);
  const p=el('div','panel');p.append(el('h2','','Görünüm'));
  segs(p,[['auto','Otomatik'],['light','Açık'],['dark','Koyu']],D.set.theme,v=>{D.set.theme=v;save();applySet();render()});
  p.append(el('p','','Yazı boyutu'));segs(p,[[0.9,'Küçük'],[1,'Normal'],[1.15,'Büyük']],D.set.size,v=>{D.set.size=v;save();applySet();render()});a.append(p)}
function draw(){
  const y=scrollY,a=$('#app');a.replaceChildren();
  if(view==='home'){const h=el('div','top'),d=el('div');d.append(el('h1','','Defter'),el('small','','Biriktirdiklerin burada'));h.append(d);a.append(h);home(a)}
  else if(view==='arc')arc(a);else if(view==='bak')bak(a);else sett(a);
  const n=$('#nav');n.replaceChildren();
  [['home','Ana sayfa','home'],['arc','Arşiv','arc'],['bak','Yedek','cloud'],['set','Ayarlar','set']].forEach(([v,l,i])=>{const b=el('button');b.type='button';b.append(ic(i),el('span','',l));if(v===view)b.setAttribute('aria-current','page');b.onclick=()=>go(v);n.append(b)});
  $('#tags').replaceChildren(...tags().map(t=>{const o=el('option');o.value=t;return o}));
  $('#add').hidden=view==='bak'||view==='set';scrollTo(0,y)}
function go(v){view=v;LIM=30;render();scrollTo(0,0)}
