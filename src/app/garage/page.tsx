'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import Navbar from '@/components/Navbar';
import clsx from 'clsx';

type DriverLite = { id: string; code: string; fullName: string; vehiclePlate: string; contractType: string };

type GarageEntry = {
  id: string;
  driver: DriverLite;
  reasonType: 'PANNE' | 'REPARATION' | 'ENTRETIEN' | 'ACCIDENT' | 'AUTRE';
  reason: string;
  enteredAt: string;
  resolvedAt: string | null;
  note: string | null;
  enteredBy: { fullName: string; username?: string };
};

const REASON_LABELS: Record<string, string> = {
  PANNE: 'Panne', REPARATION: 'Réparation', ENTRETIEN: 'Entretien', ACCIDENT: 'Accident', AUTRE: 'Autre',
};

const EMPTY_FORM = {
  driverId: '',
  reasonType: 'PANNE' as GarageEntry['reasonType'],
  reason: '',
  enteredAt: new Date().toISOString().slice(0, 10),
  note: '',
};

function fmtEntered(u?: { fullName: string; username?: string } | null) {
  if (!u) return '—';
  return u.username ? `${u.fullName} (@${u.username})` : u.fullName;
}

export default function GaragePage() {
  const { data: session } = useSession();
  const canWrite = session?.user.role === 'ADMIN' || session?.user.role === 'MANAGER';

  const [entries, setEntries] = useState<GarageEntry[]>([]);
  const [drivers, setDrivers] = useState<DriverLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<'active' | 'resolved' | 'all'>('active');
  const [q, setQ] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ status });
    if (q) params.set('q', q);
    if (dateFrom) params.set('from', dateFrom);
    if (dateTo) params.set('to', dateTo);
    const res = await fetch(`/api/garage?${params.toString()}`);
    const d = await res.json();
    setEntries(Array.isArray(d) ? d : []);
    setLoading(false);
  }, [status, q, dateFrom, dateTo]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  useEffect(() => {
    fetch('/api/drivers').then((r) => r.json()).then((d) => setDrivers(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  function openCreateForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError('');
    setShowForm(true);
  }

  function openEditForm(entry: GarageEntry) {
    setEditingId(entry.id);
    setForm({
      driverId: entry.driver.id,
      reasonType: entry.reasonType,
      reason: entry.reason,
      enteredAt: entry.enteredAt.slice(0, 10),
      note: entry.note ?? '',
    });
    setError('');
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setSaving(true);

    const payload = editingId
      ? { reasonType: form.reasonType, reason: form.reason, enteredAt: form.enteredAt, note: form.note || undefined }
      : { driverId: form.driverId, reasonType: form.reasonType, reason: form.reason, enteredAt: form.enteredAt, note: form.note || undefined };

    const res = await fetch(editingId ? `/api/garage/${editingId}` : '/api/garage', {
      method: editingId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (!res.ok) { const d = await res.json().catch(() => ({})); setError(d.error ?? 'Erreur.'); return; }
    setShowForm(false);
    fetchEntries();
  }

  async function handleResolve(id: string) {
    if (!confirm('Remettre ce véhicule en service ?')) return;
    const res = await fetch(`/api/garage/${id}/resolve`, { method: 'POST' });
    if (!res.ok) { const d = await res.json().catch(() => ({})); alert(d.error ?? 'Erreur.'); return; }
    fetchEntries();
  }

  async function handleDelete(id: string) {
    if (!confirm('Supprimer cette entrée de garage ?')) return;
    const res = await fetch(`/api/garage/${id}`, { method: 'DELETE' });
    if (!res.ok) { const d = await res.json().catch(() => ({})); alert(d.error ?? 'Erreur.'); return; }
    fetchEntries();
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="font-display font-bold text-2xl text-transparent bg-clip-text bg-gradient-to-r from-hud-cyan to-empire-rouge tracking-widest">
              GARAGE
            </h1>
            <p className="text-xs text-gray-500 tracking-widest uppercase font-bold">Véhicules immobilisés — panne, réparation, entretien</p>
          </div>
          {canWrite && (
            <button onClick={openCreateForm} className="btn-primary text-sm">+ Immobiliser un véhicule</button>
          )}
        </div>
        <div className="h-px bg-gradient-to-r from-transparent via-hud-cyan/30 to-transparent" />

        {/* Filtres */}
        <div className="card p-4 flex flex-wrap gap-3 items-end">
          <div>
            <label className="hud-label">Recherche</label>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nom, plaque, code..." className="form-input w-56" />
          </div>
          <div>
            <label className="hud-label">Statut</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className="form-select w-44">
              <option value="active">Actuellement au garage</option>
              <option value="resolved">Remis en service</option>
              <option value="all">Tous</option>
            </select>
          </div>
          <div>
            <label className="hud-label">Du</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="form-input w-auto" />
          </div>
          <div>
            <label className="hud-label">Au</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="form-input w-auto" />
          </div>
          <button onClick={fetchEntries} className="btn-secondary text-sm">Filtrer</button>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="card p-4 grid grid-cols-2 gap-3">
            <h2 className="col-span-2 hud-title">
              {editingId ? 'Modifier l\'immobilisation' : 'Immobiliser un véhicule'}
            </h2>
            {!editingId && (
              <div className="col-span-2">
                <label className="hud-label">Véhicule / Chauffeur</label>
                <select value={form.driverId} onChange={(e) => setForm({ ...form, driverId: e.target.value })} required className="form-select w-full">
                  <option value="">— Sélectionner —</option>
                  {drivers.map((d) => (
                    <option key={d.id} value={d.id}>{d.vehiclePlate} — {d.fullName} ({d.code})</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="hud-label">Type de motif</label>
              <select value={form.reasonType} onChange={(e) => setForm({ ...form, reasonType: e.target.value as GarageEntry['reasonType'] })} className="form-select w-full">
                {Object.entries(REASON_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="hud-label">Date de mise hors service</label>
              <input type="date" value={form.enteredAt} onChange={(e) => setForm({ ...form, enteredAt: e.target.value })} required className="form-input w-full" />
            </div>
            <div className="col-span-2">
              <label className="hud-label">Motif détaillé</label>
              <input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} required className="form-input w-full" placeholder="Ex: moteur, boîte de vitesse, pare-brise..." />
            </div>
            <div className="col-span-2">
              <label className="hud-label">Note (optionnel)</label>
              <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className="form-input w-full" />
            </div>
            {error && <p className="col-span-2 text-sm text-empire-rouge font-bold">{error}</p>}
            <div className="col-span-2 flex gap-2">
              <button type="submit" disabled={saving} className="btn-primary">
                {saving ? 'Enregistrement...' : editingId ? 'Enregistrer' : 'Immobiliser'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Annuler</button>
            </div>
          </form>
        )}

        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="hud-table">
              <thead>
                <tr>
                  <th>Véhicule</th><th>Chauffeur</th><th>Motif</th><th>Immobilisé le</th>
                  <th>Statut</th><th>Saisi par</th>{canWrite && <th></th>}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="text-center italic text-gray-500 py-6">⟳ Chargement...</td></tr>
                ) : entries.length === 0 ? (
                  <tr><td colSpan={7} className="text-center italic text-gray-500 py-6">Aucune entrée.</td></tr>
                ) : entries.map((e) => (
                  <tr key={e.id}>
                    <td className="font-mono text-hud-cyan font-semibold">{e.driver.vehiclePlate}</td>
                    <td className="font-semibold text-gray-800">{e.driver.fullName} <span className="text-xs text-gray-500">({e.driver.code})</span></td>
                    <td>
                      <span className="badge-warn">{REASON_LABELS[e.reasonType]}</span>
                      <div className="text-xs text-gray-500 mt-0.5">{e.reason}</div>
                      {e.note && <div className="text-xs text-gray-400 italic">{e.note}</div>}
                    </td>
                    <td className="whitespace-nowrap">{new Date(e.enteredAt).toLocaleDateString('fr-FR')}</td>
                    <td>
                      <span className={clsx(
                        'text-xs px-2 py-0.5 rounded-full font-bold border',
                        e.resolvedAt ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-red-100 text-red-800 border-red-300'
                      )}>
                        {e.resolvedAt ? `Remis en service le ${new Date(e.resolvedAt).toLocaleDateString('fr-FR')}` : 'Au garage'}
                      </span>
                    </td>
                    <td className="text-xs text-gray-500">{fmtEntered(e.enteredBy)}</td>
                    {canWrite && (
                      <td className="flex gap-1.5 flex-wrap py-2">
                        {!e.resolvedAt && (
                          <button onClick={() => handleResolve(e.id)} className="btn-primary text-xs py-1 px-2">Remettre en service</button>
                        )}
                        <button onClick={() => openEditForm(e)} className="btn-secondary text-xs py-1 px-2">Modifier</button>
                        <button onClick={() => handleDelete(e.id)} className="btn-danger text-xs py-1 px-2">Supprimer</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
