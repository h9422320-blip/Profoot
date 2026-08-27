import fs from 'node:fs';
for (const l of fs.readFileSync('.env.local','utf8').split('\n')) {
  const t=l.trim(); if(!t||t.startsWith('#'))continue;
  const i=t.indexOf('='); if(i<0)continue;
  process.env[t.slice(0,i)]=t.slice(i+1).replace(/^["']|["']$/g,'');
}
const cle = process.env.CHARIOW_API_KEY;
const appel = async (params) => {
  const u = new URL('https://api.chariow.com/v1/sales');
  for(const [k,v] of Object.entries(params)) if(v!=null) u.searchParams.set(k,String(v));
  const r = await fetch(u, { headers:{ Authorization:`Bearer ${cle}`, Accept:'application/json' } });
  return r.json().catch(()=>({}));
};
const j = await appel({ status:'failed', per_page:100 });
console.log('\n  objet pagination :\n', JSON.stringify(j.pagination, null, 2));

// On essaie les paramètres de curseur les plus courants.
const pag = j.pagination ?? {};
const candidats = ['cursor','next_cursor','next','after','offset','starting_after','page_token'];
console.log('\n  clés de pagination disponibles :', Object.keys(pag).join(', '));
for(const c of candidats){
  if(pag[c] == null) continue;
  const j2 = await appel({ status:'failed', per_page:100, [c]: pag[c] });
  const id1=new Set((j.data??[]).map(v=>v.id));
  const communs=(j2.data??[]).filter(v=>id1.has(v.id)).length;
  console.log(`  essai « ${c}=${String(pag[c]).slice(0,30)} » → ${j2.data?.length ?? 0} lignes, ${communs} en commun`);
}
