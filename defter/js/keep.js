/* Keep (Google Takeout) içe aktarma */
const KEEP_ACCEPT='.zip,.json,application/zip,application/x-zip-compressed,application/json';
function keepPanel(a){
  const p=el('div','panel');p.append(el('h2','','Keep’ten aktar'));
  p.append(el('p','','Google Takeout’tan indirdiğin Keep zip dosyasını seç. Aktarmadan önce hangi etiketleri alacağını sen seçersin.'));
  const r=el('div','row'),b=el('button','btn','Takeout dosyasını seç');
  b.onclick=()=>{const i=document.createElement('input');i.type='file';i.accept=KEEP_ACCEPT;i.multiple=true;i.onchange=()=>{if(i.files.length)keepStart([...i.files])};i.click()};
  r.append(b);p.append(r);a.append(p)}

const u16=(v,o)=>v.getUint16(o,true),u32=(v,o)=>v.getUint32(o,true);
async function zipEntries(file){
  const tail=await file.slice(Math.max(0,file.size-66000)).arrayBuffer(),tv=new DataView(tail);let e=-1;
  for(let i=tail.byteLength-22;i>=0;i--){if(u32(tv,i)===0x06054b50){e=i;break}}
  if(e<0)throw new Error('Bu bir zip dosyası gibi görünmüyor.');
  const n=u16(tv,e+10),cdSize=u32(tv,e+12),cdOff=u32(tv,e+16);
  if(n===0xFFFF||cdOff===0xFFFFFFFF)throw new Error('Bu zip çok büyük (zip64). Takeout’u daha küçük parçalar hâlinde indir.');
  const cd=await file.slice(cdOff,cdOff+cdSize).arrayBuffer(),v=new DataView(cd),dec=new TextDecoder(),out=[];let p=0;
  for(let k=0;k<n&&p+46<=cd.byteLength;k++){
    if(u32(v,p)!==0x02014b50)break;
    const nl=u16(v,p+28),xl=u16(v,p+30),cl=u16(v,p+32);
    out.push({name:dec.decode(new Uint8Array(cd,p+46,nl)),m:u16(v,p+10),cs:u32(v,p+20),off:u32(v,p+42)});
    p+=46+nl+xl+cl}
  return out}
async function zipRead(file,e){
  if(e.cs===0xFFFFFFFF||e.off===0xFFFFFFFF)throw new Error('zip64');
  const h=new DataView(await file.slice(e.off,e.off+30).arrayBuffer());
  if(u32(h,0)!==0x04034b50)throw new Error('bozuk zip');
  const s=e.off+30+u16(h,26)+u16(h,28),raw=file.slice(s,s+e.cs);
  if(e.m===0)return await raw.text();
  if(e.m!==8)throw new Error('desteklenmeyen sıkıştırma');
  return await new Response(raw.stream().pipeThrough(new DecompressionStream('deflate-raw'))).text()}

