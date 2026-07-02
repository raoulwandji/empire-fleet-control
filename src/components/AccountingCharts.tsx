'use client';

import { useEffect, useState, useRef } from 'react';
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, AreaChart, Area, PieChart, Pie, Cell,
} from 'recharts';

type MonthPoint = { month: string; label: string; entrees: number; sorties: number; net: number; cumul: number };
type CatSlice = { category: string; amount: number };

export type AccountingSummary = {
  totals: { entrees: number; sorties: number; solde: number; count: number };
  currentMonth: { entrees: number; sorties: number; net: number };
  monthly: MonthPoint[];
  categoriesSorties: CatSlice[];
  categoriesEntrees: CatSlice[];
};

function fmt(v: number) {
  return v.toLocaleString('fr-FR', { maximumFractionDigits: 0 });
}
function fmtK(v: number) {
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1000) return `${Math.round(v / 1000)}k`;
  return String(v);
}

const GREEN = '#2f7d4f';
const RED = '#b3122a';
const GOLD = '#caa15a';
const PIE_COLORS = ['#b3122a', '#d4682a', '#caa15a', '#7a8b3a', '#2f7d4f', '#3a7d8b', '#5a4a8b', '#8b3a6a'];

const tooltipStyle = {
  background: 'rgba(253,252,248,0.98)',
  border: '1px solid #ddd5c2',
  borderRadius: 10,
  fontSize: 12,
  fontWeight: 700,
  boxShadow: '0 4px 20px rgba(80,65,40,0.15)',
};

export default function AccountingCharts({ summary, animate }: { summary: AccountingSummary; animate: boolean }) {
  const { monthly, categoriesSorties } = summary;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* ─── Solde cumulé (aire) ─── */}
      <div className="card p-5 space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="hud-title">Évolution du solde (trésorerie)</h2>
          <span className="text-xs font-bold" style={{ color: summary.totals.solde >= 0 ? GREEN : RED }}>
            {fmt(summary.totals.solde)} FCFA
          </span>
        </div>
        {monthly.length === 0 ? (
          <EmptyState />
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={monthly} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
              <defs>
                <linearGradient id="cumulGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={GOLD} stopOpacity={0.4} />
                  <stop offset="100%" stopColor={GOLD} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#ddd5c2" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: '#78716c', fontSize: 10, fontWeight: 700 }} tickLine={false} axisLine={{ stroke: '#ddd5c2' }} />
              <YAxis tick={{ fill: '#78716c', fontSize: 10, fontWeight: 700 }} tickLine={false} axisLine={false} tickFormatter={fmtK} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${fmt(Number(v))} FCFA`, 'Solde cumulé']} />
              <Area
                type="monotone" dataKey="cumul" stroke={GOLD} strokeWidth={2.5}
                fill="url(#cumulGrad)" isAnimationActive={animate} animationDuration={1400}
                dot={{ r: 3, fill: GOLD, stroke: '#fff', strokeWidth: 1 }}
                activeDot={{ r: 5, fill: GOLD, stroke: '#fff', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ─── Entrées vs Sorties par mois (composé) ─── */}
      <div className="card p-5 space-y-3">
        <h2 className="hud-title">Entrées vs Sorties par mois</h2>
        {monthly.length === 0 ? (
          <EmptyState />
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={monthly} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ddd5c2" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: '#78716c', fontSize: 10, fontWeight: 700 }} tickLine={false} axisLine={{ stroke: '#ddd5c2' }} />
              <YAxis tick={{ fill: '#78716c', fontSize: 10, fontWeight: 700 }} tickLine={false} axisLine={false} tickFormatter={fmtK} />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(v, n) => [`${fmt(Number(v))} FCFA`, n === 'entrees' ? 'Entrées' : n === 'sorties' ? 'Sorties' : 'Flux net']}
              />
              <Legend
                iconType="circle" iconSize={7}
                formatter={(v) => (v === 'entrees' ? 'Entrées' : v === 'sorties' ? 'Sorties' : 'Flux net')}
                wrapperStyle={{ fontSize: 11, fontWeight: 700, color: '#57534e', paddingTop: 6 }}
              />
              <Bar dataKey="entrees" fill={GREEN} radius={[4, 4, 0, 0]} maxBarSize={22} isAnimationActive={animate} animationDuration={1200} />
              <Bar dataKey="sorties" fill={RED} radius={[4, 4, 0, 0]} maxBarSize={22} isAnimationActive={animate} animationDuration={1200} />
              <Line type="monotone" dataKey="net" stroke={GOLD} strokeWidth={2.5} dot={false} isAnimationActive={animate} animationDuration={1600} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ─── Répartition des sorties (donut) ─── */}
      <div className="card p-5 space-y-3 lg:col-span-2">
        <h2 className="hud-title">Répartition des dépenses par catégorie</h2>
        {categoriesSorties.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={categoriesSorties} dataKey="amount" nameKey="category"
                  cx="50%" cy="50%" innerRadius={55} outerRadius={95} paddingAngle={2}
                  isAnimationActive={animate} animationDuration={1200}
                >
                  {categoriesSorties.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="#fdfcf8" strokeWidth={2} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${fmt(Number(v))} FCFA`, 'Dépense']} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2">
              {categoriesSorties.slice(0, 8).map((c, i) => {
                const pct = (c.amount / summary.totals.sorties) * 100;
                return (
                  <div key={c.category} className="flex items-center gap-3">
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <span className="text-sm font-bold text-gray-800 flex-1 truncate">{c.category}</span>
                    <span className="text-xs font-bold text-gray-500">{pct.toFixed(0)}%</span>
                    <span className="text-sm font-bold tabular-nums" style={{ color: RED }}>{fmt(c.amount)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="h-40 flex items-center justify-center text-sm text-gray-500 font-semibold">
      Aucune donnée — ajoutez des opérations pour voir les graphiques.
    </div>
  );
}

/* Hook d'animation au scroll réutilisable */
export function useInView<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setInView(true); obs.disconnect(); } },
      { threshold: 0.15 }
    );
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  return { ref, inView };
}
