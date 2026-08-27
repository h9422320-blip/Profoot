import fs from 'node:fs';
for (const l of fs.readFileSync('.env.local','utf8').split('\n')) {
  const t=l.trim(); if(!t||t.startsWith('#'))continue;
  const i=t.indexOf('='); if(i<0)continue;
  process.env[t.slice(0,i)]=t.slice(i+1).replace(/^["']|["']$/g,'');
}
const cle = process.env.CHARIOW_API_KEY;
const appel = async (params) => {
  const u = new URL('https://api.chariow.com/v1/sales');
  for(const [k,v] of Object.entries(params)) u.searchParams.set(k,String(v));
  const r = await fetch(u, { headers:{ Authorization:`Bearer ${cle}`, Accept:'application/json' } });
  const j = await r.json().catch(()=>({}));
  return { http:r.status, data:Array.isArray(j?.data)?j.data:[], meta:j?.meta ?? j?.links ?? null, brut:j };
};

const p1 = await appel({ status:'failed', per_page:100, page:1 });
const p2 = await appel({ status:'failed', per_page:100, page:2 });
console.log('\n  page 1 :', p1.data.length, 'lignes, HTTP', p1.http);
console.log('  page 2 :', p2.data.length, 'lignes, HTTP', p2.http);
const id1 = new Set(p1.data.map(v=>v.id));
const communs = p2.data.filter(v=>id1.has(v.id)).length;
console.log(`  identifiants communs entre page 1 et page 2 : ${communs} / ${p2.data.length}`);
console.log('\n  méta renvoyée :', JSON.stringify(p1.meta)?.slice(0,300));
console.log('\n  clés de la réponse :', Object.keys(p1.brut ?? {}).join(', '));
const v = p1.data[0];
if(v){ console.log('\n  exemple de vente refusée :');
  console.log('     id      :', v.id);
  console.log('     status  :', v.status);
  console.log('     payment :', JSON.stringify(v.payment)?.slice(0,240));
  console.log('     clés    :', Object.keys(v).join(', ')); }
