/* Cloudflare eşitleme: uçtan uca şifreli, artımlı */
const CLOUD_BATCH=100;
let C=null,cBusy=false,cAgain=false,cTimer=0;
const te=new TextEncoder(),td=new TextDecoder();
const b64=u=>{let s='';for(let i=0;i<u.length;i+=8192)s+=String.fromCharCode.apply(null,u.subarray(i,i+8192));return btoa(s)};
const unb64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
async function deriveKey(pass,salt){
  const km=await crypto.subtle.importKey('raw',te.encode(pass),'PBKDF2',false,['deriveKey']);
  return crypto.subtle.deriveKey({name:'PBKDF2',salt:unb64(salt),iterations:250000,hash:'SHA-256'},km,{name:'AES-GCM',length:256},false,['encrypt','decrypt'])}
async function seal(key,obj,aad){
  const iv=crypto.getRandomValues(new Uint8Array(12)),ct=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:te.encode(aad)},key,te.encode(JSON.stringify(obj))));
  const o=new Uint8Array(12+ct.length);o.set(iv);o.set(ct,12);return b64(o)}
async function unseal(key,s,aad){
  const u=unb64(s);return JSON.parse(td.decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:u.slice(0,12),additionalData:te.encode(aad)},key,u.slice(12))))}

async function capi(cfg,path,body){
  const ac=new AbortController(),t=setTimeout(()=>ac.abort(),30000);
  try{
    const r=await fetch(cfg.url+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+cfg.token,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:ac.signal,cache:'no-store'});
    if(r.status===401)throw new Error('Erişim anahtarı reddedildi. Cloudflare’deki SYNC_TOKEN ile aynı olmalı.');
    if(!r.ok){let m='';try{m=(await r.json()).error}catch(e){}throw new Error('Sunucu hatası ('+r.status+')'+(m?': '+m:''))}
    return await r.json()
  }catch(e){
    if(e.name==='AbortError')throw new Error('Bağlantı zaman aşımına uğradı.');
    if(e instanceof TypeError)throw new Error('Sunucuya ulaşılamadı. İnterneti ve adresi kontrol et.');
    throw e
  }finally{clearTimeout(t)}}

async function cloudInit(){
  try{C=await idb('readonly',s=>s.get('cloud'),'s')||null}catch(e){C=null}
  if(C&&!D.cloud)D.cloud={pushT:0,rev:0,last:0}}
