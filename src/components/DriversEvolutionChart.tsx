'use client';

import { useEffect, useState } from 'react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend,
} from 'recharts';

type Point = { week: string; label: string; cv: number; loc: number; total: number };

export default function DriversEvolutionChart() {
  const [points, setPoints] = useState<Point[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/dashboard/drivers-evolution')
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
      <span className="text-gray-600 text-sm">Aucune donnée disponible.</span>
    </div>
  );

  // Afficher max 24 points (24 semaines) pour la lisibilité
  const displayed = points.length > 24 ? points.slice(-24) : points;

  return (
    <div className="card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="hud-title">Évolution des chauffeurs actifs</h2>
        <span className="text-xs text-gray-600">{points.length} semaines</span>
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={displayed} margin={{ top: 4, right: 12, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1c2440" />
          <XAxis
            dataKey="label"
            tick={{ fill: '#6b7280', fontSize: 10 }}
            tickLine={false}
            axisLine={{ stroke: '#1c2440' }}
            interval={displayed.length > 12 ? Math.floor(displayed.length / 6) : 0}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fill: '#6b7280', fontSize: 10 }}
            tickLine={false}
            axisLine={{ stroke: '#1c2440' }}
          />
          <Tooltip
            contentStyle={{ background: '#0b1020', border: '1px solid #1c2440', borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: '#22e8ff', fontWeight: 'bold', marginBottom: 4 }}
            itemStyle={{ color: '#e5e7eb' }}
            formatter={(value, name) => [
              value,
              name === 'cv' ? 'Condition Vente' : name === 'loc' ? 'Location' : 'Total',
            ]}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            formatter={(value) =>
              value === 'cv' ? 'Condition Vente' : value === 'loc' ? 'Location' : 'Total'
            }
            wrapperStyle={{ fontSize: 11, color: '#9ca3af', paddingTop: 8 }}
          />
          <Line
            type="monotone"
            dataKey="total"
            stroke="#22e8ff"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: '#22e8ff' }}
          />
          <Line
            type="monotone"
            dataKey="cv"
            stroke="#3b82f6"
            strokeWidth={1.5}
            strokeDasharray="4 2"
            dot={false}
            activeDot={{ r: 3, fill: '#3b82f6' }}
          />
          <Line
            type="monotone"
            dataKey="loc"
            stroke="#10b981"
            strokeWidth={1.5}
            strokeDasharray="4 2"
            dot={false}
            activeDot={{ r: 3, fill: '#10b981' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
