'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Navbar from '@/components/Navbar';

type Owner = { id: string; fullName: string; phone: string; location: string | null };

type DriverRow = {
  driverId: string;
  vehiclePlate: string;
  fullName: string;
  code: string;
  total: number;
};

type PrefRow = {
  id: string;
  amount: number;
  note: string | null;
  vehiclePlate: string | null;
  driverName: string | null;
  driverCode: string | null;
};

type WeekRow = {
  weekStart: string;
  perDriver: DriverRow[];
  weekTotal: number;
  prefinancements: PrefRow[];
  totalPrefs: number;
};

type ReportData = {
  owner: Owner;
  drivers: { id: string; fullName: string; vehiclePlate: string; code: string }[];
  rows: WeekRow[];
  grandTotal: number;
  grandTotalPrefs: number;
};

function fmtAmount(v: number) {
  return v.toLocaleString('fr-FR', { minimumFractionDigits: 0 }) + ' XOF';
}

function fmtWeek(iso: string) {
  const d = new Date(iso);
  const end = new Date(d);
  end.setDate(d.getDate() + 6);
  return `Sem. du ${d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })} au ${end.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}`;
}

export default function ReportsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [owners, setOwners] = useState<Owner[]>([]);
  const [ownerId, setOwnerId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (status === 'authenticated') {
      const role = session?.user.role;
      if (role !== 'ADMIN' && role !== 'MANAGER') {
        router.replace('/drivers');
        return;
      }
      fetch('/api/owners').then((r) => r.json()).then((d) => setOwners(Array.isArray(d) ? d : (d.owners ?? [])));
    }
  }, [status, session, router]);

  async function loadReport() {
    if (!ownerId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ ownerId });
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      const res = await fetch(`/api/reports/owner?${params}`);
      if (res.ok) setReport(await res.json());
    } finally {
      setLoading(false);
    }
  }

  function downloadPdf() {
    if (!ownerId) return;
    const params = new URLSearchParams({ ownerId });
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    window.open(`/api/reports/owner/pdf?${params}`, '_blank');
  }

  if (status === 'loading') return null;

  return (
    <div className="min-h-screen bg-hud-bg">
      <Navbar />
      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <h1 className="text-2xl font-display font-bold text-hud-cyan tracking-widest uppercase">
          Rapports / Synthèse
        </h1>

        {/* Filtres */}
        <div className="card p-5 space-y-4">
          <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold">Paramètres du rapport</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="hud-label">Propriétaire *</label>
              <select
                className="hud-input"
                value={ownerId}
                onChange={(e) => { setOwnerId(e.target.value); setReport(null); }}
              >
                <option value="">— Sélectionner un propriétaire —</option>
                {owners.map((o) => (
                  <option key={o.id} value={o.id}>{o.fullName}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="hud-label">Du (date début)</label>
              <input type="date" className="hud-input" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <label className="hud-label">Au (date fin)</label>
              <input type="date" className="hud-input" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <button onClick={loadReport} disabled={!ownerId || loading} className="btn-primary">
              {loading ? 'Chargement…' : 'Générer le rapport'}
            </button>
            {report && report.rows.length > 0 && (
              <button onClick={downloadPdf} className="btn-secondary flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                </svg>
                Télécharger PDF
              </button>
            )}
          </div>
        </div>

        {/* Résultats */}
        {report && (
          <div className="space-y-4">
            {/* En-tête propriétaire — 3 totaux */}
            <div className="card p-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
                <div>
                  <p className="text-lg font-bold text-hud-cyan">{report.owner.fullName}</p>
                  <p className="text-sm text-gray-400">{report.owner.phone}{report.owner.location ? ` — ${report.owner.location}` : ''}</p>
                  <p className="text-xs text-gray-500 mt-1">{report.drivers.length} véhicule(s) · {report.rows.length} semaine(s)</p>
                </div>
                <div className="flex gap-4 sm:gap-6 text-right">
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-widest">Versements bruts</p>
                    <p className="text-xl font-bold text-green-400">{fmtAmount(report.grandTotal)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-widest">Préfinancements</p>
                    <p className="text-xl font-bold text-yellow-400">− {fmtAmount(report.grandTotalPrefs)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-widest">Net à verser</p>
                    <p className="text-xl font-bold text-hud-cyan">{fmtAmount(report.grandTotal - report.grandTotalPrefs)}</p>
                  </div>
                </div>
              </div>
            </div>

            {report.rows.length === 0 ? (
              <div className="card p-6 text-center text-gray-500">Aucun versement sur cette période.</div>
            ) : (
              report.rows.map((row) => {
                const net = row.weekTotal - row.totalPrefs;
                return (
                  <div key={row.weekStart} className="card overflow-hidden">
                    {/* En-tête semaine */}
                    <div className="flex items-center justify-between px-4 py-3 bg-hud-cyan/5 border-b border-hud-line">
                      <span className="text-sm font-semibold text-hud-cyan">{fmtWeek(row.weekStart)}</span>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-gray-400">Brut : <span className="font-bold text-green-400">{fmtAmount(row.weekTotal)}</span></span>
                        {row.totalPrefs > 0 && (
                          <span className="text-gray-400">Préfin. : <span className="font-bold text-yellow-400">− {fmtAmount(row.totalPrefs)}</span></span>
                        )}
                        <span className="text-gray-400">Net : <span className={`font-bold ${net >= 0 ? 'text-hud-cyan' : 'text-empire-rougeVif'}`}>{fmtAmount(net)}</span></span>
                      </div>
                    </div>

                    {/* Versements par véhicule */}
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs text-gray-500 uppercase tracking-wider border-b border-hud-line bg-hud-panel2/50">
                          <th className="px-4 py-2 text-left">Véhicule</th>
                          <th className="px-4 py-2 text-left">Chauffeur</th>
                          <th className="px-4 py-2 text-right">Versement</th>
                        </tr>
                      </thead>
                      <tbody>
                        {row.perDriver.filter((d) => d.total > 0).map((d) => (
                          <tr key={d.driverId} className="border-b border-hud-line/40 hover:bg-hud-cyan/3 transition-colors">
                            <td className="px-4 py-2 font-mono text-hud-cyan font-semibold">{d.vehiclePlate}</td>
                            <td className="px-4 py-2 text-gray-300">
                              {d.fullName}
                              <span className="ml-2 text-xs text-gray-500">({d.code})</span>
                            </td>
                            <td className="px-4 py-2 text-right font-semibold text-green-400">{fmtAmount(d.total)}</td>
                          </tr>
                        ))}
                        {row.perDriver.every((d) => d.total === 0) && (
                          <tr className="border-b border-hud-line/20">
                            <td colSpan={3} className="px-4 py-2 text-xs text-gray-600 italic">Aucun versement cette semaine</td>
                          </tr>
                        )}
                      </tbody>
                    </table>

                    {/* Préfinancements de la semaine */}
                    {row.prefinancements.length > 0 && (
                      <div className="border-t border-yellow-400/20 bg-yellow-400/3">
                        <div className="px-4 py-2 flex items-center gap-2">
                          <span className="text-xs font-semibold text-yellow-400 uppercase tracking-widest">Préfinancements Empire</span>
                          <span className="text-xs text-yellow-400/70">({row.prefinancements.length})</span>
                        </div>
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-xs text-gray-500 uppercase tracking-wider border-b border-yellow-400/10 bg-yellow-400/5">
                              <th className="px-4 py-1.5 text-left">Véhicule concerné</th>
                              <th className="px-4 py-1.5 text-left">Objet</th>
                              <th className="px-4 py-1.5 text-right">Montant</th>
                            </tr>
                          </thead>
                          <tbody>
                            {row.prefinancements.map((pf) => (
                              <tr key={pf.id} className="border-b border-yellow-400/10">
                                <td className="px-4 py-2 font-mono text-yellow-300 text-xs">
                                  {pf.vehiclePlate ? (
                                    <>{pf.vehiclePlate} <span className="text-gray-500">— {pf.driverName} ({pf.driverCode})</span></>
                                  ) : (
                                    <span className="text-gray-500 italic">Non spécifié</span>
                                  )}
                                </td>
                                <td className="px-4 py-2 text-gray-400 text-xs italic">{pf.note ?? '—'}</td>
                                <td className="px-4 py-2 text-right font-semibold text-yellow-400">− {fmtAmount(pf.amount)}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="bg-yellow-400/5">
                              <td colSpan={2} className="px-4 py-2 text-xs text-yellow-400/70 text-right font-semibold uppercase tracking-wider">Total préfinancements semaine</td>
                              <td className="px-4 py-2 text-right font-bold text-yellow-400">− {fmtAmount(row.totalPrefs)}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </main>
    </div>
  );
}
