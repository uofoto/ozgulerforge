function exp(){const j=JSON.stringify({app:'defter',v:1,date:new Date().toISOString(),notes:D.notes,set:D.set},null,1);
  const a=el('a');a.href=URL.createObjectURL(new Blob([j],{type:'application/json'}));a.download='defter-yedek-'+new Date().toISOString().slice(0,10)+'.json';document.body.append(a);a.click();a.remove();
  D.lastBackup=Date.now();save();render();toast('Yedek indirildi')}
$('#file').onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();
  r.onload=()=>{try{const j=JSON.parse(r.result);if(j.app!=='defter'||!Array.isArray(j.notes))throw 0;
    const m=new Map(D.notes.map(n=>[n.id,n]));j.notes.forEach(n=>{const o=m.get(n.id);if(!o||(n.m||0)>(o.m||0))m.set(n.id,n)});
    D.notes=[...m.values()];putAll(D.notes);save();render();toast(j.notes.length+' not işlendi')}catch(x){toast('Bu dosya bir Defter yedeği değil')}e.target.value=''};r.readAsText(f)};
