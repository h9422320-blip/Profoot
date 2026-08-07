const SUPA="https://rhxagubyuidautkejbfm.supabase.co",PUB="sb_publishable_DpOjWrKkM9Jz63HcOOjTSw_5GYobpBL";
const E="diag.paiement@profoot-test.com",P="DiagPaiement2026!x";
(async()=>{
  await fetch(`${SUPA}/auth/v1/signup`,{method:'POST',headers:{apikey:PUB,'Content-Type':'application/json'},body:JSON.stringify({email:E,password:P})});
  const s=await(await fetch(`${SUPA}/auth/v1/token?grant_type=password`,{method:'POST',headers:{apikey:PUB,'Content-Type':'application/json'},body:JSON.stringify({email:E,password:P})})).json();
  if(!s.access_token){console.log("pas de session:",JSON.stringify(s).slice(0,200));return;}
  require('fs').writeFileSync('_id3.txt',s.user.id);
  const p={access_token:s.access_token,token_type:s.token_type,expires_in:s.expires_in,expires_at:s.expires_at,refresh_token:s.refresh_token,user:s.user};
  const ck=`sb-rhxagubyuidautkejbfm-auth-token=base64-${Buffer.from(JSON.stringify(p)).toString('base64')}`;
  for (const plan of ['monthly','yearly']) {
    const r=await fetch("https://profoot-2lqq.vercel.app/api/payments/chariow/checkout",{method:'POST',headers:{Cookie:ck,'Content-Type':'application/json'},body:JSON.stringify({plan})});
    const txt=await r.text();
    console.log(`[${plan}] HTTP ${r.status} -> ${txt.slice(0,220)}`);
  }
})();
