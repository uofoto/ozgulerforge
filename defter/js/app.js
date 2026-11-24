function setKind(k){kind=k;document.querySelectorAll('#kseg button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.k===k));$('#url').hidden=$('#rdl').hidden=k!=='makale';$('#body').placeholder=k==='soz'?'Sözü yaz':'Makale notunu ya da özetini yaz'}
document.querySelectorAll('#kseg button').forEach(b=>b.onclick=()=>setKind(b.dataset.k));
function openEd(n){cur=n||null;$('#edt').textContent=n?(n.d?'Çöp kutusundaki not':'Notu düzenle'):'Yeni not';
  $('#title').value=n?n.t:'';$('#body').value=n?n.b:'';$('#who').value=n?n.w:'';$('#url').value=n&&n.u||'';$('#rd').checked=!!(n&&n.r);$('#tag').value=n?n.g:(tag!=='Tümü'?tag:'');
  setKind(n?n.k:'soz');const d=$('#del');d.hidden=!n;d.textContent=n&&n.d?'Kalıcı sil':'Çöpe taşı';$('#save').textContent=n&&n.d?'Geri al':'Kaydet';$('#ed').showModal()}
$('#add').onclick=()=>openEd();$('#add').append(ic('plus'));
$('#cancel').onclick=()=>$('#ed').close();
$('#save').onclick=()=>{
  if(cur&&cur.d){delete cur.d;cur.m=Date.now();save(cur);$('#ed').close();render();toast('Geri alındı');return}
  const b=$('#body').value.trim();if(!b){toast('Metin boş olamaz');return}
  const u=$('#url').value.trim(),o={k:kind,t:$('#title').value.trim(),b,w:$('#who').value.trim(),g:$('#tag').value.trim(),u:kind==='makale'?u:'',r:kind==='makale'&&$('#rd').checked?(cur&&cur.r||Date.now()):0,m:Date.now()};
  let nn=cur;if(cur)Object.assign(cur,o);else{nn={id:Date.now(),c:Date.now(),f:false,...o};D.notes.push(nn)}
  save(nn);$('#ed').close();render();toast('Kaydedildi')};
$('#del').onclick=()=>{const perm=!!cur.d;if(perm){D.notes=D.notes.filter(n=>n!==cur);remove(cur)}else{cur.d=Date.now();save(cur)}$('#ed').close();render();toast(perm?'Kalıcı olarak silindi':'Çöpe taşındı')};
if('serviceWorker' in navigator&&(location.protocol==='https:'||location.hostname==='localhost'))navigator.serviceWorker.register('sw.js').catch(()=>{});
applySet();loadNotes().then(render);