async function cloudConnect(url,token,pass){
  url=url.trim().replace(/\/+$/,'');
  if(!/^https:\/\//i.test(url)&&!/^http:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/i.test(url))throw new Error('Adres https:// ile başlamalı.');
  if(token.length<24)throw new Error('Erişim anahtarı en az 24 karakter olmalı. “Anahtar üret” düğmesini kullanabilirsin.');
  if(pass.length<8)throw new Error('Parola en az 8 karakter olmalı.');
  const cfg={url,token},inf=await capi(cfg,'/api/info');let salt=inf.salt,check=inf.check,key;
  if(!salt){
    salt=b64(crypto.getRandomValues(new Uint8Array(16)));key=await deriveKey(pass,salt);
    const r=await capi(cfg,'/api/init',{salt,check:await seal(key,{ok:'defter'},'check')});salt=r.salt;check=r.check}
  key=await deriveKey(pass,salt);
  try{if((await unseal(key,check,'check')).ok!=='defter')throw 0}catch(e){throw new Error('Parola yanlış. Bu yedek başka bir parolayla oluşturulmuş.')}
  C={k:'cloud',url,token,key,salt};await idb('readwrite',s=>s.put(C),'s');
  D.cloud={pushT:0,rev:0,last:0};save();return inf}

function cloudStatus(t,err){D.cloud=D.cloud||{};D.cloud.msg=t;D.cloud.err=!!err;const e=$('#cst');if(e){e.textContent=t;e.style.color=err?'#C0392B':'var(--mute)'}}
function cloudSoon(ms=4000){if(!C)return;clearTimeout(cTimer);cTimer=setTimeout(()=>cloudSync(),ms)}
addEventListener('online',()=>cloudSoon(800));
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')cloudSoon(800)});

async function cloudPass(S){
  const cl=D.cloud;let since=cl.rev,reset=false;
  const list=D.notes.filter(n=>n.m>cl.pushT).sort((a,b)=>a.m-b.m);
  for(let i=0;i<Math.max(list.length,1);i+=CLOUD_BATCH){
    const push=[];for(const n of list.slice(i,i+CLOUD_BATCH))push.push({id:String(n.id),m:n.m,d:await seal(C.key,n,String(n.id))});
    let r=await capi(C,'/api/sync',{since,push});S.up+=push.length;
    for(;;){
      reset=reset||!!r.reset;const got=[];
      for(const x of r.notes){try{const n=await unseal(C.key,x.d,x.id);if(String(n.id)===x.id)got.push(n);else S.bad++}catch(e){S.bad++}}
      if(got.length){const ch=merge(got);if(ch.length){await idb('readwrite',s=>{ch.forEach(n=>s.put(n))});S.down+=ch.length}}
      since=r.rev;if(!r.more)break;
      r=await capi(C,'/api/sync',{since,push:[]})}}
  cl.rev=since;return reset}
async function cloudSync(full){
  if(!C)return;
  if(cBusy){cAgain=true;return}
  if(!navigator.onLine){cloudStatus('Çevrimdışı. İnternet gelince eşitlenecek.');return}
  cBusy=true;cAgain=false;cloudStatus('Eşitleniyor…');const T=Date.now(),S={up:0,down:0,bad:0},cl=D.cloud=D.cloud||{pushT:0,rev:0,last:0};
  try{
    if(full){await snap();cl.rev=0}
    if(await cloudPass(S)){cl.pushT=0;await cloudPass(S)}
    cl.pushT=T;cl.last=Date.now();
    cloudStatus('Eşitlendi · '+new Date().toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'})+' · '+S.up+' gönderildi, '+S.down+' alındı'+(S.bad?' · '+S.bad+' kayıt açılamadı':''));
    save();
    if(S.down){bc&&bc.postMessage(1);if(!$('#ed').open)render()}
  }catch(e){cloudStatus((e&&e.message)||'Eşitleme başarısız.',true);save()}
  finally{cBusy=false;if(cAgain)cloudSoon(500)}}

function cloudPanel(a){
  const p=el('div','panel');p.append(el('h2','','Cloudflare yedeği'));
  if(!C){
    p.append(el('p','','Notların şifrelenerek kendi Cloudflare hesabına eşitlenir. Cloudflare yalnızca şifreli veriyi görür. Telefonu ve bilgisayarı aynı yedeğe bağlayabilirsin.'));
    const r=el('div','row'),b=el('button','btn','Bağlan');b.onclick=cloudDialog;r.append(b);p.append(r)
  }else{
    let host='';try{host=new URL(C.url).host}catch(e){}
    p.append(el('p','','Bağlı: '+host));
    const st=el('p','',(D.cloud&&D.cloud.msg)||'');st.id='cst';if(D.cloud&&D.cloud.err)st.style.color='#C0392B';p.append(st);
    const r=el('div','row'),s=el('button','btn','Şimdi eşitle'),f=el('button','btn g','Buluttan yeniden al'),c=el('button','btn g','Bilgiyi kopyala'),x=el('button','btn g','Bağlantıyı kes');
    s.onclick=()=>cloudSync();
    f.onclick=()=>{if(confirm('Buluttaki tüm notlar yeniden alınıp bu cihazdakilerle birleştirilecek. İstersen sonra “geri al” diyebilirsin. Devam edilsin mi?'))cloudSync(true)};
    c.onclick=()=>{try{navigator.clipboard.writeText(C.url+'\n'+C.token);toast('Adres ve anahtar kopyalandı. Parola dahil değil.')}catch(e){toast('Kopyalanamadı')}};
    x.onclick=async()=>{if(!confirm('Bu cihazın bulutla bağlantısı kesilecek. Notların cihazda kalır, buluttaki yedek silinmez. Devam edilsin mi?'))return;
      try{await idb('readwrite',s=>s.delete('cloud'),'s')}catch(e){}C=null;D.cloud=null;save();render();toast('Bağlantı kesildi')};
    r.append(x,c,f,s);p.append(r)}
  a.append(p)}

function cloudDialog(){
  let d=$('#cd');if(!d){d=document.createElement('dialog');d.id='cd';document.body.append(d)}
  const B=el('div','sheet');d.replaceChildren(B);
  const fld=(ph,type)=>{const i=el('input','f');i.placeholder=ph;i.type=type||'text';i.autocomplete='off';i.spellcheck=false;i.setAttribute('aria-label',ph);return i};
  const url=fld('Worker adresi (https://…workers.dev)','url'),tok=fld('Erişim anahtarı'),pw=fld('Şifreleme parolası','password');
  const msg=el('p','');msg.style.cssText='margin:0;font-size:14px;color:#C0392B';
  const gen=el('button','btn g','Anahtar üret'),cp=el('button','btn g','Kopyala'),kr=el('div','row');kr.style.justifyContent='flex-start';kr.append(gen,cp);
  gen.onclick=()=>{tok.value=[...crypto.getRandomValues(new Uint8Array(32))].map(x=>x.toString(16).padStart(2,'0')).join('');toast('Anahtar üretildi. Aynısını Cloudflare’de SYNC_TOKEN olarak kaydet.')};
  cp.onclick=()=>{try{navigator.clipboard.writeText(tok.value);toast('Kopyalandı')}catch(e){tok.select();document.execCommand('copy')}};
  const info=el('p','','Parola notlarını şifreler. Hiçbir yere gönderilmez ve cihazda saklanmaz. Unutursan buluttaki yedek açılamaz, bu yüzden güvenli bir yere yaz.');info.style.cssText='margin:0;font-size:13.5px;color:var(--mute)';
  const r=el('div','row'),x=el('button','btn g','Vazgeç'),go=el('button','btn','Bağlan');x.onclick=()=>d.close();r.append(x,go);
  B.append(el('h2','','Cloudflare’e bağlan'),url,tok,kr,pw,info,msg,r);
  go.onclick=async()=>{msg.textContent='';go.textContent='Bağlanıyor…';
    try{await cloudConnect(url.value,tok.value.trim(),pw.value);d.close();render();toast('Bağlandı');cloudSync(true)}
    catch(e){msg.textContent=(e&&e.message)||'Bağlanılamadı.'}
    finally{go.textContent='Bağlan'}};
  d.showModal()}
