'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { useSession } from 'next-auth/react';

type Driver = {
  id: string;
  code: string;
  fullName: string;
  contractType: string;
  vehiclePlate: string;
  payments: { amount: string; date: string }[];
};

type Commission = {
  id: string;
  weekStart: string;
  amount: string;
  note: string | null;
  enteredBy: { fullName: string };
};

type Owner = {
  id: string;
  fullName: string;
  phone: string;
  location: string | null;
  drivers: Driver[];
  commissions: Commission[];
};

function getWeekStart(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtAmount(v: string | number) {
  return Number(v).toLocaleString('fr-FR', { minimumFractionDigits: 0 });
}

export default function OwnerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: session } = useSession();
  const isAdminOrManager = session?.user.role === 'ADMIN' || session?.user.role === 'MANAGER';

  const [owner, setOwner] = useState<Owner | null>(null);
  const [weekStart, setWeekStart] = useState('');
  const [loading, setLoading] = useState(true);

  // Formulaire commission
  const [showCommForm, setShowCommForm] = useState(false);
  const [commAmount, setCommAmount] = useState('');
  const [commNote, setCommNote] = useState('');
  const [commWeek, setCommWeek] = useState(() => getWeekStart().toISOString().slice(0, 10));
  const [savingComm, setSavingComm] = useState(false);
  const [commError, setCommError] = useState('');

  function reload() {
    setLoading(true);
    fetch(`/api/owners/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setOwner(data.owner);
        setWeekStart(data.weekStart);
        setLoading(false);
      });
  }

  useEffect(() => { reload(); }, [id]);

  async function handleAddCommission(e: React.FormEvent) {
    e.preventDefault();
    setSavingComm(true);
    setCommError('');
    const res = await fetch(`/api/owners/${id}/commissions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ weekStart: commWeek, amount: Number(commAmount), note: commNote || undefined }),
    });
    if (!res.ok) {
      const d = await res.json();
      setCommError(d.error ?? 'Erreur');
      setSavingComm(false);
      return;
    }
    setShowCommForm(false);
    setCommAmount('');
    setCommNote('');
    setSavingComm(false);
    reload();
  }

  async function handleDeleteCommission(ws: string) {
    if (!confirm('Supprimer cette commission ?')) return;
    await fetch(`/api/owners/${id}/commissions?weekStart=${encodeURIComponent(ws)}`, { method: 'DELETE' });
    reload();
  }

  if (loading) return (
    <div className="min-h-screen">
      <Navbar />
      <div className="p-8 text-gray-500 text-sm">Chargement...</div>
    </div>
  );

  if (!owner) return (
    <div className="min-h-screen">
      <Navbar />
      <div className="p-8 text-empire-rougeVif">Propriétaire introuvable.</div>
    </div>
  );

  // Calculs semaine courante
  const weekDrivers = owner.drivers.map((d) => ({
    ...d,
    weekTotal: d.payments.reduce((s, p) => s + Number(p.amount), 0),
  }));
  const totalWeek = weekDrivers.reduce((s, d) => s + d.weekTotal, 0);

  const currentWeekIso = weekStart ? weekStart.slice(0, 10) : getWeekStart().toISOString().slice(0, 10);
  const currentWeekCommission = owner.commissions.find(
    (c) => c.weekStart.slice(0, 10) === currentWeekIso
  );
  const netWeek = totalWeek - (currentWeekCommission ? Number(currentWeekCommission.amount) : 0);

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="p-6 max-w-5xl mx-auto space-y-6">

        {/* En-tête */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <Link href="/owners" className="text-xs text-gray-500 hover:text-hud-cyan transition-colors">← Propriétaires</Link>
            <h1 className="font-display font-bold text-2xl text-transparent bg-clip-text bg-gradient-to-r from-hud-cyan to-white tracking-widest mt-1">
              {owner.fullName.toUpperCase()}
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">{owner.phone}{owner.location ? ` — ${owner.location}` : ''}</p>
          </div>
        </div>

        {/* Résumé semaine */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="stat-card">
            <span className="stat-label">Versements semaine</span>
            <span className="stat-value-accent">{fmtAmount(totalWeek)} FCFA</span>
            <span className="text-[10px] text-gray-600">
              Semaine du {weekStart ? fmtDate(weekStart) : '—'}
            </span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Commission Empire</span>
            <span className="stat-value text-empire-rougeVif">
              {currentWeekCommission ? fmtAmount(currentWeekCommission.amount) : '—'} FCFA
            </span>
            <span className="text-[10px] text-gray-600">Semaine en cours</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Net propriétaire</span>
            <span className="stat-value text-hud-green">
              {currentWeekCommission ? fmtAmount(netWeek) : '—'} FCFA
            </span>
            <span className="text-[10px] text-gray-600">Versements − Commission</span>
          </div>
        </div>

        {/* Chauffeurs de ce propriétaire */}
        <div className="card overflow-hidden">
          <div className="p-4 border-b border-hud-line flex items-center justify-between">
            <h2 className="hud-title">Chauffeurs ({owner.drivers.length})</h2>
          </div>
          {owner.drivers.length === 0 ? (
            <p className="p-6 text-gray-500 text-sm text-center">Aucun chauffeur actif lié à ce propriétaire.</p>
          ) : (
            <table className="hud-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Nom</th>
                  <th>Contrat</th>
                  <th>Plaque</th>
                  <th className="text-right">Versements semaine</th>
                </tr>
              </thead>
              <tbody>
                {weekDrivers.map((d) => (
                  <tr key={d.id}>
                    <td>
                      <Link href={`/drivers/${d.id}`} className="neon-link font-mono text-xs">{d.code}</Link>
                    </td>
                    <td className="font-medium text-gray-100">{d.fullName}</td>
                    <td>
                      <span className={d.contractType === 'CONDITION_VENTE' ? 'badge-cv' : 'badge-loc'}>
                        {d.contractType === 'CONDITION_VENTE' ? 'CV' : 'Loc'}
                      </span>
                    </td>
                    <td className="font-mono text-xs text-gray-400">{d.vehiclePlate}</td>
                    <td className="text-right font-semibold text-hud-cyan">
                      {d.weekTotal > 0 ? `${fmtAmount(d.weekTotal)} FCFA` : <span className="text-gray-600">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-hud-panel2">
                  <td colSpan={4} className="p-3 text-right text-xs text-gray-400 font-semibold uppercase tracking-wider">Total semaine</td>
                  <td className="p-3 text-right font-bold text-hud-cyan">{fmtAmount(totalWeek)} FCFA</td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>

        {/* Commissions */}
        <div className="card overflow-hidden">
          <div className="p-4 border-b border-hud-line flex items-center justify-between">
            <h2 className="hud-title">Commissions Empire reversées</h2>
            {isAdminOrManager && (
              <button onClick={() => setShowCommForm((v) => !v)} className="btn-primary text-xs px-3 py-1.5">
                {showCommForm ? 'Annuler' : '+ Saisir commission'}
              </button>
            )}
          </div>

          {showCommForm && (
            <div className="p-4 border-b border-hud-line bg-hud-panel2">
              <form onSubmit={handleAddCommission} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                <div>
                  <label className="hud-label">Semaine (lundi)</label>
                  <input type="date" className="hud-input" value={commWeek}
                    onChange={(e) => setCommWeek(e.target.value)} required />
                </div>
                <div>
                  <label className="hud-label">Montant commission (FCFA) *</label>
                  <input type="number" min="1" step="1" className="hud-input" value={commAmount}
                    onChange={(e) => setCommAmount(e.target.value)} placeholder="Ex: 25000" required />
                </div>
                <div>
                  <label className="hud-label">Note (optionnel)</label>
                  <input className="hud-input" value={commNote}
                    onChange={(e) => setCommNote(e.target.value)} placeholder="Remarque…" />
                </div>
                {commError && <p className="col-span-3 text-empire-rougeVif text-sm">{commError}</p>}
                <div className="col-span-3 flex justify-end">
                  <button type="submit" disabled={savingComm} className="btn-primary">
                    {savingComm ? 'Enregistrement...' : 'Enregistrer commission'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {owner.commissions.length === 0 ? (
            <p className="p-6 text-gray-500 text-sm text-center">Aucune commission enregistrée.</p>
          ) : (
            <table className="hud-table">
              <thead>
                <tr>
                  <th>Semaine</th>
                  <th className="text-right">Commission Empire</th>
                  <th className="text-right">Net propriétaire</th>
                  <th>Note</th>
                  <th>Saisi par</th>
                  {isAdminOrManager && <th></th>}
                </tr>
              </thead>
              <tbody>
                {owner.commissions.map((c) => {
                  // Chercher les versements de cette semaine pour ce propriétaire
                  // (approximation : on ne recharge pas toutes les semaines ici)
                  const commAmt = Number(c.amount);
                  return (
                    <tr key={c.id}>
                      <td className="font-mono text-xs">{fmtDate(c.weekStart)}</td>
                      <td className="text-right font-semibold text-empire-rougeVif">{fmtAmount(commAmt)} FCFA</td>
                      <td className="text-right text-gray-400 text-xs">—</td>
                      <td className="text-xs text-gray-500">{c.note ?? '—'}</td>
                      <td className="text-xs text-gray-500">{c.enteredBy.fullName}</td>
                      {isAdminOrManager && (
                        <td>
                          <button
                            onClick={() => handleDeleteCommission(c.weekStart)}
                            className="text-xs text-red-500 hover:text-empire-rougeVif transition-colors"
                          >
                            Supprimer
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
