'use client';

import { useEffect, useState, useRef } from 'react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ReferenceLine,
} from 'recharts';

type Point = { week: string; label: string; cv: number; loc: number; total: number };

/* Compteur animé */
function AnimatedCount({ target }: { target: number }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (target === 0) return;
    const dur = 900;
    const start = performance.now();
    const frame = (now: number) => {
      const t = Math.min((now - start) / dur, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      setVal(Math.round(ease * target));
      if (t < 1) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }, [target]);
  return <>{val}</>;
}

/* Point lumineux sur la dernière valeur */
function GlowDot({ cx, cy, stroke }: { cx?: number; cy?: number; stroke: string }) {
  if (cx == null || cy == null) return null;
  return (
    <g>
      <circle cx={cx} cy={cy} r={8} fill={stroke} opacity={0.15} />
      <circle cx={cx} cy={cy} r={4} fill={stroke} opacity={0.5} />
      <circle cx={cx} cy={cy} r={2.5} fill={stroke} />
    </g>
  );
}

export default function DriversEvolutionChart() {
  const [points, setPoints] = useState<Point[]>([]);
  const [loading, setLoading] = useState(true);
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/dashboard/drivers-evolution')
      .then((r) => r.json())
      .then((d) => { setPoints(d.points ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  /* Déclenche l'animation quand le composant entre dans la vue */
  useEffect(() => {
    if (!ref.current) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.2 }
    );
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, [loading]);

  if (loading) return (
    <div className="card p-6 flex flex-col items-center justify-center h-72 gap-3">
      <div className="w-8 h-8 border-2 border-hud-cyan border-t-transparent rounded-full animate-spin" />
      <span className="text-hud-cyan text-xs tracking-widest">CHARGEMENT DONNÉES...</span>
    </div>
  );

  if (points.length === 0) return (
    <div className="card p-6 flex items-center justify-center h-72">
      <span className="text-gray-600 text-sm">Aucune donnée disponible.</span>
    </div>
  );

  const displayed = points.length > 24 ? points.slice(-24) : points;
  const last = displayed[displayed.length - 1];

  return (
    <div ref={ref} className="card p-5 space-y-4 overflow-hidden">
      {/* En-tête avec compteurs animés */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="hud-title">Évolution des chauffeurs actifs</h2>
          <p className="text-xs text-gray-600 mt-0.5">{points.length} semaines · {displayed.length} affichées</p>
        </div>
        <div className="flex gap-4 text-right">
          <div>
            <p className="text-[10px] text-blue-400 uppercase tracking-widest font-semibold">Cond. Vente</p>
            <p className="text-xl font-display font-bold text-blue-400">
              {visible ? <AnimatedCount target={last?.cv ?? 0} /> : 0}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-emerald-400 uppercase tracking-widest font-semibold">Location</p>
            <p className="text-xl font-display font-bold text-emerald-400">
              {visible ? <AnimatedCount target={last?.loc ?? 0} /> : 0}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-hud-cyan uppercase tracking-widest font-semibold">Total</p>
            <p className="text-xl font-display font-bold text-hud-cyan">
              {visible ? <AnimatedCount target={last?.total ?? 0} /> : 0}
            </p>
          </div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={displayed} margin={{ top: 8, right: 16, left: -10, bottom: 0 }}>
          <defs>
            {/* Glow filter cyan */}
            <filter id="glowCyan" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          <CartesianGrid strokeDasharray="3 3" stroke="#1c2440" vertical={false} />

          <XAxis
            dataKey="label"
            tick={{ fill: '#4b5563', fontSize: 10 }}
            tickLine={false}
            axisLine={{ stroke: '#1c2440' }}
            interval={displayed.length > 12 ? Math.floor(displayed.length / 6) : 0}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fill: '#4b5563', fontSize: 10 }}
            tickLine={false}
            axisLine={false}
          />

          <Tooltip
            contentStyle={{
              background: 'rgba(11,16,32,0.95)',
              border: '1px solid #22e8ff33',
              borderRadius: 10,
              fontSize: 12,
              boxShadow: '0 0 16px rgba(34,232,255,0.15)',
            }}
            labelStyle={{ color: '#22e8ff', fontWeight: 'bold', marginBottom: 6, letterSpacing: '0.05em' }}
            itemStyle={{ color: '#e5e7eb', paddingTop: 2 }}
            cursor={{ stroke: '#22e8ff22', strokeWidth: 1, strokeDasharray: '4 2' }}
            formatter={(value, name) => [
              value,
              name === 'cv' ? 'Condition Vente' : name === 'loc' ? 'Location' : 'Total',
            ]}
          />

          <Legend
            iconType="circle"
            iconSize={6}
            formatter={(value) =>
              value === 'cv' ? 'Condition Vente' : value === 'loc' ? 'Location' : 'Total'
            }
            wrapperStyle={{ fontSize: 11, color: '#6b7280', paddingTop: 6 }}
          />

          {/* Ligne totale — principale, avec glow */}
          <Line
            type="monotone"
            dataKey="total"
            stroke="#22e8ff"
            strokeWidth={2.5}
            activeDot={{ r: 5, fill: '#22e8ff', stroke: '#0b1020', strokeWidth: 2 }}
            isAnimationActive={visible}
            animationDuration={1400}
            animationEasing="ease-out"
            dot={(props: Record<string, unknown>) => {
              if ((props.index as number) === displayed.length - 1) {
                return <GlowDot key="last-total" cx={props.cx as number} cy={props.cy as number} stroke="#22e8ff" />;
              }
              return <g key={`dot-${props.index}`} />;
            }}
          />

          {/* Ligne CV */}
          <Line
            type="monotone"
            dataKey="cv"
            stroke="#3b82f6"
            strokeWidth={1.5}
            strokeDasharray="5 3"
            dot={false}
            activeDot={{ r: 4, fill: '#3b82f6', stroke: '#0b1020', strokeWidth: 2 }}
            isAnimationActive={visible}
            animationDuration={1600}
            animationEasing="ease-out"
          />

          {/* Ligne Location */}
          <Line
            type="monotone"
            dataKey="loc"
            stroke="#10b981"
            strokeWidth={1.5}
            strokeDasharray="5 3"
            dot={false}
            activeDot={{ r: 4, fill: '#10b981', stroke: '#0b1020', strokeWidth: 2 }}
            isAnimationActive={visible}
            animationDuration={1800}
            animationEasing="ease-out"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
