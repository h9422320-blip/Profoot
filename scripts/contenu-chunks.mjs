const BASE = 'https://profootai.com';
const html = await (await fetch(BASE + '/login', { cache: 'no-store' })).text();
const scripts = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1]);
const SIGNES = {
  'framer-motion': /framer|motionValue|useReducedMotion/,
  'lucide-react': /lucide|createLucideIcon/,
  'recharts / d3': /recharts|d3-shape|d3-scale/,
  'supabase': /supabase|GoTrueClient|PostgrestClient/,
  'react-dom': /react-dom|hydrateRoot|createRoot/,
  'next router': /next\/dist\/client|app-router|useSearchParams/,
  'date/intl lourd': /moment|date-fns|dayjs/,
};
console.log(`\n  ══ CE QUE CONTIENNENT LES GROS MORCEAUX ══\n`);
for (const s of scripts) {
  const url = s.startsWith('http') ? s : BASE + s;
  const txt = await (await fetch(url, { cache: 'no-store' })).text();
  const ko = Math.round(txt.length / 1024);
  if (ko < 25) continue;
  const trouves = Object.entries(SIGNES).filter(([, re]) => re.test(txt)).map(([n]) => n);
  console.log(`  ${String(ko).padStart(4)} Ko  ${s.split('/').pop().slice(0, 26).padEnd(27)} ${trouves.join(', ') || '—'}`);
}
console.log('');
