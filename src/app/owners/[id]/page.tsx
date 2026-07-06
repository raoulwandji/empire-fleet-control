'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
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

type Prefinancement = {
  id: string;
  weekStart: string;
  amount: string;
  note: string | null;
  enteredBy: { fullName: string };
  driver: { id: string; fullName: string; vehiclePlate: string; code: string } | null;
};

type Owner = {
  id: string;
  fullName: string;
  phone: string;
  location: string | null;
  drivers: Driver[];
  commissions: Commission[];
  prefinancements: Prefinancement[];
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

type DriverOption = { id: string; fullName: string; vehiclePlate: string; code: string };

type EntryFormProps = {
  label: string;
  apiPath: string;
  currentWeekIso: string;
  requireNote?: boolean;
  drivers?: DriverOption[];
  onSaved: () => void;
  onCancel: () => void;
};

function EntryForm({ label, apiPath, currentWeekIso, requireNote = false, drivers, onSaved, onCancel }: EntryFormProps) {
  const [week, setWeek] = useState(currentWeekIso.slice(0, 10));
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [driverId, setDriverId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (requireNote && !note.trim()) { setError("L'objet du préfinancement est obligatoire."); return; }
    setSaving(true);
    setError('');
    const body: Record<string, unknown> = { weekStart: week, amount: Number(amount), note: note.trim() || undefined };
    if (driverId) body.driverId = driverId;
    const res = await fetch(apiPath, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) { const d = await res.json(); setError(d.error ?? 'Erreur'); setSaving(false); return; }
    onSaved();
  }

  return (
    <div className="p-4 border-b border-hud-line bg-hud-panel2">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="hud-label">Semaine (lundi)</label>
            <input type="date" className="hud-input" value={week} onChange={(e) => setWeek(e.target.value)} required />
          </div>
          <div>
            <label className="hud-label">Montant (FCFA) *</label>
            <input type="number" min="1" step="1" className="hud-input" value={amount}
              onChange={(e) => setAmount(e.target.value)} placeholder="Ex: 50000" required />
          </div>
        </div>

        {/* Sélection du véhicule (uniquement pour les préfinancements) */}
        {drivers && drivers.length > 0 && (
          <div>
            <label className="hud-label">Véhicule préfinancé *</label>
            <select
              value={driverId}
              onChange={(e) => setDriverId(e.target.value)}
              className="hud-select w-full"
              required
            >
              <option value="">— Sélectionner le véhicule concerné —</option>
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.vehiclePlate} — {d.fullName} ({d.code})
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="hud-label">
            {requireNote ? 'Objet du préfinancement *' : 'Note (optionnel)'}
          </label>
          {requireNote ? (
            <textarea
              rows={3}
              className="hud-input resize-none"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Décrivez l'objet et la raison de ce préfinancement…"
              required
            />
          ) : (
            <input className="hud-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Remarque…" />
          )}
        </div>
        {error && <p className="text-empire-rougeVif text-sm">{error}</p>}
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onCancel} className="btn-secondary text-xs py-1.5 px-3">Annuler</button>
          <button type="submit" disabled={saving} className="btn-primary text-xs py-1.5 px-3">
            {saving ? 'Enregistrement...' : `Saisir ${label}`}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function OwnerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: session } = useSession();
  const router = useRouter();
  const isAdminOrManager = session?.user.role === 'ADMIN' || session?.user.role === 'MANAGER';

  const [owner, setOwner] = useState<Owner | null>(null);
  const [weekStart, setWeekStart] = useState('');
  const [selectedWeek, setSelectedWeek] = useState(''); // '' = semaine en cours
  const [loading, setLoading] = useState(true);
  const [showCommForm, setShowCommForm] = useState(false);
  const [showPrefForm, setShowPrefForm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function reload(week = selectedWeek) {
    setLoading(true);
    const qs = week ? `?weekStart=${encodeURIComponent(week)}` : '';
    fetch(`/api/owners/${id}${qs}`)
      .then((r) => r.json())
      .then((data) => { setOwner(data.owner); setWeekStart(data.weekStart); setLoading(false); });
  }

  useEffect(() => { reload(); }, [id]);

  async function handleDeleteComm(ws: string) {
    if (!confirm('Supprimer cette commission ?')) return;
    await fetch(`/api/owners/${id}/commissions?weekStart=${encodeURIComponent(ws)}`, { method: 'DELETE' });
    reload();
  }

  async function handleDeletePref(prefId: string) {
    if (!confirm('Supprimer ce préfinancement ?')) return;
    await fetch(`/api/owners/${id}/prefinancements?id=${encodeURIComponent(prefId)}`, { method: 'DELETE' });
    reload();
  }

  async function handleDeleteOwner() {
    if (!confirm(`Supprimer définitivement le propriétaire "${owner?.fullName}" ? Cette action est irréversible.`)) return;
    setDeleting(true);
    const res = await fetch(`/api/owners/${id}`, { method: 'DELETE' });
    if (res.ok) {
      router.replace('/owners');
    } else {
      alert('Erreur lors de la suppression.');
      setDeleting(false);
    }
  }

  if (loading) return (
    <div className="min-h-screen"><Navbar />
      <div className="p-8 text-hud-cyan animate-pulse text-sm tracking-widest">⟳ CHARGEMENT...</div>
    </div>
  );

  if (!owner) return (
    <div className="min-h-screen"><Navbar />
      <div className="p-8 text-empire-rougeVif">Propriétaire introuvable.</div>
    </div>
  );

  const weekDrivers = owner.drivers.map((d) => ({
    ...d,
    weekTotal: d.payments.reduce((s, p) => s + Number(p.amount), 0),
  }));
  const totalWeek = weekDrivers.reduce((s, d) => s + d.weekTotal, 0);

  const currentWeekIso = weekStart ? weekStart.slice(0, 10) : getWeekStart().toISOString().slice(0, 10);

  const currentComm = owner.commissions.find((c) => c.weekStart.slice(0, 10) === currentWeekIso);
  const commAmt = currentComm ? Number(currentComm.amount) : 0;
  const prefAmt = owner.prefinancements
    .filter((p) => p.weekStart.slice(0, 10) === currentWeekIso)
    .reduce((s, p) => s + Number(p.amount), 0);
  const netWeek = totalWeek - commAmt - prefAmt;

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="p-6 max-w-5xl mx-auto space-y-6">

        {/* En-tête */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <Link href="/owners" className="text-xs text-gray-500 hover:text-hud-cyan transition-colors">← Propriétaires</Link>
            <h1 className="font-display font-bold text-2xl text-transparent bg-clip-text bg-gradient-to-r from-hud-cyan to-empire-rouge tracking-widest mt-1">
              {owner.fullName.toUpperCase()}
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">{owner.phone}{owner.location ? ` — ${owner.location}` : ''}</p>
          </div>
          {isAdminOrManager && (
            <button
              onClick={handleDeleteOwner}
              disabled={deleting}
              className="btn-danger text-xs px-3 py-1.5 shrink-0"
            >
              {deleting ? 'Suppression...' : 'Supprimer le propriétaire'}
            </button>
          )}
        </div>

        {/* Filtre : semaine du bilan */}
        <div className="card p-4 flex flex-wrap items-end gap-3">
          <div>
            <label className="hud-label">Semaine du bilan</label>
            <input
              type="date"
              className="hud-input"
              value={selectedWeek || currentWeekIso}
              onChange={(e) => { setSelectedWeek(e.target.value); reload(e.target.value); }}
            />
          </div>
          <div className="text-xs text-gray-500 pb-2">
            Bilan affiché pour la semaine du{' '}
            <span className="text-hud-cyan font-semibold">{weekStart ? fmtDate(weekStart) : '…'}</span>
          </div>
          {selectedWeek && (
            <button
              onClick={() => { setSelectedWeek(''); reload(''); }}
              className="btn-secondary text-xs py-1.5 px-3 ml-auto"
            >
              Semaine en cours
            </button>
          )}
        </div>

        {/* Résumé semaine — 5 indicateurs */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="stat-card">
            <span className="stat-label">Versements bruts</span>
            <span className="stat-value-accent">{fmtAmount(totalWeek)}</span>
            <span className="text-[10px] text-gray-600">FCFA · semaine</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Commission Empire</span>
            <span className={`font-display font-bold text-lg ${commAmt > 0 ? 'text-empire-rougeVif' : 'text-gray-600'}`}>
              {commAmt > 0 ? `− ${fmtAmount(commAmt)}` : '—'}
            </span>
            <span className="text-[10px] text-gray-600">FCFA</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Préfinancement Empire</span>
            <span className={`font-display font-bold text-lg ${prefAmt > 0 ? 'text-yellow-400' : 'text-gray-600'}`}>
              {prefAmt > 0 ? `− ${fmtAmount(prefAmt)}` : '—'}
            </span>
            <span className="text-[10px] text-gray-600">FCFA</span>
          </div>
          <div className="stat-card col-span-2">
            <span className="stat-label">Net à verser au propriétaire</span>
            <span className={`font-display font-bold text-xl ${netWeek >= 0 ? 'text-hud-green' : 'text-empire-rougeVif'}`}>
              {fmtAmount(netWeek)} FCFA
            </span>
            <span className="text-[10px] text-gray-600">Versements − Comm. − Préfin.</span>
          </div>
        </div>

        {/* Chauffeurs */}
        <div className="card overflow-hidden">
          <div className="p-4 border-b border-hud-line">
            <h2 className="hud-title">Chauffeurs ({owner.drivers.length})</h2>
          </div>
          {owner.drivers.length === 0 ? (
            <p className="p-6 text-gray-500 text-sm text-center">Aucun chauffeur actif lié à ce propriétaire.</p>
          ) : (
            <table className="hud-table">
              <thead>
                <tr>
                  <th>Code</th><th>Nom</th><th>Contrat</th><th>Plaque</th>
                  <th className="text-right">Versements semaine</th>
                </tr>
              </thead>
              <tbody>
                {weekDrivers.map((d) => (
                  <tr key={d.id}>
                    <td><Link href={`/drivers/${d.id}`} className="neon-link font-mono text-xs">{d.code}</Link></td>
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
                  <td colSpan={4} className="p-3 text-right text-xs text-gray-400 font-semibold uppercase tracking-wider">Total brut semaine</td>
                  <td className="p-3 text-right font-bold text-hud-cyan">{fmtAmount(totalWeek)} FCFA</td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>

        {/* Commissions Empire */}
        <div className="card overflow-hidden">
          <div className="p-4 border-b border-hud-line flex items-center justify-between">
            <div>
              <h2 className="hud-title">Commissions Empire reversées</h2>
              <p className="text-xs text-gray-500 mt-0.5">Déduites du versement total de la semaine</p>
            </div>
            {isAdminOrManager && (
              <button onClick={() => { setShowCommForm((v) => !v); setShowPrefForm(false); }} className="btn-primary text-xs px-3 py-1.5">
                {showCommForm ? 'Annuler' : '+ Saisir commission'}
              </button>
            )}
          </div>
          {showCommForm && (
            <EntryForm
              label="commission"
              apiPath={`/api/owners/${id}/commissions`}
              currentWeekIso={currentWeekIso}
              onSaved={() => { setShowCommForm(false); reload(); }}
              onCancel={() => setShowCommForm(false)}
            />
          )}
          <HistoryTable
            rows={owner.commissions}
            colorClass="text-empire-rougeVif"
            onDelete={isAdminOrManager ? (ws) => handleDeleteComm(ws) : undefined}
          />
        </div>

        {/* Préfinancements Empire */}
        <div className="card overflow-hidden">
          <div className="p-4 border-b border-hud-line flex items-center justify-between">
            <div>
              <h2 className="hud-title">Préfinancements Empire</h2>
              <p className="text-xs text-gray-500 mt-0.5">Avances accordées par Empire, déduites du versement de la semaine</p>
            </div>
            {isAdminOrManager && (
              <button onClick={() => { setShowPrefForm((v) => !v); setShowCommForm(false); }} className="btn-primary text-xs px-3 py-1.5">
                {showPrefForm ? 'Annuler' : '+ Saisir préfinancement'}
              </button>
            )}
          </div>
          {showPrefForm && (
            <EntryForm
              label="préfinancement"
              apiPath={`/api/owners/${id}/prefinancements`}
              currentWeekIso={currentWeekIso}
              requireNote
              drivers={owner.drivers.map((d) => ({ id: d.id, fullName: d.fullName, vehiclePlate: d.vehiclePlate, code: d.code }))}
              onSaved={() => { setShowPrefForm(false); reload(); }}
              onCancel={() => setShowPrefForm(false)}
            />
          )}
          <PrefHistoryTable
            rows={owner.prefinancements}
            onDelete={isAdminOrManager ? (prefId) => handleDeletePref(prefId) : undefined}
          />
        </div>
      </div>
    </div>
  );
}

// Table historique commissions (simple)
type CommRow = { id: string; weekStart: string; amount: string; note: string | null; enteredBy: { fullName: string } };

function HistoryTable({ rows, colorClass, onDelete }: {
  rows: CommRow[];
  colorClass: string;
  onDelete?: (weekStart: string) => void;
}) {
  if (rows.length === 0) return <p className="p-6 text-gray-500 text-sm text-center">Aucun enregistrement.</p>;
  return (
    <table className="hud-table">
      <thead>
        <tr>
          <th>Semaine</th>
          <th className="text-right">Montant</th>
          <th>Note</th>
          <th>Saisi par</th>
          {onDelete && <th></th>}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id}>
            <td className="font-mono text-xs">{fmtDate(r.weekStart)}</td>
            <td className={`text-right font-semibold ${colorClass}`}>{Number(r.amount).toLocaleString('fr-FR')} FCFA</td>
            <td className="text-xs text-gray-500">{r.note ?? '—'}</td>
            <td className="text-xs text-gray-500">{r.enteredBy.fullName}</td>
            {onDelete && (
              <td>
                <button onClick={() => onDelete(r.weekStart)} className="text-xs text-red-500 hover:text-empire-rougeVif transition-colors">Supprimer</button>
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// Cards historique préfinancements (avec véhicule + objet)
function PrefHistoryTable({ rows, onDelete }: {
  rows: Prefinancement[];
  onDelete?: (id: string) => void;
}) {
  if (rows.length === 0) return <p className="p-6 text-gray-500 text-sm text-center">Aucun préfinancement enregistré.</p>;
  return (
    <div className="divide-y divide-hud-line">
      {rows.map((r) => (
        <div key={r.id} className="p-4 space-y-2">
          <div className="flex items-start justify-between flex-wrap gap-2">
            <div className="space-y-1">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="font-mono text-xs text-gray-500">{fmtDate(r.weekStart)}</span>
                <span className="font-display font-bold text-base text-yellow-400">
                  {Number(r.amount).toLocaleString('fr-FR')} FCFA
                </span>
              </div>
              {/* Véhicule concerné */}
              {r.driver ? (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-hud-cyan uppercase tracking-widest font-semibold">Véhicule :</span>
                  <Link href={`/drivers/${r.driver.id}`} className="neon-link text-xs font-mono">
                    {r.driver.vehiclePlate}
                  </Link>
                  <span className="text-xs text-gray-400">— {r.driver.fullName} ({r.driver.code})</span>
                </div>
              ) : (
                <span className="text-xs text-gray-600 italic">Véhicule non précisé</span>
              )}
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-xs text-gray-600">par {r.enteredBy.fullName}</span>
              {onDelete && (
                <button onClick={() => onDelete(r.id)} className="text-xs text-red-500 hover:text-empire-rougeVif transition-colors">
                  Supprimer
                </button>
              )}
            </div>
          </div>
          {/* Objet du préfinancement */}
          {r.note && (
            <div className="bg-hud-panel2 border border-yellow-700/30 rounded-lg px-3 py-2">
              <span className="text-[10px] text-yellow-400 uppercase tracking-widest font-semibold block mb-1">Objet du préfinancement</span>
              <p className="text-sm text-gray-300 leading-relaxed">{r.note}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
