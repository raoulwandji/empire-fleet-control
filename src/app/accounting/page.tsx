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

type Entry = {
  id: string;
  date: string;
  type: 'ENTREE' | 'SORTIE';
  category: string;
  label: string;
  amount: number;
  paymentMode: string;
  note?: string | null;
  enteredBy: string;
};

// Catégories suggérées (l'utilisateur peut saisir librement)
const CAT_ENTREES = ['Recette flotte', 'Caution reçue', 'Commission', 'Apport', 'Autre entrée'];
const CAT_SORTIES = ['Salaire', 'Carburant', 'Réparation', 'Pièces', 'Assurance', 'Loyer bureau', 'Taxe / impôt', 'Préfinancement', 'Livre Ton École', 'GPS installation', 'Formation auto-école', 'ELA', 'Autre dépense'];

const MODE_LABELS: Record<string, string> = {
  ESPECES: 'Espèces', MOBILE_MONEY: 'Mobile Money', VIREMENT: 'Virement', AUTRE: 'Autre',
};

const todayISO = new Date().toISOString().slice(0, 10);

const TABS = ['Vue générale', ...BUSINESS_UNITS.map((u) => u.label)] as const;

export default function AccountingPage() {
  const { data: session } = useSession();
  const canDelete = session?.user.role === 'ADMIN' || session?.user.role === 'MANAGER';
  const [tab, setTab] = useState<string>('Vue générale');

  const [entries, setEntries] = useState<Entry[]>([]);
  const [summary, setSummary] = useState<AccountingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'ENTREE' | 'SORTIE'>('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [form, setForm] = useState({
    date: todayISO,
    type: 'ENTREE' as 'ENTREE' | 'SORTIE',
    category: CAT_ENTREES[0],
    label: '',
    amount: '',
    paymentMode: 'ESPECES',
    note: '',
  });

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (dateFrom) params.set('from', dateFrom);
    if (dateTo) params.set('to', dateTo);
    const qs = params.toString();
    const [eRes, sRes] = await Promise.all([
      fetch(`/api/accounting${qs ? `?${qs}` : ''}`),
      fetch(`/api/accounting/summary${qs ? `?${qs}` : ''}`),
    ]);
    if (eRes.ok) {
      const d = await eRes.json();
      setEntries(Array.isArray(d) ? d : []);
    }
    if (sRes.ok) setSummary(await sRes.json());
    setLoading(false);
  }, [dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const amount = parseFloat(form.amount);
    if (!amount || amount <= 0) { setError('Montant invalide.'); return; }
    if (!form.label.trim()) { setError('Le libellé est obligatoire.'); return; }

    const res = await fetch('/api/accounting', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, amount }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? 'Erreur lors de l\'enregistrement.');
      return;
    }
    setForm({ ...form, label: '', amount: '', note: '' });
    load();
  }

  async function handleDelete(id: string) {
    if (!confirm('Supprimer cette écriture ?')) return;
    await fetch(`/api/accounting/${id}`, { method: 'DELETE' });
    load();
  }

  const catOptions = form.type === 'ENTREE' ? CAT_ENTREES : CAT_SORTIES;
  const visibleEntries = filterType === 'ALL' ? entries : entries.filter((e) => e.type === filterType);

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

        {tab !== 'Vue générale' ? (
          <StructurePanel
            businessUnit={BUSINESS_UNITS.find((u) => u.label === tab)!.key}
            canDelete={canDelete}
          />
        ) : (
        <>
        {/* KPI */}
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

        {/* Formulaire de saisie */}
        <form onSubmit={handleSubmit} className="card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-1 h-5 rounded-full bg-empire-rouge" />
            <h2 className="hud-title">Nouvelle opération</h2>
          </div>

          {/* Sélecteur type — segmenté */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setForm({ ...form, type: 'ENTREE', category: CAT_ENTREES[0] })}
              className={`flex-1 py-2.5 rounded-lg font-bold text-sm border-2 transition-all ${
                form.type === 'ENTREE'
                  ? 'border-emerald-600 bg-emerald-50 text-emerald-800 shadow-neon'
                  : 'border-hud-line bg-white text-gray-500 hover:border-emerald-400'
              }`}
            >
              ↓ ENTRÉE
            </button>
            <button
              type="button"
              onClick={() => setForm({ ...form, type: 'SORTIE', category: CAT_SORTIES[0] })}
              className={`flex-1 py-2.5 rounded-lg font-bold text-sm border-2 transition-all ${
                form.type === 'SORTIE'
                  ? 'border-empire-rouge bg-red-50 text-empire-rouge shadow-neon-red'
                  : 'border-hud-line bg-white text-gray-500 hover:border-red-400'
              }`}
            >
              ↑ SORTIE
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <label className="hud-label">Date</label>
              <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="form-input" required />
            </div>
            <div>
              <label className="hud-label">Catégorie</label>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="form-select">
                {catOptions.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="hud-label">Montant (FCFA)</label>
              <input type="number" min="0" step="1" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="form-input" placeholder="0" required />
            </div>
            <div className="col-span-2">
              <label className="hud-label">Libellé</label>
              <input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} className="form-input" placeholder="Description de l'opération" required />
            </div>
            <div>
              <label className="hud-label">Mode</label>
              <select value={form.paymentMode} onChange={(e) => setForm({ ...form, paymentMode: e.target.value })} className="form-select">
                {Object.entries(MODE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="col-span-2 md:col-span-3">
              <label className="hud-label">Note (optionnel)</label>
              <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className="form-input" placeholder="Précision éventuelle" />
            </div>
          </div>

          {error && <p className="text-sm text-empire-rouge font-bold">{error}</p>}
          <button type="submit" className="btn-primary">Enregistrer l'opération</button>
        </form>

        {/* Graphiques */}
        {loading ? (
          <div className="card p-6 flex items-center justify-center h-72">
            <div className="w-8 h-8 border-2 border-hud-cyan border-t-transparent rounded-full animate-spin" />
          </div>
        ) : summary ? (
          <AccountingCharts summary={summary} animate />
        ) : null}

        {/* Journal des opérations */}
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-hud-line flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <div className="w-1 h-5 rounded-full bg-hud-cyan" />
              <h2 className="hud-title">Journal des opérations</h2>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
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
              <div className="flex gap-1">
                {(['ALL', 'ENTREE', 'SORTIE'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setFilterType(t)}
                    className={`text-xs font-bold px-3 py-1 rounded-lg border transition-all ${
                      filterType === t ? 'border-hud-cyan bg-hud-cyan/10 text-hud-cyan' : 'border-transparent text-gray-500 hover:text-gray-800'
                    }`}
                  >
                    {t === 'ALL' ? 'Tout' : t === 'ENTREE' ? 'Entrées' : 'Sorties'}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="hud-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Catégorie</th>
                  <th>Libellé</th>
                  <th>Mode</th>
                  <th className="text-right">Montant</th>
                  <th>Saisi par</th>
                  {canDelete && <th></th>}
                </tr>
              </thead>
              <tbody>
                {visibleEntries.length === 0 ? (
                  <tr><td colSpan={canDelete ? 8 : 7} className="text-center italic text-gray-500 py-6">Aucune opération.</td></tr>
                ) : visibleEntries.map((e) => (
                  <tr key={e.id}>
                    <td className="whitespace-nowrap">{new Date(e.date).toLocaleDateString('fr-FR')}</td>
                    <td>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-bold border ${
                        e.type === 'ENTREE' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-red-100 text-red-800 border-red-300'
                      }`}>
                        {e.type === 'ENTREE' ? 'Entrée' : 'Sortie'}
                      </span>
                    </td>
                    <td>{e.category}</td>
                    <td className="font-semibold">{e.label}</td>
                    <td className="text-xs">{MODE_LABELS[e.paymentMode] ?? e.paymentMode}</td>
                    <td className="text-right font-bold tabular-nums whitespace-nowrap" style={{ color: e.type === 'ENTREE' ? '#2f7d4f' : '#b3122a' }}>
                      {e.type === 'ENTREE' ? '+' : '−'} {formatFCFA(e.amount)}
                    </td>
                    <td className="text-xs text-gray-500">{e.enteredBy}</td>
                    {canDelete && (
                      <td>
                        <button onClick={() => handleDelete(e.id)} className="btn-danger text-xs py-1 px-2">Suppr.</button>
                      </td>
                    )}
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
