"use client";

import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

type Point = { cle: string; libelle: string; valeur: number };

const COULEURS = ["#10b981", "#38bdf8", "#f59e0b", "#a78bfa", "#f472b6"];

function InfoBulle({ active, payload, label, suffixe }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#101c24] border border-[#2e4757] rounded-[12px] px-3 py-2 shadow-xl">
      <p className="text-[11px] font-bold text-white/50 mb-0.5">{label}</p>
      <p className="text-sm font-black text-white">
        {Number(payload[0].value).toLocaleString("fr-FR")}
        {suffixe ? ` ${suffixe}` : ""}
      </p>
    </div>
  );
}

/** Courbe d'évolution. Les intervalles vides valent 0 et restent visibles : un trou dans la courbe induirait en erreur. */
export function Courbe({ donnees, suffixe, hauteur = 240 }: { donnees: Point[]; suffixe?: string; hauteur?: number }) {
  if (!donnees.length) return <p className="text-sm text-white/30 py-10 text-center">Aucune donnée.</p>;
  return (
    <ResponsiveContainer width="100%" height={hauteur}>
      <AreaChart data={donnees} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="degradeCourbe" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#2e4757" vertical={false} />
        <XAxis dataKey="libelle" tick={{ fill: "#ffffff55", fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={20} />
        <YAxis tick={{ fill: "#ffffff55", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip content={<InfoBulle suffixe={suffixe} />} cursor={{ stroke: "#10b981", strokeOpacity: 0.2 }} />
        <Area type="monotone" dataKey="valeur" stroke="#10b981" strokeWidth={2} fill="url(#degradeCourbe)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function Barres({ donnees, suffixe, hauteur = 240 }: { donnees: Point[]; suffixe?: string; hauteur?: number }) {
  if (!donnees.length) return <p className="text-sm text-white/30 py-10 text-center">Aucune donnée.</p>;
  return (
    <ResponsiveContainer width="100%" height={hauteur}>
      <BarChart data={donnees} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#2e4757" vertical={false} />
        <XAxis dataKey="libelle" tick={{ fill: "#ffffff55", fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={20} />
        <YAxis tick={{ fill: "#ffffff55", fontSize: 11 }} axisLine={false} tickLine={false} />
        <Tooltip content={<InfoBulle suffixe={suffixe} />} cursor={{ fill: "#ffffff08" }} />
        <Bar dataKey="valeur" fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={40} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function Camembert({ donnees }: { donnees: { nom: string; valeur: number }[] }) {
  const total = donnees.reduce((t, d) => t + d.valeur, 0);
  if (!total) return <p className="text-sm text-white/30 py-10 text-center">Aucun abonnement actif.</p>;

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      <ResponsiveContainer width="100%" height={180} className="!w-[180px] shrink-0">
        <PieChart>
          <Pie data={donnees} dataKey="valeur" nameKey="nom" cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={3}>
            {donnees.map((_, i) => (
              <Cell key={i} fill={COULEURS[i % COULEURS.length]} stroke="none" />
            ))}
          </Pie>
          <Tooltip content={<InfoBulle />} />
        </PieChart>
      </ResponsiveContainer>

      <div className="flex-1 w-full space-y-2.5">
        {donnees.map((d, i) => (
          <div key={d.nom} className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: COULEURS[i % COULEURS.length] }} />
            <span className="text-sm text-white/80 flex-1">{d.nom}</span>
            <span className="text-sm font-bold text-white">{d.valeur}</span>
            <span className="text-xs text-white/40 w-12 text-right">
              {Math.round((d.valeur / total) * 100)} %
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
