'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import dynamic from 'next/dynamic';
import Navbar from '@/components/Navbar';
import { formatFCFA } from '@/lib/business';
import { BUSINESS_UNITS } from '@/lib/businessUnits';
import StructurePanel from '@/components/StructurePanel';
import type { AccountingSummary } from '@/components/AccountingCharts';

const AccountingCharts = dynamic(() => import('@/components/AccountingCharts'), {
  ssr: false,
  loading: () => (
    <div className="card p-6 flex items-center justify-center h-72">
      <div className="w-8 h-8 border-2 border-hud-cyan border-t-transparent rounded-full animate-spin" />
    </div>
  ),
});

const todayISO = new Date().toISOString().slice(0, 10);

export default function AccountingPage() {
  const { data: session, status: sessionStatus } = useSession();
  const isAdmin = session?.user.role === 'ADMIN';
  const canDelete = session?.user.role === 'ADMIN' || session?.user.role === 'MANAGER';

  // Seul l'ADMIN voit la Vue générale (comptabilité consolidée de toutes les structures).
  const TABS = isAdmin ? ['Vue générale', ...BUSINESS_UNITS.map((u) => u.label)] : BUSINESS_UNITS.map((u) => u.label);
  const [tab, setTab] = useState<string>('');

  // On attend que la session soit résolue avant de fixer l'onglet par défaut,
  // pour éviter de figer sur une structure au lieu de la Vue générale (ADMIN).
  useEffect(() => {
    if (sessionStatus !== 'loading' && !tab && TABS.length > 0) setTab(TABS[0]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionStatus, isAdmin]);

  const [summary, setSummary] = useState<AccountingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (dateFrom) params.set('from', dateFrom);
    if (dateTo) params.set('to', dateTo);
    const qs = params.toString();
    const sRes = await fetch(`/api/accounting/summary${qs ? `?${qs}` : ''}`);
    if (sRes.ok) setSummary(await sRes.json());
    setLoading(false);
  }, [dateFrom, dateTo]);

  useEffect(() => { if (tab === 'Vue générale') load(); }, [load, tab]);

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        {/* En-tête */}
        <div>
          <h1 className="font-display font-bold text-2xl text-transparent bg-clip-text bg-gradient-to-r from-hud-cyan to-empire-rouge tracking-widest">
            COMPTABILITÉ EMPIRE
          </h1>
          <p className="text-xs text-gray-500 tracking-widest uppercase font-bold">Flux de trésorerie — entrées & sorties</p>
        </div>
        <div className="h-px bg-gradient-to-r from-transparent via-hud-cyan/30 to-transparent" />

        {/* Onglets Structure — Vue générale + les 6 structures du groupe Empire */}
        <div className="flex gap-1 border-b border-hud-line overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-all duration-150 ${
                tab === t ? 'border-hud-cyan text-hud-cyan' : 'border-transparent text-gray-500 hover:text-gray-300'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {!tab ? null : tab !== 'Vue générale' ? (
          <StructurePanel
            businessUnit={BUSINESS_UNITS.find((u) => u.label === tab)!.key}
            canDelete={canDelete}
          />
        ) : (
        <>
        {/* KPI — comptabilité générale consolidée de toutes les structures */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard label="Total entrées" value={summary?.totals.entrees ?? 0} color="#2f7d4f" sign="+" />
          <KpiCard label="Total sorties" value={summary?.totals.sorties ?? 0} color="#b3122a" sign="−" />
          <KpiCard
            label="Solde net"
            value={summary?.totals.solde ?? 0}
            color={(summary?.totals.solde ?? 0) >= 0 ? '#2f7d4f' : '#b3122a'}
            emphasize
          />
          <KpiCard label="Flux du mois" value={summary?.currentMonth.net ?? 0} color={(summary?.currentMonth.net ?? 0) >= 0 ? '#2f7d4f' : '#b3122a'} />
        </div>

        {/* Filtre de période — recalcule KPI, diagrammes et récapitulatif */}
        <div className="card p-3 flex flex-wrap items-center gap-3">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Période</span>
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-gray-500 font-bold">Du</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="form-input text-xs py-1 px-2 w-36" />
            <label className="text-xs text-gray-500 font-bold">Au</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="form-input text-xs py-1 px-2 w-36" />
            {(dateFrom || dateTo) && (
              <button onClick={() => { setDateFrom(''); setDateTo(''); }} className="text-xs text-hud-cyan font-bold hover:underline">
                Réinitialiser
              </button>
            )}
          </div>
        </div>

        {/* Graphiques — diagrammes et répartitions consolidés */}
        {loading ? (
          <div className="card p-6 flex items-center justify-center h-72">
            <div className="w-8 h-8 border-2 border-hud-cyan border-t-transparent rounded-full animate-spin" />
          </div>
        ) : summary ? (
          <AccountingCharts summary={summary} animate />
        ) : null}

        {/* Récapitulatif par structure — remplace le journal brut en Vue générale */}
        <div className="card overflow-hidden">
          <div className="flex items-center gap-2 p-4 border-b border-hud-line">
            <div className="w-1 h-5 rounded-full bg-hud-cyan" />
            <h2 className="hud-title">Journal des structures — récapitulatif</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="hud-table">
              <thead>
                <tr>
                  <th>Structure</th>
                  <th className="text-right">Entrées</th>
                  <th className="text-right">Sorties</th>
                  <th className="text-right">Solde</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {!summary?.byStructure || summary.byStructure.length === 0 ? (
                  <tr><td colSpan={5} className="text-center italic text-gray-500 py-6">Aucune opération.</td></tr>
                ) : summary.byStructure.map((s) => (
                  <tr key={s.businessUnit}>
                    <td className="font-bold">{s.label}</td>
                    <td className="text-right font-semibold" style={{ color: '#2f7d4f' }}>+ {formatFCFA(s.entrees)}</td>
                    <td className="text-right font-semibold" style={{ color: '#b3122a' }}>− {formatFCFA(s.sorties)}</td>
                    <td className="text-right font-bold tabular-nums" style={{ color: s.solde >= 0 ? '#2f7d4f' : '#b3122a' }}>
                      {formatFCFA(s.solde)}
                    </td>
                    <td>
                      {s.businessUnit !== 'GENERAL' && (
                        <button
                          onClick={() => setTab(BUSINESS_UNITS.find((u) => u.key === s.businessUnit)?.label ?? '')}
                          className="btn-secondary text-xs py-1 px-2"
                        >
                          Voir le détail
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        </>
        )}
      </div>
    </div>
  );
}

function KpiCard({ label, value, color, sign, emphasize }: { label: string; value: number; color: string; sign?: string; emphasize?: boolean }) {
  return (
    <div className={`stat-card ${emphasize ? 'ring-2 ring-offset-2 ring-offset-hud-bg' : ''}`} style={emphasize ? { boxShadow: `0 0 0 2px ${color}55` } : undefined}>
      <span className="stat-label">{label}</span>
      <span className="font-display font-black text-lg md:text-xl tabular-nums" style={{ color }}>
        {sign && `${sign} `}{formatFCFA(Math.abs(value))}
      </span>
    </div>
  );
}
