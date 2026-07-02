'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { formatFCFA } from '@/lib/business';
import clsx from 'clsx';
import dynamic from 'next/dynamic';

const chartLoader = () => (
  <div className="card p-6 flex items-center justify-center h-72">
    <div className="w-8 h-8 border-2 border-hud-cyan border-t-transparent rounded-full animate-spin" />
  </div>
);
const DriversEvolutionChart = dynamic(() => import('@/components/DriversEvolutionChart'), { ssr: false, loading: chartLoader });
const CommissionsEvolutionChart = dynamic(() => import('@/components/CommissionsEvolutionChart'), { ssr: false, loading: chartLoader });

type Ranked = { driverId: string; code: string; fullName: string; totalRides: number; totalHours: number };
type ProgressRow = { driverId: string; code: string; fullName: string; totalFixed: number; totalPaid: number; cautionAdvance: number; totalPaidWithAdvance: number; resteAPayer: number; percent: number };
type SanctionRow = { driverId: string; code: string; fullName: string; contractType: string; totalPenalty: number; count: number };
type WeeklyStatusRow = { driverId: string; code: string; fullName: string; contractType: string; expectedDays: number; daysPaid: number; totalAmount: number; status: 'complete' | 'partial' | 'none' };

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [mode, setMode] = useState<'total' | 'week'>('total');
  const [weekStartDate, setWeekStartDate] = useState('');
  const [conditionVente, setConditionVente] = useState<Ranked[]>([]);
  const [location, setLocation] = useState<Ranked[]>([]);
  const [loading, setLoading] = useState(true);

  // Rediriger les employés
  useEffect(() => {
    if (status === 'authenticated' && session?.user.role === 'EMPLOYEE') {
      router.replace('/drivers');
    }
  }, [status, session, router]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (mode === 'week' && weekStartDate) params.set('weekStartDate', weekStartDate);
    const res = await fetch(`/api/dashboard?${params.toString()}`);
    const data = await res.json();
    setConditionVente(Array.isArray(data.conditionVente) ? data.conditionVente : []);
    setLocation(Array.isArray(data.location) ? data.location : []);
    setLoading(false);
  }, [mode, weekStartDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="p-6 max-w-6xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="font-display font-bold text-2xl text-transparent bg-clip-text bg-gradient-to-r from-hud-cyan to-empire-rouge tracking-widest">
              TABLEAU DE BORD
            </h1>
            <p className="text-xs text-gray-500 tracking-widest uppercase mt-1">Classements & Indicateurs de flotte</p>
          </div>
          <div className="flex gap-2 items-center">
            <select value={mode} onChange={(e) => setMode(e.target.value as 'total' | 'week')} className="hud-select text-sm px-3 py-2 w-36">
              <option value="total">Cumul total</option>
              <option value="week">Par semaine</option>
            </select>
            {mode === 'week' && (
              <input type="date" value={weekStartDate} onChange={(e) => setWeekStartDate(e.target.value)} className="hud-input !w-auto text-sm" />
            )}
          </div>
        </div>

        {/* Séparateur */}
        <div className="h-px bg-gradient-to-r from-transparent via-hud-cyan/40 to-transparent" />

        {/* Classements courses */}
        {loading ? (
          <div className="text-hud-cyan text-sm font-display tracking-widest animate-pulse">⟳ CHARGEMENT...</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <RankingPanel title="Condition-Vente" color="cyan" data={conditionVente} />
            <RankingPanel title="Location" color="magenta" data={location} />
          </div>
        )}

        <WeeklyTotalsPanel />
        <EmpireWeeklyPanel />

        {/* Graphiques d'évolution */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <DriversEvolutionChart />
          <CommissionsEvolutionChart />
        </div>

        <ProgressPanel />
        <SanctionsPanel />
        <WeeklyStatusPanel />
      </div>
    </div>
  );
}

