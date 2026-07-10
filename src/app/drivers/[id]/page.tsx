'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import Navbar from '@/components/Navbar';
import { formatFCFA, formatWeekRange, getWeekStart, getWeekEnd } from '@/lib/business';
import clsx from 'clsx';

type DriverDetail = any;

const TABS = ['Profil', 'Versements/Loyers', 'Caution', 'Portefeuille', 'Suivi hebdo', 'Commentaires'] as const;

// Affiche l'identifiant (@username) de l'utilisateur qui a saisi la donnée, en plus de son nom.
function fmtEntered(u?: { fullName: string; username?: string } | null) {
  if (!u) return '—';
  return u.username ? `${u.fullName} (@${u.username})` : u.fullName;
}

export default function DriverDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { data: session } = useSession();
  const [driver, setDriver] = useState<DriverDetail | null>(null);
  const [tab, setTab] = useState<typeof TABS[number]>('Profil');
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  const fetchDriver = useCallback(async () => {
    const res = await fetch(`/api/drivers/${params.id}`);
    if (res.ok) setDriver(await res.json());
    setLoading(false);
  }, [params.id]);

  useEffect(() => { fetchDriver(); }, [fetchDriver]);

  if (loading) return <Shell><p className="text-hud-cyan animate-pulse tracking-widest text-sm">⟳ CHARGEMENT...</p></Shell>;
  if (!driver) return <Shell><p className="text-empire-rougeVif">Chauffeur introuvable.</p></Shell>;

  const isAdmin = session?.user.role === 'ADMIN';
  const isManager = session?.user.role === 'MANAGER';
  const isAssigned = driver.assignments.some((a: any) => a.employee.id === session?.user.id);
  const canWrite = isAdmin || isManager || isAssigned;
  const isCV = driver.contractType === 'CONDITION_VENTE';

  async function handleDelete() {
    if (!confirm(`Supprimer définitivement ${driver.fullName} (${driver.code}) ? Irréversible.`)) return;
    setDeleting(true);
    const res = await fetch(`/api/drivers/${driver.id}`, { method: 'DELETE' });
    setDeleting(false);
    if (!res.ok) { const d = await res.json(); alert(d.error ?? 'Erreur.'); return; }
    router.push('/drivers');
  }

  return (
    <Shell>
      {/* En-tête */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="font-display font-bold text-2xl text-transparent bg-clip-text bg-gradient-to-r from-hud-cyan to-empire-rouge tracking-widest">
            {driver.fullName}
          </h1>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="font-mono text-hud-cyan text-sm">{driver.code}</span>
            <span className="text-gray-600">·</span>
            <span className="font-mono text-gray-400 text-sm">{driver.vehiclePlate}</span>
            <span className="text-gray-600">·</span>
            <span>{isCV ? <span className="badge-cv">Condition-Vente</span> : <span className="badge-loc">Location</span>}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {!canWrite && (
            <span className="text-xs bg-yellow-900/30 text-yellow-400 border border-yellow-700/50 px-3 py-1 rounded-full">
              Lecture seule — non affecté
            </span>
          )}
          {canWrite && (
            <>
              <Link href={`/drivers/${driver.id}/edit`} className="btn-secondary text-xs py-1.5 px-3">Modifier</Link>
              <button onClick={handleDelete} disabled={deleting} className="btn-danger text-xs py-1.5 px-3">
                {deleting ? '⟳ Suppression...' : 'Supprimer'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        {isCV ? (
          <>
            <StatCard label="Montant fixé" value={formatFCFA(Number(driver.totalPriceFixed ?? 0))} />
            <StatCard label="Total versé" value={formatFCFA(driver.summary.totalPaid)} accent />
            <StatCard label="Avance / caution" value={formatFCFA(driver.summary.cautionAdvance ?? 0)} accent />
            <StatCard label="Portefeuille" value={formatFCFA(driver.summary.walletBalance ?? 0)} accent />
            <StatCard label="Pénalités appliquées" value={formatFCFA(driver.summary.appliedPenalties)} />
            <StatCard label="Reste à payer" value={formatFCFA(driver.summary.resteAPayer)} highlight />
          </>
        ) : (
          <>
            <StatCard label="Caution référence" value={formatFCFA(Number(driver.cautionReference ?? 0))} />
            <StatCard label="Solde caution" value={formatFCFA(driver.summary.cautionBalance)} accent
              danger={driver.cautionMinThreshold != null && driver.summary.cautionBalance < Number(driver.cautionMinThreshold)} />
            <StatCard label="Seuil minimal" value={formatFCFA(Number(driver.cautionMinThreshold ?? 0))} />
            <StatCard label="Total loyers" value={formatFCFA(driver.summary.totalPaid)} />
            <StatCard label="Pénalités en attente" value={formatFCFA(driver.summary.pendingPenalties)} danger={driver.summary.pendingPenalties > 0} />
          </>
        )}
      </div>

      {/* Onglets */}
      <div className="flex gap-1 mb-6 border-b border-hud-line overflow-x-auto">
        {TABS.filter((t) => t !== 'Portefeuille' || isCV).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={clsx(
              'px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-all duration-150',
              tab === t
                ? 'border-hud-cyan text-hud-cyan'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            )}
          >
            {t === 'Caution' && isCV ? 'Avance / caution' : t}
          </button>
        ))}
      </div>

      {tab === 'Profil' && <ProfileTab driver={driver} canWrite={canWrite} onChange={fetchDriver} />}
      {tab === 'Versements/Loyers' && <PaymentsTab driver={driver} canWrite={canWrite} onChange={fetchDriver} />}
      {tab === 'Caution' && <CautionTab driver={driver} canWrite={canWrite} onChange={fetchDriver} isCV={isCV} />}
      {tab === 'Portefeuille' && isCV && <WalletTab driver={driver} canWrite={canWrite} onChange={fetchDriver} />}
      {tab === 'Suivi hebdo' && <WeeklyTab driver={driver} canWrite={canWrite} onChange={fetchDriver} />}
      {tab === 'Commentaires' && <CommentsTab driver={driver} canWrite={canWrite} onChange={fetchDriver} />}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="p-6 max-w-5xl mx-auto">{children}</div>
    </div>
  );
}

function StatCard({ label, value, highlight, accent, danger }: { label: string; value: string; highlight?: boolean; accent?: boolean; danger?: boolean }) {
  return (
    <div className={clsx('stat-card', danger ? 'border-empire-rouge/50 bg-empire-rouge/5' : highlight ? 'border-hud-cyan/40' : '')}>
      <div className="stat-label">{label}</div>
      <div className={clsx(danger ? 'stat-value-danger' : accent || highlight ? 'stat-value-accent' : 'stat-value')}>
        {value}
      </div>
    </div>
  );
}

function ProfileTab({ driver, canWrite, onChange }: { driver: DriverDetail; canWrite: boolean; onChange: () => void }) {
  const [owners, setOwners] = useState<{ id: string; fullName: string; phone: string; location: string | null }[]>([]);
  const [showOwnerEdit, setShowOwnerEdit] = useState(false);
  const [selectedOwnerId, setSelectedOwnerId] = useState(driver.ownerId ?? '');
  const [savingOwner, setSavingOwner] = useState(false);
  const [ownerError, setOwnerError] = useState('');

  useEffect(() => {
    fetch('/api/owners').then((r) => r.json()).then(setOwners).catch(() => {});
  }, []);

  async function handleOwnerSave() {
    if (!selectedOwnerId) return;
    setSavingOwner(true);
    setOwnerError('');
    const owner = owners.find((o) => o.id === selectedOwnerId);
    if (!owner) { setSavingOwner(false); return; }
    const res = await fetch(`/api/drivers/${driver.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ownerId: owner.id,
        ownerName: owner.fullName,
        ownerPhone: owner.phone,
        ownerLocation: owner.location ?? '',
      }),
    });
    setSavingOwner(false);
    if (!res.ok) { const d = await res.json(); setOwnerError(d.error ?? 'Erreur'); return; }
    setShowOwnerEdit(false);
    onChange();
  }

  return (
    <div className="space-y-4">
      <div className="card p-5 grid grid-cols-2 gap-4 text-sm">
        {[
          ['Téléphone', driver.phone], ['Localisation', driver.location],
          ['N° de permis', driver.licenseNumber],
          ['Garant', driver.guarantorName], ['Tél. garant', driver.guarantorPhone],
          ['Couleur véhicule', driver.vehicleColor],
          ['Mise en service', driver.vehicleInService ? new Date(driver.vehicleInService).toLocaleDateString('fr-FR') : null],
          ['Affecté à', driver.assignments.map((a: any) => a.employee.fullName).join(', ') || null],
        ].map(([lbl, val]) => (
          <div key={lbl as string}>
            <div className="hud-label">{lbl as string}</div>
            <div className="text-gray-300">{(val as string) || '—'}</div>
          </div>
        ))}
      </div>

      {/* Bloc propriétaire séparé avec option de modification */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="hud-title">Propriétaire du véhicule</span>
          {canWrite && (
            <button
              onClick={() => { setShowOwnerEdit((v) => !v); setOwnerError(''); setSelectedOwnerId(driver.ownerId ?? ''); }}
              className="text-xs text-hud-cyan hover:underline"
            >
              {showOwnerEdit ? 'Annuler' : 'Modifier'}
            </button>
          )}
        </div>

        {!showOwnerEdit ? (
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="hud-label">Nom</div>
              <div className="text-gray-300">{driver.ownerName || '—'}</div>
            </div>
            <div>
              <div className="hud-label">Téléphone</div>
              <div className="text-gray-300">{driver.ownerPhone || '—'}</div>
            </div>
            <div>
              <div className="hud-label">Localisation</div>
              <div className="text-gray-300">{driver.ownerLocation || '—'}</div>
            </div>
            {driver.ownerId && (
              <div>
                <div className="hud-label">Fiche propriétaire</div>
                <a href={`/owners/${driver.ownerId}`} className="neon-link text-sm">Voir le profil →</a>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="hud-label">Sélectionner un propriétaire *</label>
              <select
                value={selectedOwnerId}
                onChange={(e) => setSelectedOwnerId(e.target.value)}
                className="hud-select w-full"
              >
                <option value="">— Choisir un propriétaire —</option>
                {owners.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.fullName} · {o.phone}{o.location ? ` · ${o.location}` : ''}
                  </option>
                ))}
              </select>
            </div>
            {selectedOwnerId && (() => {
              const o = owners.find((x) => x.id === selectedOwnerId);
              return o ? (
                <div className="bg-hud-panel2 border border-hud-cyan/20 rounded-lg p-3 text-sm space-y-1">
                  <div className="flex gap-2"><span className="text-gray-500 w-24">Nom :</span><span className="text-gray-200 font-medium">{o.fullName}</span></div>
                  <div className="flex gap-2"><span className="text-gray-500 w-24">Téléphone :</span><span className="text-gray-200">{o.phone}</span></div>
                  {o.location && <div className="flex gap-2"><span className="text-gray-500 w-24">Localisation :</span><span className="text-gray-200">{o.location}</span></div>}
                </div>
              ) : null;
            })()}
            {ownerError && <p className="text-empire-rougeVif text-xs">{ownerError}</p>}
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowOwnerEdit(false)} className="btn-secondary text-xs py-1.5 px-3">Annuler</button>
              <button onClick={handleOwnerSave} disabled={!selectedOwnerId || savingOwner} className="btn-primary text-xs py-1.5 px-3">
                {savingOwner ? '⟳ Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PaymentsTab({ driver, canWrite, onChange }: { driver: DriverDetail; canWrite: boolean; onChange: () => void }) {
  const [date, setDate] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('ESPECES');
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const [exportFrom, setExportFrom] = useState('');
  const [exportTo, setExportTo] = useState('');
  const [weekFilter, setWeekFilter] = useState(''); // '' = toutes les semaines
  const isCV = driver.contractType === 'CONDITION_VENTE';
  const label = isCV ? 'Versement' : 'Loyer';

  // Mouvement de portefeuille intégré à la saisie du versement (CV uniquement).
  const [walletAction, setWalletAction] = useState<'' | 'DEPOT' | 'RETRAIT'>('');
  const [walletAmount, setWalletAmount] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editMode, setEditMode] = useState('ESPECES');
  const [editComment, setEditComment] = useState('');
  const [editError, setEditError] = useState('');

  function buildExportUrl(format: 'pdf' | 'excel') {
    const p = new URLSearchParams({ driverId: driver.id, format });
    if (exportFrom) p.set('from', exportFrom);
    if (exportTo) p.set('to', exportTo);
    return `/api/payments/export?${p.toString()}`;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setError('');
    const payload: Record<string, unknown> = { driverId: driver.id, date, amount: Number(amount), paymentMode, comment: comment || undefined };
    if (isCV && walletAction && walletAmount) {
      payload.walletMovement = { type: walletAction, amount: Number(walletAmount) };
    }
    const res = await fetch('/api/payments', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload) });
    if (!res.ok) { setError((await res.json()).error ?? 'Erreur.'); return; }
    setDate(''); setAmount(''); setComment(''); setWalletAction(''); setWalletAmount(''); onChange();
  }

  function startEdit(p: any) {
    setEditingId(p.id);
    setEditDate(new Date(p.date).toISOString().slice(0, 10));
    setEditAmount(String(p.amount));
    setEditMode(p.paymentMode);
    setEditComment(p.comment ?? '');
    setEditError('');
  }

  async function saveEdit(id: string) {
    setEditError('');
    const res = await fetch(`/api/payments/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: editDate, amount: Number(editAmount), paymentMode: editMode, comment: editComment || undefined }) });
    if (!res.ok) { setEditError((await res.json()).error ?? 'Erreur.'); return; }
    setEditingId(null); onChange();
  }

  async function deletePayment(id: string) {
    if (!confirm(`Supprimer ce ${label.toLowerCase()} ?`)) return;
    const res = await fetch(`/api/payments/${id}`, { method: 'DELETE' });
    if (!res.ok) { alert((await res.json()).error ?? 'Erreur.'); return; }
    onChange();
  }

  // Filtre semaine : le total du tableau se recalcule sur la semaine sélectionnée.
  const weekStart = weekFilter ? getWeekStart(new Date(weekFilter)) : null;
  const weekEnd = weekStart ? getWeekEnd(weekStart) : null;
  const visiblePayments = weekStart && weekEnd
    ? driver.payments.filter((p: any) => {
        const d = new Date(p.date);
        return d >= weekStart && d <= weekEnd;
      })
    : driver.payments;
  const visibleTotal = visiblePayments.reduce((s: number, p: any) => s + Number(p.amount), 0);

  return (
    <div className="space-y-4">
      {canWrite && (
        <form onSubmit={handleSubmit} className="card p-4 flex flex-wrap gap-3 items-end">
          <div>
            <label className="hud-label">Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className="form-input w-auto" />
          </div>
          <div>
            <label className="hud-label">Montant (FCFA)</label>
            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} required placeholder="Ex: 15000" className="form-input w-36" />
          </div>
          <div>
            <label className="hud-label">Mode de paiement</label>
            <select
              value={paymentMode}
              onChange={(e) => { setPaymentMode(e.target.value); setWalletAction(''); setWalletAmount(''); }}
              className="form-select w-44"
            >
              <option value="ESPECES">Espèces</option>
              <option value="MOBILE_MONEY">Mobile Money</option>
              <option value="VIREMENT">Virement</option>
              <option value="AUTRE">Autre</option>
              {isCV && <option value="PORTEFEUILLE">Portefeuille</option>}
            </select>
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="hud-label">Commentaire</label>
            <input value={comment} onChange={(e) => setComment(e.target.value)} className="form-input w-full" placeholder="Commentaire optionnel..." />
          </div>

          {paymentMode === 'PORTEFEUILLE' && (
            <p className="text-xs text-hud-cyan w-full">
              Le montant total du {label.toLowerCase()} sera déduit directement du solde du portefeuille.
            </p>
          )}

          {isCV && paymentMode !== 'PORTEFEUILLE' && (
            <>
              <div>
                <label className="hud-label">Portefeuille</label>
                <select
                  value={walletAction}
                  onChange={(e) => setWalletAction(e.target.value as '' | 'DEPOT' | 'RETRAIT')}
                  className="form-select w-52"
                >
                  <option value="">Aucun mouvement</option>
                  <option value="DEPOT">Garder le surplus (dépôt)</option>
                  <option value="RETRAIT">Couvrir avec le solde (retrait)</option>
                </select>
              </div>
              {walletAction && (
                <div>
                  <label className="hud-label">Montant portefeuille (FCFA)</label>
                  <input
                    type="number"
                    value={walletAmount}
                    onChange={(e) => setWalletAmount(e.target.value)}
                    required
                    placeholder="Ex: 5000"
                    className="form-input w-36"
                  />
                </div>
              )}
            </>
          )}

          <button type="submit" className="btn-primary">+ Ajouter {label.toLowerCase()}</button>
          {error && <p className="text-xs text-empire-rougeVif w-full">{error}</p>}
        </form>
      )}

      <div className="card p-3 flex flex-wrap gap-3 items-end">
        <div>
          <label className="hud-label">Du</label>
          <input type="date" value={exportFrom} onChange={(e) => setExportFrom(e.target.value)} className="hud-input w-auto" />
        </div>
        <div>
          <label className="hud-label">Au</label>
          <input type="date" value={exportTo} onChange={(e) => setExportTo(e.target.value)} className="hud-input w-auto" />
        </div>
        <a href={buildExportUrl('excel')} className="btn-secondary text-xs py-1.5">Excel</a>
        <a href={buildExportUrl('pdf')} className="btn-secondary text-xs py-1.5">PDF</a>
      </div>

      {/* Filtre par semaine — total de {label.toLowerCase()}s recalculé */}
      <div className="card p-3 flex flex-wrap gap-3 items-end">
        <div>
          <label className="hud-label">Filtrer par semaine</label>
          <input type="date" value={weekFilter} onChange={(e) => setWeekFilter(e.target.value)} className="hud-input w-auto" />
        </div>
        {weekFilter && weekStart && (
          <>
            <div className="text-xs text-gray-500 pb-2">
              Semaine du <span className="text-hud-cyan font-semibold">{formatWeekRange(weekStart)}</span>
            </div>
            <button onClick={() => setWeekFilter('')} className="btn-secondary text-xs py-1.5 px-3">
              Toutes les semaines
            </button>
          </>
        )}
        <div className="ml-auto text-right">
          <div className="stat-label">Total {label.toLowerCase()}s {weekFilter ? '(semaine)' : '(tout)'}</div>
          <div className="font-display font-bold text-lg text-hud-green">{formatFCFA(visibleTotal)}</div>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="hud-table">
          <thead><tr><th>Date</th><th>Montant</th><th>Mode</th><th>Commentaire</th><th>Saisi par</th>{canWrite && <th>Action</th>}</tr></thead>
          <tbody>
            {visiblePayments.length === 0 ? (
              <tr><td colSpan={6} className="text-center text-gray-600 py-6 italic">
                {weekFilter ? 'Aucun versement pour cette semaine.' : 'Aucun versement enregistré.'}
              </td></tr>
            ) : visiblePayments.map((p: any) => (
              editingId === p.id ? (
                <tr key={p.id} className="bg-hud-cyan/5">
                  <td><input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} className="form-input w-auto" /></td>
                  <td><input type="number" value={editAmount} onChange={(e) => setEditAmount(e.target.value)} className="form-input w-28" /></td>
                  <td>
                    <select value={editMode} onChange={(e) => setEditMode(e.target.value)} className="form-select w-36">
                      <option value="ESPECES">Espèces</option>
                      <option value="MOBILE_MONEY">Mobile Money</option>
                      <option value="VIREMENT">Virement</option>
                      <option value="AUTRE">Autre</option>
                      {isCV && <option value="PORTEFEUILLE">Portefeuille</option>}
                    </select>
                  </td>
                  <td><input value={editComment} onChange={(e) => setEditComment(e.target.value)} className="form-input w-full" /></td>
                  <td className="text-gray-600 text-xs">{fmtEntered(p.enteredBy)}</td>
                  <td className="flex gap-1.5 flex-wrap">
                    <button onClick={() => saveEdit(p.id)} className="btn-primary text-xs py-1 px-2">Enregistrer</button>
                    <button onClick={() => setEditingId(null)} className="btn-secondary text-xs py-1 px-2">Annuler</button>
                    {editError && <p className="text-xs text-empire-rougeVif w-full">{editError}</p>}
                  </td>
                </tr>
              ) : (
                <tr key={p.id}>
                  <td className="whitespace-nowrap">
                    {new Date(p.date).toLocaleDateString('fr-FR')}
                    {p.isUnusualDay && <span className="badge-warn ml-2">Jour inhabituel</span>}
                  </td>
                  <td className="font-display text-hud-green font-bold">{formatFCFA(Number(p.amount))}</td>
                  <td className="text-gray-400 text-xs">{p.paymentMode}</td>
                  <td className="text-gray-400">{p.comment || '—'}</td>
                  <td className="text-gray-600 text-xs">{fmtEntered(p.enteredBy)}</td>
                  {canWrite && (
                    <td className="flex gap-1.5">
                      <button onClick={() => startEdit(p)} className="btn-secondary text-xs py-1 px-2">Modifier</button>
                      <button onClick={() => deletePayment(p.id)} className="btn-danger text-xs py-1 px-2">Supprimer</button>
                    </td>
                  )}
                </tr>
              )
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const CAUTION_TYPES = [
  { value: 'RECHARGE_VOLONTAIRE', label: 'Recharge volontaire' },
  { value: 'DEDUCTION_PANNE', label: 'Déduction panne' },
  { value: 'DEDUCTION_SANCTION', label: 'Déduction sanction' },
  { value: 'RETRAIT', label: 'Retrait' },
];

// En Condition-Vente, la caution est une avance : on n'expose que l'ajout d'avance et le retrait.
const CV_ADVANCE_TYPES = [
  { value: 'RECHARGE_VOLONTAIRE', label: 'Avance versée' },
  { value: 'RETRAIT', label: 'Retrait / remboursement' },
];

function CautionTab({ driver, canWrite, onChange, isCV }: { driver: DriverDetail; canWrite: boolean; onChange: () => void; isCV?: boolean }) {
  const types = isCV ? CV_ADVANCE_TYPES : CAUTION_TYPES;
  const [date, setDate] = useState('');
  const [type, setType] = useState(types[0].value);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setError('');
    const res = await fetch('/api/caution', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ driverId: driver.id, date, type, amount: Number(amount), reason: reason || undefined }) });
    if (!res.ok) { setError((await res.json()).error ?? 'Erreur.'); return; }
    setDate(''); setAmount(''); setReason(''); onChange();
  }

  return (
    <div className="space-y-4">
      {isCV && (
        <div className="card p-3 border-l-4 border-hud-green text-xs text-gray-700 font-semibold">
          En Condition-Vente, la caution est une <span className="text-hud-green">avance de remboursement</span> :
          elle s'ajoute au total versé et se déduit automatiquement du reste à verser pour l'acquisition du véhicule.
        </div>
      )}
      {canWrite && (
        <form onSubmit={handleSubmit} className="card p-4 flex flex-wrap gap-3 items-end">
          <div>
            <label className="hud-label">Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className="form-input w-auto" />
          </div>
          <div>
            <label className="hud-label">Type de mouvement</label>
            <select value={type} onChange={(e) => setType(e.target.value)} className="form-select w-44">
              {types.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="hud-label">Montant (FCFA)</label>
            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} required placeholder="Ex: 50000" className="form-input w-36" />
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="hud-label">Motif</label>
            <input value={reason} onChange={(e) => setReason(e.target.value)} className="form-input w-full" placeholder="Motif du mouvement..." />
          </div>
          <button type="submit" className="btn-primary">Enregistrer</button>
          {error && <p className="text-xs text-empire-rougeVif w-full">{error}</p>}
        </form>
      )}

      <div className="card overflow-x-auto">
        <table className="hud-table">
          <thead><tr><th>Date</th><th>Type</th><th>Montant</th><th>Solde résultant</th><th>Motif</th><th>Saisi par</th></tr></thead>
          <tbody>
            {driver.cautionMovements.length === 0 ? (
              <tr><td colSpan={6} className="text-center text-gray-600 py-6 italic">Aucun mouvement de caution.</td></tr>
            ) : driver.cautionMovements.map((m: any) => (
              <tr key={m.id}>
                <td>{new Date(m.date).toLocaleDateString('fr-FR')}</td>
                <td className="text-xs text-gray-400">{m.type}</td>
                <td className={clsx('font-display font-bold', Number(m.amount) < 0 ? 'text-empire-rougeVif' : 'text-hud-green')}>
                  {Number(m.amount) > 0 ? '+' : ''}{formatFCFA(Number(m.amount))}
                </td>
                <td className="text-hud-cyan font-mono text-xs">{formatFCFA(Number(m.resultBalance))}</td>
                <td className="text-gray-400">{m.reason || '—'}</td>
                <td className="text-gray-600 text-xs">{fmtEntered(m.enteredBy)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const WALLET_TYPES = [
  { value: 'DEPOT', label: 'Dépôt (surplus)' },
  { value: 'RETRAIT', label: 'Retrait' },
];

function WalletTab({ driver, canWrite, onChange }: { driver: DriverDetail; canWrite: boolean; onChange: () => void }) {
  const [date, setDate] = useState('');
  const [type, setType] = useState(WALLET_TYPES[0].value);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setError('');
    const res = await fetch('/api/wallet', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ driverId: driver.id, date, type, amount: Number(amount), reason: reason || undefined }) });
    if (!res.ok) { setError((await res.json()).error ?? 'Erreur.'); return; }
    setDate(''); setAmount(''); setReason(''); onChange();
  }

  return (
    <div className="space-y-4">
      <div className="card p-3 border-l-4 border-hud-cyan text-xs text-gray-700 font-semibold">
        Le portefeuille garde le <span className="text-hud-cyan">surplus ou l'avance</span> des versements du chauffeur.
        Il est indépendant de l'avance/caution du véhicule et peut être déduit manuellement lors d'un futur versement.
      </div>
      {canWrite && (
        <form onSubmit={handleSubmit} className="card p-4 flex flex-wrap gap-3 items-end">
          <div>
            <label className="hud-label">Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className="form-input w-auto" />
          </div>
          <div>
            <label className="hud-label">Type de mouvement</label>
            <select value={type} onChange={(e) => setType(e.target.value)} className="form-select w-44">
              {WALLET_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="hud-label">Montant (FCFA)</label>
            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} required placeholder="Ex: 5000" className="form-input w-36" />
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="hud-label">Motif</label>
            <input value={reason} onChange={(e) => setReason(e.target.value)} className="form-input w-full" placeholder="Motif du mouvement..." />
          </div>
          <button type="submit" className="btn-primary">Enregistrer</button>
          {error && <p className="text-xs text-empire-rougeVif w-full">{error}</p>}
        </form>
      )}

      <div className="card overflow-x-auto">
        <table className="hud-table">
          <thead><tr><th>Date</th><th>Type</th><th>Montant</th><th>Solde résultant</th><th>Motif</th><th>Saisi par</th></tr></thead>
          <tbody>
            {driver.walletMovements?.length ? driver.walletMovements.map((m: any) => (
              <tr key={m.id}>
                <td>{new Date(m.date).toLocaleDateString('fr-FR')}</td>
                <td className="text-xs text-gray-400">{m.type === 'DEPOT' ? 'Dépôt' : 'Retrait'}</td>
                <td className={clsx('font-display font-bold', Number(m.amount) < 0 ? 'text-empire-rougeVif' : 'text-hud-green')}>
                  {Number(m.amount) > 0 ? '+' : ''}{formatFCFA(Number(m.amount))}
                </td>
                <td className="text-hud-cyan font-mono text-xs">{formatFCFA(Number(m.resultBalance))}</td>
                <td className="text-gray-400">{m.reason || '—'}</td>
                <td className="text-gray-600 text-xs">{fmtEntered(m.enteredBy)}</td>
              </tr>
            )) : (
              <tr><td colSpan={6} className="text-center text-gray-600 py-6 italic">Aucun mouvement de portefeuille.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function WeeklyTab({ driver, canWrite, onChange }: { driver: DriverDetail; canWrite: boolean; onChange: () => void }) {
  const [weekStartDate, setWeekStartDate] = useState('');
  const [hoursWorked, setHoursWorked] = useState('');
  const [ridesCompleted, setRidesCompleted] = useState('');
  const [error, setError] = useState('');
  const [exportFrom, setExportFrom] = useState('');
  const [exportTo, setExportTo] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editHours, setEditHours] = useState('');
  const [editRides, setEditRides] = useState('');
  const [editError, setEditError] = useState('');

  function buildExportUrl(format: 'pdf' | 'excel') {
    const p = new URLSearchParams({ driverId: driver.id, format });
    if (exportFrom) p.set('from', exportFrom);
    if (exportTo) p.set('to', exportTo);
    return `/api/weekly/export?${p.toString()}`;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setError('');
    const res = await fetch('/api/weekly', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ driverId: driver.id, weekStartDate, hoursWorked: Number(hoursWorked), ridesCompleted: Number(ridesCompleted) }) });
    if (!res.ok) { setError((await res.json()).error ?? 'Erreur.'); return; }
    setWeekStartDate(''); setHoursWorked(''); setRidesCompleted(''); onChange();
  }

  async function applyPenalty(id: string) {
    if (!confirm('Appliquer cette pénalité ? Action définitive.')) return;
    const res = await fetch(`/api/weekly/${id}/apply-penalty`, { method: 'POST' });
    if (!res.ok) { alert((await res.json()).error ?? 'Erreur.'); return; }
    onChange();
  }

  async function saveEdit(id: string) {
    setEditError('');
    const res = await fetch(`/api/weekly/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hoursWorked: Number(editHours), ridesCompleted: Number(editRides) }) });
    if (!res.ok) { setEditError((await res.json()).error ?? 'Erreur.'); return; }
    setEditingId(null); onChange();
  }

  async function deleteTracking(id: string) {
    if (!confirm('Supprimer cette saisie ?')) return;
    const res = await fetch(`/api/weekly/${id}`, { method: 'DELETE' });
    if (!res.ok) { alert((await res.json()).error ?? 'Erreur.'); return; }
    onChange();
  }

  return (
    <div className="space-y-4">
      {canWrite && (
        <form onSubmit={handleSubmit} className="card p-4 flex flex-wrap gap-3 items-end">
          <div>
            <label className="hud-label">Semaine (lundi)</label>
            <input type="date" value={weekStartDate} onChange={(e) => setWeekStartDate(e.target.value)} required className="form-input w-auto" />
          </div>
          <div>
            <label className="hud-label">Heures réalisées</label>
            <input type="number" step="0.5" value={hoursWorked} onChange={(e) => setHoursWorked(e.target.value)} required placeholder="Ex: 48.5" className="form-input w-28" />
          </div>
          <div>
            <label className="hud-label">Courses réalisées</label>
            <input type="number" value={ridesCompleted} onChange={(e) => setRidesCompleted(e.target.value)} required placeholder="Ex: 82" className="form-input w-28" />
          </div>
          <button type="submit" className="btn-primary">Enregistrer la semaine</button>
          <span className="text-xs text-gray-500 w-full">
            Objectif : <span className="text-hud-cyan">{driver.weeklyHourTarget} h/sem</span> · Taux pénalité : <span className="text-empire-rougeVif">{formatFCFA(Number(driver.hourlyPenaltyRate))}/h</span>
          </span>
          {error && <p className="text-xs text-empire-rougeVif">{error}</p>}
        </form>
      )}

      <div className="card p-3 flex flex-wrap gap-3 items-end">
        <div>
          <label className="hud-label">Du (semaine)</label>
          <input type="date" value={exportFrom} onChange={(e) => setExportFrom(e.target.value)} className="hud-input w-auto" />
        </div>
        <div>
          <label className="hud-label">Au (semaine)</label>
          <input type="date" value={exportTo} onChange={(e) => setExportTo(e.target.value)} className="hud-input w-auto" />
        </div>
        <a href={buildExportUrl('excel')} className="btn-secondary text-xs py-1.5">Excel</a>
        <a href={buildExportUrl('pdf')} className="btn-secondary text-xs py-1.5">PDF</a>
      </div>

      {/* Table saisies */}
      <div className="card overflow-x-auto">
        <table className="hud-table">
          <thead><tr><th>Semaine</th><th>Heures</th><th>Courses</th><th>Versements semaine</th>{canWrite && <th>Modifier la saisie</th>}</tr></thead>
          <tbody>
            {driver.weeklyTrackings.length === 0 ? (
              <tr><td colSpan={5} className="text-center text-gray-600 py-6 italic">Aucune saisie.</td></tr>
            ) : driver.weeklyTrackings.map((w: any) => {
              const isEditing = editingId === w.id;

              // Calcul du total versé sur cette semaine précise
              const wStart = new Date(w.weekStartDate);
              const wEnd = new Date(wStart);
              wEnd.setDate(wEnd.getDate() + 7);
              const weekTotal = driver.payments
                .filter((p: any) => {
                  const d = new Date(p.date);
                  return d >= wStart && d < wEnd;
                })
                .reduce((sum: number, p: any) => sum + Number(p.amount), 0);

              return (
                <tr key={w.id}>
                  <td className="whitespace-nowrap font-mono text-xs">{formatWeekRange(w.weekStartDate)}</td>
                  <td>
                    {isEditing
                      ? <input type="number" step="0.5" value={editHours} onChange={(e) => setEditHours(e.target.value)} className="form-input w-24" />
                      : <span className={clsx('font-mono', Number(w.hoursWorked) >= w.hourTarget ? 'text-hud-green' : 'text-yellow-400')}>{Number(w.hoursWorked)}/{w.hourTarget}h</span>
                    }
                  </td>
                  <td>
                    {isEditing
                      ? <input type="number" value={editRides} onChange={(e) => setEditRides(e.target.value)} className="form-input w-24" />
                      : <span className="text-hud-cyan font-bold">{w.ridesCompleted}</span>
                    }
                  </td>
                  <td>
                    <span className={clsx('font-display font-bold text-sm', weekTotal > 0 ? 'text-hud-green' : 'text-gray-600')}>
                      {weekTotal > 0 ? formatFCFA(weekTotal) : '—'}
                    </span>
                  </td>
                  {canWrite && (
                    <td>
                      {w.penaltyApplied
                        ? <span className="text-xs text-gray-600">Verrouillé</span>
                        : isEditing
                          ? <div className="flex gap-2 items-center">
                              <button onClick={() => saveEdit(w.id)} className="btn-primary text-xs py-0.5 px-2">OK</button>
                              <button onClick={() => setEditingId(null)} className="btn-secondary text-xs py-0.5 px-2">Annuler</button>
                              {editError && <span className="text-xs text-empire-rougeVif">{editError}</span>}
                            </div>
                          : <div className="flex gap-2">
                              <button onClick={() => { setEditingId(w.id); setEditHours(String(Number(w.hoursWorked))); setEditRides(String(w.ridesCompleted)); setEditError(''); }} className="btn-secondary text-xs py-0.5 px-2">Modifier</button>
                              <button onClick={() => deleteTracking(w.id)} className="btn-danger text-xs py-0.5 px-2">Supprimer</button>
                            </div>
                      }
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Section Sanction */}
      <div className="card overflow-x-auto">
        <div className="px-4 pt-3 pb-1 flex items-center gap-2">
          <div className="w-1 h-4 rounded-full bg-empire-rougeVif shadow-neon-red" />
          <span className="font-display text-xs text-empire-rougeVif uppercase tracking-widest font-bold">Section Sanction</span>
        </div>
        <table className="hud-table">
          <thead><tr><th>Semaine</th><th>Pénalité calculée</th><th>Statut</th>{canWrite && <th>Action</th>}</tr></thead>
          <tbody>
            {driver.weeklyTrackings.map((w: any) => (
              <tr key={w.id}>
                <td className="whitespace-nowrap font-mono text-xs">{formatWeekRange(w.weekStartDate)}</td>
                <td className={clsx('font-display font-bold', Number(w.computedPenalty) > 0 ? 'text-empire-rougeVif' : 'text-gray-600')}>
                  {Number(w.computedPenalty) > 0 ? formatFCFA(Number(w.computedPenalty)) : '—'}
                </td>
                <td>
                  {w.penaltyApplied
                    ? <span className="badge-loc">Appliquée</span>
                    : Number(w.computedPenalty) > 0
                      ? <span className="text-xs px-2 py-0.5 rounded-full bg-orange-900/60 text-orange-300 border border-orange-700/50 animate-pulse">En attente</span>
                      : <span className="text-gray-600 text-xs">—</span>
                  }
                </td>
                {canWrite && (
                  <td>
                    {!w.penaltyApplied && Number(w.computedPenalty) > 0 && (
                      <button onClick={() => applyPenalty(w.id)} className="btn-danger text-xs py-0.5 px-3">Appliquer</button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CommentsTab({ driver, canWrite, onChange }: { driver: DriverDetail; canWrite: boolean; onChange: () => void }) {
  const [text, setText] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setError('');
    const res = await fetch('/api/comments', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ driverId: driver.id, text }) });
    if (!res.ok) { setError((await res.json()).error ?? 'Erreur.'); return; }
    setText(''); onChange();
  }

  return (
    <div className="space-y-3">
      {canWrite && (
        <form onSubmit={handleSubmit} className="card p-4 flex gap-3 items-end">
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Écrire un commentaire interne..." className="form-input flex-1" required />
          <button type="submit" className="btn-primary">Publier</button>
          {error && <p className="text-xs text-empire-rougeVif">{error}</p>}
        </form>
      )}
      <div className="space-y-2">
        {driver.comments.length === 0 ? (
          <div className="card p-4 text-center text-gray-600 italic text-sm">Aucun commentaire.</div>
        ) : driver.comments.map((c: any) => (
          <div key={c.id} className="card p-4 text-sm">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-hud-cyan text-xs font-semibold">{fmtEntered(c.author)}</span>
              <span className="text-gray-600 text-xs">·</span>
              <span className="text-gray-500 text-xs">{new Date(c.date).toLocaleString('fr-FR')}</span>
            </div>
            <div className="text-gray-300">{c.text}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
