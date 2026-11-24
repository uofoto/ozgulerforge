function exp(){const j=JSON.stringify({app:'defter',v:V,date:new Date().toISOString(),notes:D.notes,set:D.set},null,1);
  const a=el('a');a.href=URL.createObjectURL(new Blob([j],{type:'application/json'}));a.download='defter-yedek-'+new Date().toISOString().slice(0,10)+'.json';document.body.append(a);a.click();a.remove();
  D.lastBackup=Date.now();save();render();toast('Yedek indirildi')}
$('#file').onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();
  r.onload=async()=>{try{const j=JSON.parse(r.result);if(j.app!=='defter'||!Array.isArray(j.notes))throw 0;
    if((j.v||1)>V){toast('Bu yedek daha yeni bir Defter sürümünden');return}
    await snap();const ch=merge(j.notes);await putAll(ch);save();render();toast(ch.length+' not geri yüklendi')}
  catch(x){toast('Bu dosya bir Defter yedeği değil')}finally{e.target.value=''}};r.readAsText(f)};
