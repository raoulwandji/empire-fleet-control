'use client';

import { useEffect, useState } from 'react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip,
} from 'recharts';

type Point = { week: string; label: string; total: number };

function fmtFCFA(v: number) {
  return v.toLocaleString('fr-FR', { minimumFractionDigits: 0 }) + ' XOF';
}

export default function CommissionsEvolutionChart() {
  const [points, setPoints] = useState<Point[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/dashboard/commissions-evolution')
      .then((r) => r.json())
      .then((d) => { setPoints(d.points ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="card p-6 flex items-center justify-center h-64">
      <span className="text-hud-cyan text-xs tracking-widest animate-pulse">⟳ CHARGEMENT...</span>
    </div>
  );

  if (points.length === 0) return (
    <div className="card p-6 flex items-center justify-center h-64">
      <span className="text-gray-600 text-sm">Aucune commission enregistrée.</span>
    </div>
  );

  const displayed = points.length > 24 ? points.slice(-24) : points;
  const cumul = displayed.reduce((s, p) => s + p.total, 0);

  return (
    <div className="card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="hud-title">Évolution des commissions Empire</h2>
        <span className="text-xs text-empire-rougeVif font-semibold">Cumul : {fmtFCFA(cumul)}</span>
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={displayed} margin={{ top: 4, right: 12, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id="commGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#b3122a" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#b3122a" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1c2440" />
          <XAxis
            dataKey="label"
            tick={{ fill: '#6b7280', fontSize: 10 }}
            tickLine={false}
            axisLine={{ stroke: '#1c2440' }}
            interval={displayed.length > 12 ? Math.floor(displayed.length / 6) : 0}
          />
          <YAxis
            tick={{ fill: '#6b7280', fontSize: 10 }}
            tickLine={false}
            axisLine={{ stroke: '#1c2440' }}
            tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
          />
          <Tooltip
            contentStyle={{ background: '#0b1020', border: '1px solid #1c2440', borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: '#ff2845', fontWeight: 'bold', marginBottom: 4 }}
            itemStyle={{ color: '#e5e7eb' }}
            formatter={(value) => [fmtFCFA(Number(value)), 'Commission']}
          />
          <Area
            type="monotone"
            dataKey="total"
            stroke="#b3122a"
            strokeWidth={2}
            fill="url(#commGrad)"
            dot={false}
            activeDot={{ r: 4, fill: '#ff2845' }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
