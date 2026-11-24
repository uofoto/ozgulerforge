function exp(){const j=JSON.stringify({app:'defter',v:V,date:new Date().toISOString(),notes:D.notes,set:D.set},null,1);
  const a=el('a');a.href=URL.createObjectURL(new Blob([j],{type:'application/json'}));a.download='defter-yedek-'+new Date().toISOString().slice(0,10)+'.json';document.body.append(a);a.click();a.remove();
  D.lastBackup=Date.now();save();render();toast('Yedek indirildi')}
$('#file').onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();
  r.onload=async()=>{try{const j=JSON.parse(r.result);if(j.app!=='defter'||!Array.isArray(j.notes))throw 0;
    if((j.v||1)>V){toast('Bu yedek daha yeni bir Defter sürümünden');return}
    await snap();const ch=merge(j.notes);await putAll(ch);save();render();toast(ch.length+' not geri yüklendi')}
  catch(x){toast('Bu dosya bir Defter yedeği değil')}finally{e.target.value=''}};r.readAsText(f)};

const b64=u=>{let s='';const b=new Uint8Array(u);for(let i=0;i<b.length;i++)s+=String.fromCharCode(b[i]);return btoa(s)};
const ub64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
async function deriveKey(pass,salt){
  const enc=new TextEncoder();
  const base=await crypto.subtle.importKey('raw',enc.encode(pass),'PBKDF2',false,['deriveKey']);
  return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:150000,hash:'SHA-256'},base,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
async function encPack(obj,pass){
  const salt=crypto.getRandomValues(new Uint8Array(16));
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const key=await deriveKey(pass,salt);
  const data=new TextEncoder().encode(JSON.stringify(obj));
  const ct=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,data);
  return {alg:'AES-GCM',v:1,salt:b64(salt),iv:b64(iv),ct:b64(ct)};
}
async function decPack(pkg,pass){
  if(!pkg||pkg.alg!=='AES-GCM'||!pkg.salt||!pkg.iv||!pkg.ct)throw new Error('Geçersiz paket');
  const key=await deriveKey(pass,ub64(pkg.salt));
  const pt=await crypto.subtle.decrypt({name:'AES-GCM',iv:ub64(pkg.iv)},key,ub64(pkg.ct));
  return JSON.parse(new TextDecoder().decode(pt));
}
function cfCfg(){
  const url=(D.cf.url||'').replace(/\/+$/,'');
  const key=(D.cf.key||'').trim();
  const pass=D.cf.pass||'';
  if(!url||!/^https?:\/\//.test(url)){toast('Geçerli bir Worker adresi gir');return null}
  if(!key){toast('Erişim anahtarını gir');return null}
  if(pass.length<6){toast('Şifreleme parolası en az 6 karakter olmalı');return null}
  return {url,key,pass};
}
async function cfPush(){
  const cfg=cfCfg();if(!cfg)return;
  cfBusy=true;render();
  try{
    const payload={app:'defter',v:V,date:new Date().toISOString(),notes:D.notes,set:D.set};
    const body=await encPack(payload,cfg.pass);
    const res=await fetch(cfg.url+'/backup',{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+cfg.key},
      body:JSON.stringify(body)
    });
    if(!res.ok)throw new Error('HTTP '+res.status);
    D.cf.lastCloud=Date.now();save();toast('Buluta şifreli yedeklendi');
  }catch(e){toast('Bulut yedekleme başarısız: '+(e.message||'bağlantı hatası'))}
  finally{cfBusy=false;render()}
}
async function cfPull(){
  const cfg=cfCfg();if(!cfg)return;
  cfBusy=true;render();
  try{
    const res=await fetch(cfg.url+'/backup',{
      headers:{'Authorization':'Bearer '+cfg.key}
    });
    if(res.status===404){toast('Bulutta henüz yedek bulunamadı');return}
    if(!res.ok)throw new Error('HTTP '+res.status);
    const pkg=await res.json();
    let j;
    try{j=await decPack(pkg,cfg.pass)}catch(_){toast('Parola hatalı veya veri bozuk');return}
    if(j.app!=='defter'||!Array.isArray(j.notes)){toast('Geçersiz yedek içeriği');return}
    if((j.v||1)>V){toast('Bu yedek daha yeni bir Defter sürümünden');return}
    await snap();const ch=merge(j.notes);await putAll(ch);save();toast(ch.length+' not buluttan geri yüklendi');
  }catch(e){toast('Buluttan geri yükleme başarısız: '+(e.message||'bağlantı hatası'))}
  finally{cfBusy=false;render()}
}
