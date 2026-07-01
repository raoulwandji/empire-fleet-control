'use client';

import { useEffect, useState, useRef } from 'react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine,
} from 'recharts';

type Point = { week: string; label: string; total: number };

function fmtFCFA(v: number) {
  return v.toLocaleString('fr-FR', { minimumFractionDigits: 0 }) + ' XOF';
}

/* Compteur animé */
function AnimatedCount({ target, fmt }: { target: number; fmt: (v: number) => string }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (target === 0) return;
    const dur = 1000;
    const start = performance.now();
    const frame = (now: number) => {
      const t = Math.min((now - start) / dur, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      setVal(Math.round(ease * target));
      if (t < 1) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }, [target]);
  return <>{fmt(val)}</>;
}

/* Point lumineux sur la dernière valeur */
function GlowDot({ cx, cy }: { cx?: number; cy?: number }) {
  if (cx == null || cy == null) return null;
  return (
    <g>
      <circle cx={cx} cy={cy} r={12} fill="#ff2845" opacity={0.08} />
      <circle cx={cx} cy={cy} r={7} fill="#ff2845" opacity={0.2} />
      <circle cx={cx} cy={cy} r={3.5} fill="#ff2845" />
      <circle cx={cx} cy={cy} r={2} fill="white" opacity={0.8} />
    </g>
  );
}

/* Bar sparkline en bas (mini histogram) */
function MiniBar({ x, y, width, height }: { x?: number; y?: number; width?: number; height?: number }) {
  if (!x || !y || !width || !height) return null;
  return <rect x={x} y={y} width={width - 2} height={height} rx={2} fill="#b3122a" opacity={0.4} />;
}

export default function CommissionsEvolutionChart() {
  const [points, setPoints] = useState<Point[]>([]);
  const [loading, setLoading] = useState(true);
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/dashboard/commissions-evolution')
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
      <div className="w-8 h-8 border-2 border-empire-rougeVif border-t-transparent rounded-full animate-spin" />
      <span className="text-empire-rougeVif text-xs tracking-widest">CHARGEMENT DONNÉES...</span>
    </div>
  );

  if (points.length === 0) return (
    <div className="card p-6 flex items-center justify-center h-72">
      <span className="text-gray-600 text-sm">Aucune commission enregistrée.</span>
    </div>
  );

  const displayed = points.length > 24 ? points.slice(-24) : points;
  const cumul = displayed.reduce((s, p) => s + p.total, 0);
  const maxWeek = Math.max(...displayed.map((p) => p.total));
  const maxPoint = displayed.find((p) => p.total === maxWeek);
  const avgWeek = cumul / displayed.length;

  return (
    <div ref={ref} className="card p-5 space-y-4 overflow-hidden">
      {/* En-tête avec compteurs */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="hud-title">Commissions Empire</h2>
          <p className="text-xs text-gray-600 mt-0.5">{points.length} semaines enregistrées</p>
        </div>
        <div className="flex gap-4 text-right">
          <div>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">Moy./sem.</p>
            <p className="text-base font-display font-bold text-gray-400">
              {visible ? <AnimatedCount target={Math.round(avgWeek)} fmt={(v) => `${(v / 1000).toFixed(0)}k`} /> : '0k'}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-empire-rougeVif uppercase tracking-widest font-semibold">Cumul total</p>
            <p className="text-xl font-display font-bold text-empire-rougeVif">
              {visible ? <AnimatedCount target={cumul} fmt={(v) => `${(v / 1000).toFixed(0)}k`} /> : '0k'}
              <span className="text-xs text-gray-500 font-normal ml-1">XOF</span>
            </p>
          </div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={displayed} margin={{ top: 8, right: 16, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id="commGradMain" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ff2845" stopOpacity={0.3} />
              <stop offset="60%" stopColor="#b3122a" stopOpacity={0.12} />
              <stop offset="100%" stopColor="#b3122a" stopOpacity={0} />
            </linearGradient>
            <filter id="glowRed">
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          <CartesianGrid strokeDasharray="3 3" stroke="#1c2440" vertical={false} />

          {/* Ligne de moyenne */}
          {avgWeek > 0 && (
            <ReferenceLine
              y={avgWeek}
              stroke="#b3122a"
              strokeDasharray="6 3"
              strokeOpacity={0.4}
              label={{
                value: 'moy.',
                position: 'insideTopRight',
                fill: '#b3122a',
                fontSize: 9,
                opacity: 0.6,
              }}
            />
          )}

          <XAxis
            dataKey="label"
            tick={{ fill: '#4b5563', fontSize: 10 }}
            tickLine={false}
            axisLine={{ stroke: '#1c2440' }}
            interval={displayed.length > 12 ? Math.floor(displayed.length / 6) : 0}
          />
          <YAxis
            tick={{ fill: '#4b5563', fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)}
          />

          <Tooltip
            contentStyle={{
              background: 'rgba(11,16,32,0.95)',
              border: '1px solid #ff284533',
              borderRadius: 10,
              fontSize: 12,
              boxShadow: '0 0 16px rgba(255,40,69,0.15)',
            }}
            labelStyle={{ color: '#ff2845', fontWeight: 'bold', marginBottom: 6, letterSpacing: '0.05em' }}
            itemStyle={{ color: '#e5e7eb' }}
            cursor={{ stroke: '#ff284522', strokeWidth: 1, strokeDasharray: '4 2' }}
            formatter={(value) => [fmtFCFA(Number(value)), 'Commission']}
          />

          <Area
            type="monotone"
            dataKey="total"
            stroke="#ff2845"
            strokeWidth={2.5}
            fill="url(#commGradMain)"
            isAnimationActive={visible}
            animationDuration={1600}
            animationEasing="ease-out"
            activeDot={{ r: 5, fill: '#ff2845', stroke: '#0b1020', strokeWidth: 2 }}
            dot={(props: Record<string, unknown>) => {
              if ((props.index as number) === displayed.length - 1) {
                return <GlowDot key="last-comm" cx={props.cx as number} cy={props.cy as number} />;
              }
              return <g key={`dot-${props.index}`} />;
            }}
          />
        </AreaChart>
      </ResponsiveContainer>

      {/* Légende pic */}
      {maxPoint && (
        <p className="text-[10px] text-gray-600 text-right">
          Pic : <span className="text-empire-rougeVif font-semibold">{fmtFCFA(maxWeek)}</span>
          {' '}sem. du {maxPoint.label}
        </p>
      )}
    </div>
  );
}