function WeeklyTotalsPanel() {
  const [data, setData] = useState<{
    weekStartDate: string;
    conditionVente: { totalAmount: number; paymentCount: number; driverCount: number };
    location: { totalAmount: number; paymentCount: number; driverCount: number };
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/dashboard/weekly-totals')
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const weekLabel = data?.weekStartDate
    ? new Date(data.weekStartDate).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
    : '...';

  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-1 h-5 rounded-full bg-hud-or" style={{ background: 'linear-gradient(to bottom, #22e8ff, #caa15a)' }} />
        <h2 className="font-display text-sm font-bold tracking-widest uppercase text-empire-or">
          Cumul de la semaine — du {weekLabel}
        </h2>
      </div>

      {loading ? (
        <p className="text-xs text-gray-500 animate-pulse tracking-widest">⟳ CHARGEMENT...</p>
      ) : !data || !data.conditionVente ? (
        <p className="text-xs text-gray-600 italic">Données indisponibles.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Condition-Vente */}
          <div className="rounded-xl border border-blue-700/40 bg-blue-900/10 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <span className="badge-cv text-sm">Condition-Vente</span>
            </div>
            <div>
              <div className="stat-label">Total versé cette semaine</div>
              <div className="font-display font-black text-2xl text-hud-cyan">
                {formatFCFA(data.conditionVente.totalAmount)}
              </div>
            </div>
            <div className="flex gap-4 text-xs text-gray-400">
              <span><span className="text-white font-semibold">{data.conditionVente.paymentCount}</span> versement{data.conditionVente.paymentCount > 1 ? 's' : ''}</span>
              <span><span className="text-white font-semibold">{data.conditionVente.driverCount}</span> chauffeur{data.conditionVente.driverCount > 1 ? 's' : ''} actif{data.conditionVente.driverCount > 1 ? 's' : ''}</span>
            </div>
          </div>

          {/* Location */}
          <div className="rounded-xl border border-emerald-700/40 bg-emerald-900/10 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <span className="badge-loc text-sm">Location</span>
            </div>
            <div>
              <div className="stat-label">Total versé cette semaine</div>
              <div className="font-display font-black text-2xl text-hud-green">
                {formatFCFA(data.location.totalAmount)}
              </div>
            </div>
            <div className="flex gap-4 text-xs text-gray-400">
              <span><span className="text-white font-semibold">{data.location.paymentCount}</span> versement{data.location.paymentCount > 1 ? 's' : ''}</span>
              <span><span className="text-white font-semibold">{data.location.driverCount}</span> chauffeur{data.location.driverCount > 1 ? 's' : ''} actif{data.location.driverCount > 1 ? 's' : ''}</span>
            </div>
          </div>

          {/* Total combiné */}
          <div className="md:col-span-2 rounded-xl border border-empire-or/30 bg-empire-or/5 p-4 flex items-center justify-between flex-wrap gap-2">
            <span className="stat-label">Total combiné (semaine en cours)</span>
            <span className="font-display font-black text-2xl text-empire-or">
              {formatFCFA(data.conditionVente.totalAmount + data.location.totalAmount)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

type EmpireOwnerStat = {
  id: string; fullName: string; versements: number;
  commission: number; prefinancement: number; net: number;
};

function EmpireWeeklyPanel() {
  const [data, setData] = useState<{
    weekStart: string;
    totalVersements: number;
    totalCommissions: number;
    totalPrefinancements: number;
    totalNet: number;
    owners: EmpireOwnerStat[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/dashboard/empire-weekly')
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const weekLabel = data?.weekStart
    ? new Date(data.weekStart).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
    : '...';

  return (
    <div className="card p-5 space-y-5">
      {/* Titre */}
      <div className="flex items-center gap-2">
        <div className="w-1 h-5 rounded-full bg-empire-rouge shadow-neon-red" />
        <h2 className="font-display text-sm font-bold tracking-widest uppercase text-empire-rougeVif">
          Récapitulatif Empire — Semaine du {weekLabel}
        </h2>
      </div>

      {loading ? (
        <p className="text-xs text-gray-500 animate-pulse tracking-widest">⟳ CHARGEMENT...</p>
      ) : !data || data.totalVersements === undefined ? (
        <p className="text-xs text-gray-600 italic">Données indisponibles.</p>
      ) : (
        <>
          {/* 4 indicateurs globaux */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="stat-card">
              <span className="stat-label">Versements bruts</span>
              <span className="stat-value-accent">{formatFCFA(data.totalVersements)}</span>
              <span className="text-[10px] text-gray-600">Tous propriétaires</span>
            </div>
            <div className="stat-card border-empire-rouge/30">
              <span className="stat-label">Commissions Empire</span>
              <span className="font-display font-bold text-lg text-empire-rougeVif">
                {data.totalCommissions > 0 ? formatFCFA(data.totalCommissions) : '—'}
              </span>
              <span className="text-[10px] text-gray-600">Cumul semaine</span>
            </div>
            <div className="stat-card border-yellow-700/30">
              <span className="stat-label">Préfinancements Empire</span>
              <span className="font-display font-bold text-lg text-yellow-400">
                {data.totalPrefinancements > 0 ? formatFCFA(data.totalPrefinancements) : '—'}
              </span>
              <span className="text-[10px] text-gray-600">Cumul semaine</span>
            </div>
            <div className="stat-card border-hud-green/30">
              <span className="stat-label">Total net à verser</span>
              <span className="font-display font-bold text-lg text-hud-green">
                {formatFCFA(data.totalNet)}
              </span>
              <span className="text-[10px] text-gray-600">Brut − Comm. − Préfin.</span>
            </div>
          </div>

          {/* Table par propriétaire */}
          {data.owners.length === 0 ? (
            <p className="text-xs text-gray-500 italic text-center py-3">Aucun versement enregistré cette semaine.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-hud-line">
              <table className="hud-table">
                <thead>
                  <tr>
                    <th>Propriétaire</th>
                    <th className="text-right">Versements</th>
                    <th className="text-right text-empire-rougeVif">− Commission</th>
                    <th className="text-right text-yellow-400">− Préfinancement</th>
                    <th className="text-right text-hud-green">Net à verser</th>
                  </tr>
                </thead>
                <tbody>
                  {data.owners.map((o) => (
                    <tr key={o.id}>
                      <td>
                        <a href={`/owners/${o.id}`} className="neon-link font-medium">{o.fullName}</a>
                      </td>
                      <td className="text-right text-hud-cyan font-semibold">
                        {o.versements > 0 ? formatFCFA(o.versements) : <span className="text-gray-600">—</span>}
                      </td>
                      <td className="text-right text-empire-rougeVif">
                        {o.commission > 0 ? `− ${formatFCFA(o.commission)}` : <span className="text-gray-600">—</span>}
                      </td>
                      <td className="text-right text-yellow-400">
                        {o.prefinancement > 0 ? `− ${formatFCFA(o.prefinancement)}` : <span className="text-gray-600">—</span>}
                      </td>
                      <td className={`text-right font-bold ${o.net >= 0 ? 'text-hud-green' : 'text-empire-rougeVif'}`}>
                        {formatFCFA(o.net)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-hud-panel2 font-bold">
                    <td className="p-3 text-xs text-gray-400 uppercase tracking-wider">Total</td>
                    <td className="p-3 text-right text-hud-cyan">{formatFCFA(data.totalVersements)}</td>
                    <td className="p-3 text-right text-empire-rougeVif">
                      {data.totalCommissions > 0 ? `− ${formatFCFA(data.totalCommissions)}` : '—'}
                    </td>
                    <td className="p-3 text-right text-yellow-400">
                      {data.totalPrefinancements > 0 ? `− ${formatFCFA(data.totalPrefinancements)}` : '—'}
                    </td>
                    <td className="p-3 text-right text-hud-green">{formatFCFA(data.totalNet)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function RankingPanel({ title, color, data }: { title: string; color: 'cyan' | 'magenta'; data: Ranked[] }) {
  const podium = data.slice(0, 3);
  const rest = data.slice(3);
  const medals = ['🥇', '🥈', '🥉'];
  const isCyan = color === 'cyan';

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <div className={clsx('w-1 h-5 rounded-full', isCyan ? 'bg-hud-cyan shadow-neon' : 'bg-hud-magenta')} />
        <h2 className={clsx('font-display text-sm font-bold tracking-widest uppercase', isCyan ? 'text-hud-cyan' : 'text-hud-magenta')}>
          Meilleurs Chauffeurs — {title}
        </h2>
      </div>

      {data.length === 0 ? (
        <p className="text-sm text-gray-600 italic">Aucune donnée disponible.</p>
      ) : (
        <>
          <div className="flex gap-3">
            {podium.map((d, i) => (
              <Link
                href={`/drivers/${d.driverId}`}
                key={d.driverId}
                className={clsx(
                  'flex-1 rounded-xl p-3 text-center border transition-all duration-200 hover:shadow-neon cursor-pointer',
                  i === 0 ? 'border-yellow-500/40 bg-yellow-900/10' :
                  i === 1 ? 'border-gray-500/40 bg-gray-800/20' :
                             'border-orange-700/40 bg-orange-900/10'
                )}
              >
                <div className="text-2xl">{medals[i]}</div>
                <div className="font-semibold text-sm text-white truncate mt-1">{d.fullName}</div>
                <div className="text-xs text-gray-500 font-mono">{d.code}</div>
                <div className={clsx('font-display font-bold mt-1', isCyan ? 'text-hud-cyan' : 'text-hud-magenta')}>
                  {d.totalRides} <span className="text-xs font-normal text-gray-400">courses</span>
                </div>
                <div className="text-xs text-gray-500">{d.totalHours.toFixed(1)} h</div>
              </Link>
            ))}
          </div>
          {rest.length > 0 && (
            <table className="hud-table">
              <thead><tr><th>#</th><th>Chauffeur</th><th>Courses</th><th>Heures</th></tr></thead>
              <tbody>
                {rest.map((d, i) => (
                  <tr key={d.driverId}>
                    <td className="text-gray-600">{i + 4}</td>
                    <td><Link href={`/drivers/${d.driverId}`} className="neon-link">{d.fullName} <span className="text-gray-600 font-mono text-xs">({d.code})</span></Link></td>
                    <td className="text-hud-green font-bold">{d.totalRides}</td>
                    <td className="text-gray-400">{d.totalHours.toFixed(1)} h</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
}

function ProgressPanel() {
  const [limit, setLimit] = useState(5);
  const [rows, setRows] = useState<ProgressRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/dashboard/progress?limit=${limit}`);
    const d = await res.json(); setRows(Array.isArray(d) ? d : []);
    setLoading(false);
  }, [limit]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="w-1 h-5 rounded-full bg-hud-green" />
          <h2 className="font-display text-sm font-bold tracking-widest uppercase text-hud-green">
            Progression vers fin de contrat — CV
          </h2>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-gray-500">Top</span>
          <select value={limit} onChange={(e) => setLimit(Number(e.target.value))} className="hud-select !w-20 text-xs py-1">
            <option value={5}>5</option><option value={10}>10</option><option value={20}>20</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="text-hud-green text-xs animate-pulse tracking-widest">⟳ CHARGEMENT...</div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-gray-600 italic">Aucun chauffeur avec montant fixé.</p>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <Link key={r.driverId} href={`/drivers/${r.driverId}`} className="block group">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-300 group-hover:text-hud-cyan transition-colors">
                  {r.fullName} <span className="text-gray-600 font-mono text-xs">({r.code})</span>
                </span>
                <span className="font-display text-xs">
                  {r.cautionAdvance > 0 && (
                    <span className="text-hud-green/80 mr-2" title="Avance / caution incluse">
                      +av. {formatFCFA(r.cautionAdvance)}
                    </span>
                  )}
                  <span className="text-hud-green font-bold">{r.percent}%</span>
                  <span className="text-gray-500 ml-2">reste {formatFCFA(r.resteAPayer)}</span>
                </span>
              </div>
              <div className="progress-bar">
                <div
                  className={clsx('progress-fill', r.percent >= 90 ? 'bg-hud-green shadow-neon' : r.percent >= 50 ? 'bg-hud-cyan' : 'bg-empire-rougeVif shadow-neon-red')}
                  style={{ width: `${r.percent}%` }}
                />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function SanctionsPanel() {
  const [scope, setScope] = useState<'total' | 'lastWeek'>('total');
  const [contractType, setContractType] = useState('');
  const [limit, setLimit] = useState(10);
  const [rows, setRows] = useState<SanctionRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ scope, limit: String(limit) });
    if (contractType) params.set('contractType', contractType);
    const res = await fetch(`/api/dashboard/sanctions?${params.toString()}`);
    const data = await res.json();
    setRows(Array.isArray(data.ranked) ? data.ranked : []);
    setLoading(false);
  }, [scope, contractType, limit]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="w-1 h-5 rounded-full bg-empire-rougeVif shadow-neon-red" />
          <h2 className="font-display text-sm font-bold tracking-widest uppercase text-empire-rougeVif">
            Pénalités les plus élevées
          </h2>
        </div>
        <div className="flex gap-2 text-xs">
          <select value={scope} onChange={(e) => setScope(e.target.value as 'total' | 'lastWeek')} className="hud-select text-xs py-1">
            <option value="total">Cumul depuis le début</option>
            <option value="lastWeek">Semaine précédente</option>
          </select>
          <select value={contractType} onChange={(e) => setContractType(e.target.value)} className="hud-select text-xs py-1 !w-28">
            <option value="">Tous types</option>
            <option value="CONDITION_VENTE">C-Vente</option>
            <option value="LOCATION">Location</option>
          </select>
          <select value={limit} onChange={(e) => setLimit(Number(e.target.value))} className="hud-select text-xs py-1 !w-20">
            <option value={5}>Top 5</option><option value={10}>Top 10</option><option value={20}>Top 20</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="text-empire-rougeVif text-xs animate-pulse tracking-widest">⟳ CHARGEMENT...</div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-gray-600 italic">Aucune pénalité appliquée.</p>
      ) : (
        <table className="hud-table">
          <thead><tr><th>Chauffeur</th><th>Contrat</th><th>Sanctions</th><th>Total pénalités</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.driverId}>
                <td><Link href={`/drivers/${r.driverId}`} className="neon-link">{r.fullName} <span className="font-mono text-xs text-gray-600">({r.code})</span></Link></td>
                <td>{r.contractType === 'CONDITION_VENTE' ? <span className="badge-cv">C-Vente</span> : <span className="badge-loc">Location</span>}</td>
                <td className="text-gray-400">{r.count}</td>
                <td className="font-display font-bold text-empire-rougeVif">{formatFCFA(r.totalPenalty)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

const STATUS_CFG = {
  complete: { label: 'Complet', cls: 'badge-loc' },
  partial: { label: 'Partiel', cls: 'text-xs px-2 py-0.5 rounded-full bg-yellow-900/60 text-yellow-300 border border-yellow-700/50' },
  none: { label: 'Aucun versement', cls: 'badge-warn' },
};

function WeeklyStatusPanel() {
  const defaultWeek = (() => { const d = new Date(); d.setDate(d.getDate() - 7); return d.toISOString().slice(0, 10); })();
  const [weekStartDate, setWeekStartDate] = useState(defaultWeek);
  const [status, setStatus] = useState<'' | 'complete' | 'partial' | 'none'>('');
  const [contractType, setContractType] = useState('');
  const [rows, setRows] = useState<WeeklyStatusRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ weekStartDate });
    if (status) params.set('status', status);
    if (contractType) params.set('contractType', contractType);
    const res = await fetch(`/api/dashboard/weekly-status?${params.toString()}`);
    const data = await res.json();
    setRows(Array.isArray(data.results) ? data.results : []);
    setLoading(false);
  }, [weekStartDate, status, contractType]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="w-1 h-5 rounded-full bg-hud-cyan shadow-neon" />
          <h2 className="font-display text-sm font-bold tracking-widest uppercase text-hud-cyan">
            Statut versements — sem. du {new Date(weekStartDate).toLocaleDateString('fr-FR')}
          </h2>
        </div>
        <div className="flex gap-2 text-xs flex-wrap">
          <input type="date" value={weekStartDate} onChange={(e) => setWeekStartDate(e.target.value)} className="hud-input !w-auto text-xs py-1" />
          <select value={status} onChange={(e) => setStatus(e.target.value as any)} className="hud-select text-xs py-1 !w-36">
            <option value="">Tous statuts</option>
            <option value="complete">Complets</option>
            <option value="partial">Partiels</option>
            <option value="none">Aucun versement</option>
          </select>
          <select value={contractType} onChange={(e) => setContractType(e.target.value)} className="hud-select text-xs py-1 !w-28">
            <option value="">Tous types</option>
            <option value="CONDITION_VENTE">C-Vente</option>
            <option value="LOCATION">Location</option>
          </select>
        </div>
      </div>
      <p className="text-xs text-gray-600">Jours attendus : Lun, Mer, Jeu, Ven, Sam (5 jours/sem.)</p>

      {loading ? (
        <div className="text-hud-cyan text-xs animate-pulse tracking-widest">⟳ CHARGEMENT...</div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-gray-600 italic">Aucun chauffeur.</p>
      ) : (
        <table className="hud-table">
          <thead><tr><th>Chauffeur</th><th>Contrat</th><th>Jours versés</th><th>Montant</th><th>Statut</th></tr></thead>
          <tbody>
            {rows.map((r) => {
              const cfg = STATUS_CFG[r.status];
              return (
                <tr key={r.driverId}>
                  <td><Link href={`/drivers/${r.driverId}`} className="neon-link">{r.fullName} <span className="font-mono text-xs text-gray-600">({r.code})</span></Link></td>
                  <td>{r.contractType === 'CONDITION_VENTE' ? <span className="badge-cv">C-Vente</span> : <span className="badge-loc">Location</span>}</td>
                  <td className="font-mono text-gray-400">{r.daysPaid}/{r.expectedDays}</td>
                  <td className="text-gray-300">{formatFCFA(r.totalAmount)}</td>
                  <td><span className={cfg.cls}>{cfg.label}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