const isKeep=o=>o&&typeof o==='object'&&!Array.isArray(o)&&('textContent' in o||'listContent' in o||'title' in o);
function keepHash(s){let h=5381;for(let i=0;i<s.length;i++)h=((h<<5)+h+s.charCodeAt(i))|0;return(h>>>0).toString(36)}
function keepParse(o){
  const str=v=>typeof v==='string'?v:'';
  let t=str(o.title).trim(),b=str(o.textContent).replace(/\r/g,'').trim();
  if(Array.isArray(o.listContent)&&o.listContent.length){
    const l=o.listContent.map(x=>x&&x.text?(x.isChecked?'☑ ':'☐ ')+x.text:'').filter(Boolean).join('\n');
    if(l)b=b?b+'\n\n'+l:l}
  let w='';const ps=b.split(/\n\s*\n/).map(s=>s.trim()).filter(Boolean);
  if(ps.length>=2&&/^["“”‘'«]/.test(ps[0])){const last=ps[ps.length-1];
    if(!/\n/.test(last)&&last.length<=60&&!/[.!?…:;]$/.test(last)){w=last.replace(/^[-–—~\s]+/,'');b=ps.slice(0,-1).join('\n\n')}}
  if(!b&&t){b=t;t=''}
  const us=v=>{v=Number(v);return v>0?Math.floor(v/1000):0};
  const c=us(o.createdTimestampUsec)||us(o.userEditedTimestampUsec)||Date.now(),m=us(o.userEditedTimestampUsec)||c;
  const labels=(Array.isArray(o.labels)?o.labels:[]).map(l=>l&&str(l.name).trim()).filter(Boolean);
  return{id:'keep-'+(o.createdTimestampUsec?String(o.createdTimestampUsec):keepHash(t+'|'+b)),t:t.slice(0,300),b:b.slice(0,50000),w:w.slice(0,200),
    labels:[...new Set(labels)],pin:!!o.isPinned,trash:!!o.isTrashed,arch:!!o.isArchived,att:Array.isArray(o.attachments)?o.attachments.length:0,c,m,empty:!b}}

function keepDialog(){
  let d=$('#kp');if(!d){d=document.createElement('dialog');d.id='kp';document.body.append(d)}
  const body=el('div','sheet');d.replaceChildren(body);if(!d.open)d.showModal();
  const o={d,body,cancelled:false,close(){o.cancelled=true;d.close()},
    msg(t,fin){body.replaceChildren(el('h2','','Keep’ten aktar'),el('p','',t));const r=el('div','row'),b=el('button','btn g',fin?'Kapat':'Vazgeç');b.onclick=o.close;r.append(b);body.append(r)}};
  return o}

async function keepStart(files){
  const dlg=keepDialog();dlg.msg('Dosya okunuyor…');
  try{
    const raw=[];let bad=0;
    for(const f of files){
      if(dlg.cancelled)return;
      if(/\.zip$/i.test(f.name)||/zip/.test(f.type)){
        if(typeof DecompressionStream==='undefined')throw new Error('Bu tarayıcı zip dosyası açamıyor. Zip’i ayıklayıp içindeki .json dosyalarını seç.');
        const es=(await zipEntries(f)).filter(e=>/\.json$/i.test(e.name));
        for(let i=0;i<es.length;i++){
          if(dlg.cancelled)return;
          try{raw.push(JSON.parse(await zipRead(f,es[i])))}catch(x){bad++}
          if(i%20===0){dlg.msg('Okunuyor… '+(i+1)+' / '+es.length);await new Promise(r=>setTimeout(r))}}
      }else{try{raw.push(JSON.parse(await f.text()))}catch(x){bad++}}}
    if(raw.some(o=>o&&o.app==='defter')){dlg.msg('Bu bir Defter yedeği. Onu “Yedekten geri yükle” düğmesiyle geri yükleyebilirsin.',1);return}
    const seen=new Map(),notes=raw.filter(isKeep).map(keepParse);
    notes.forEach(n=>{const k=seen.get(n.id)||0;seen.set(n.id,k+1);if(k)n.id+='-'+(k+1)});
    if(!notes.length){dlg.msg('Bu dosyada Keep notu bulunamadı. Takeout’ta yalnızca Keep’in seçili olduğundan emin ol.',1);return}
    keepReview(dlg,notes,bad)
  }catch(e){dlg.msg((e&&e.message)||'Dosya okunamadı.',1)}}

function keepReview(dlg,notes,bad){
  const NONE='\u0000',opt={trash:false,arch:true},sel=new Set(),risky=s=>/pass|şifre|sifre|parola/i.test(s);
  const names=[...new Set(notes.flatMap(n=>n.labels))].sort((a,b)=>a.localeCompare(b,'tr'));
  names.forEach(l=>{if(!risky(l))sel.add(l)});sel.add(NONE);
  const vis=n=>!n.empty&&(opt.trash||!n.trash)&&(opt.arch||!n.arch);
  const pick=()=>notes.filter(n=>vis(n)&&n.labels.every(l=>!risky(l)||sel.has(l))&&(n.labels.length?n.labels.some(l=>sel.has(l)):sel.has(NONE)));
  const cnt=k=>notes.filter(n=>vis(n)&&(k===NONE?!n.labels.length:n.labels.includes(k))).length;
  const build=n=>({id:n.id,k:n.labels.some(l=>/makale/i.test(l))?'makale':'soz',t:n.t,b:n.b,w:n.w,g:n.labels.find(l=>sel.has(l))||n.labels[0]||'',f:n.pin,c:n.c,m:n.m,v:V,...(n.trash?{d:Date.now()}:{})});
  const chk=(txt,on,fn)=>{const l=el('label','kr'),c=document.createElement('input');c.type='checkbox';c.checked=on;c.onchange=()=>fn(c.checked);const n=el('small');l.append(c,el('span','',txt),n);return{l,n}};
  const B=dlg.body;B.replaceChildren(el('h2','','Keep’ten aktar'));
  const empty=notes.filter(n=>n.empty).length,tr=notes.filter(n=>n.trash).length,at=notes.filter(n=>n.att).length;
  const inf=[notes.length+' not bulundu'];if(bad)inf.push(bad+' dosya okunamadı');if(empty)inf.push(empty+' not boş (alınmaz)');if(tr)inf.push(tr+' not çöp kutusunda');if(at)inf.push(at+' notta ek var (ekler aktarılmaz)');
  const p=el('p','',inf.join(' · ')+'.');p.style.cssText='margin:0;color:var(--mute);font-size:14px';B.append(p,el('b','','Hangi etiketler alınsın?'));
  const rows=names.map(l=>({key:l,...chk(l,sel.has(l),on=>{on?sel.add(l):sel.delete(l);upd()})}));
  if(notes.some(n=>!n.labels.length))rows.push({key:NONE,...chk('Etiketsiz notlar',true,on=>{on?sel.add(NONE):sel.delete(NONE);upd()})});
  rows.forEach(r=>{B.append(r.l);if(r.key!==NONE&&risky(r.key))B.append(el('div','kw','Şifre içerebilir, bu yüzden varsayılan olarak seçili değil.'))});
  const o1=chk('Çöp kutusundaki notları da al',false,on=>{opt.trash=on;upd()}),o2=chk('Arşivlenmiş notları da al',true,on=>{opt.arch=on;upd()});
  B.append(o1.l,o2.l,el('b','','Örnek önizleme'));
  const pv=el('div'),tot=el('p','');tot.style.cssText='margin:0;font-weight:600';B.append(pv,tot);
  const prev=n=>{const x=build(n),d=el('div','kv');if(x.t)d.append(el('small','',x.t));d.append(el('b','',x.b.length>140?x.b.slice(0,140)+'…':x.b));
    d.append(el('small','',(x.w?'Yazar: '+x.w+' · ':'')+'Etiket: '+(x.g||'yok')+' · '+(x.k==='makale'?'Makale':'Özlü söz')+(x.f?' · Favori':'')));return d};
  function upd(){rows.forEach(r=>r.n.textContent=cnt(r.key));const ps=pick();pv.replaceChildren(...ps.slice(0,3).map(prev));tot.textContent='Aktarılacak not: '+ps.length}
  const r=el('div','row'),x=el('button','btn g','Vazgeç'),go=el('button','btn','Aktar');x.onclick=dlg.close;r.append(x,go);B.append(r);
  go.onclick=async()=>{
    const ps=pick();if(!ps.length){toast('Aktarılacak not seçilmedi');return}
    const list=ps.map(build);dlg.msg('Aktarılıyor…');
    try{await snap();const ch=merge(list);await putAll(ch);save();render();
      const lines=[ch.length+' not aktarıldı.'];if(list.length-ch.length)lines.push((list.length-ch.length)+' not zaten vardı, dokunulmadı.');
      const a=ps.filter(n=>n.att).length,m=ps.filter(n=>n.labels.length>1).length;
      if(a)lines.push(a+' notun eki (resim, ses) aktarılmadı.');if(m)lines.push(m+' notun birden fazla etiketi vardı, yalnızca biri alındı.');
      lines.push('Beğenmezsen Yedek sekmesinden “Son geri yüklemeyi geri al” ile önceki hâle dönebilirsin.');
      B.replaceChildren(el('h2','','Aktarma tamam'),...lines.map(t=>el('p','',t)));const q=el('div','row'),k=el('button','btn','Tamam');k.onclick=dlg.close;q.append(k);B.append(q);
    }catch(e){dlg.msg('Aktarma sırasında bir sorun oldu. Notların bozulmadı. Yedek sekmesindeki “Son geri yüklemeyi geri al” ile eski hâle dönebilirsin.',1)}};
  upd()}
