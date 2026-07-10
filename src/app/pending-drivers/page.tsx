'use client';

import { useEffect, useState, useCallback } from 'react';
import Navbar from '@/components/Navbar';
import { formatFCFA } from '@/lib/business';
import clsx from 'clsx';

type PendingDriver = {
  id: string;
  fullName: string;
  phone: string;
  location: string | null;
  licenseNumber: string | null;
  contractType: 'CONDITION_VENTE' | 'LOCATION';
  cautionPaid: string;
  comment: string | null;
  enteredBy: { fullName: string; username?: string };
  createdAt: string;
};

type PendingOwner = {
  id: string;
  fullName: string;
  phone: string;
  location: string | null;
  comment: string | null;
  enteredBy: { fullName: string; username?: string };
  createdAt: string;
};

const EMPTY_FORM = {
  fullName: '',
  phone: '',
  location: '',
  licenseNumber: '',
  contractType: 'CONDITION_VENTE' as 'CONDITION_VENTE' | 'LOCATION',
  cautionPaid: '',
  comment: '',
};

const EMPTY_OWNER_FORM = {
  fullName: '',
  phone: '',
  location: '',
  comment: '',
};

const TABS = ['Chauffeur en attente', 'Propriétaires en attente'] as const;

// Affiche l'identifiant (@username) de l'utilisateur qui a saisi la donnée, en plus de son nom.
function fmtEntered(u?: { fullName: string; username?: string } | null) {
  if (!u) return '—';
  return u.username ? `${u.fullName} (@${u.username})` : u.fullName;
}

export default function PendingDriversPage() {
  const [tab, setTab] = useState<typeof TABS[number]>('Chauffeur en attente');

  return (
    <div>
      <Navbar />
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="font-display font-bold text-2xl text-transparent bg-clip-text bg-gradient-to-r from-hud-cyan to-empire-rouge tracking-widest">
            EN ATTENTE
          </h1>
          <p className="text-xs text-gray-500 tracking-widest uppercase">
            Chauffeurs et propriétaires en attente — avec fil de commentaires
          </p>
        </div>

        <div className="flex gap-1 border-b border-hud-line overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={clsx(
                'px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-all duration-150',
                tab === t ? 'border-hud-cyan text-hud-cyan' : 'border-transparent text-gray-500 hover:text-gray-300'
              )}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === 'Chauffeur en attente' && <ProspectsSection />}
        {tab === 'Propriétaires en attente' && <PendingOwnersSection />}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Fil de commentaires réutilisable
───────────────────────────────────────────────────────────── */
function CommentThread({ getUrl, onPost }: { getUrl: string; onPost: (text: string) => Promise<Response> }) {
  const [comments, setComments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(getUrl);
      const d = await res.json();
      setComments(Array.isArray(d) ? d : []);
    } catch {
      setComments([]);
    }
    setLoading(false);
  }, [getUrl]);

  useEffect(() => { load(); }, [load]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setSaving(true);
    setError('');
    const res = await onPost(text.trim());
    setSaving(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? 'Erreur.');
      return;
    }
    setText('');
    load();
  }

  return (
    <div className="bg-hud-panel2 rounded-lg p-3 space-y-2 mt-2 border border-hud-line">
      <form onSubmit={submit} className="flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ajouter un commentaire..."
          className="form-input flex-1 text-sm"
        />
        <button disabled={saving} className="btn-primary text-xs px-3 shrink-0">
          {saving ? '...' : 'Envoyer'}
        </button>
      </form>
      {error && <p className="text-xs text-empire-rougeVif">{error}</p>}
      {loading ? (
        <p className="text-xs text-gray-500 tracking-widest">⟳ Chargement...</p>
      ) : comments.length === 0 ? (
        <p className="text-xs text-gray-500 italic">Aucun commentaire.</p>
      ) : (
        <ul className="space-y-1.5 max-h-56 overflow-y-auto">
          {comments.map((c) => (
            <li key={c.id} className="text-xs border-b border-hud-line pb-1.5 last:border-0">
              <span className="text-hud-cyan font-semibold">{fmtEntered(c.author)}</span>
              <span className="text-gray-600 ml-2">
                {new Date(c.createdAt ?? c.date).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </span>
              <p className="text-gray-700 font-medium mt-0.5">{c.text}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ExpandableRow({ label, children, comments }: { label: React.ReactNode; children?: React.ReactNode; comments: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-t border-hud-line first:border-t-0 py-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex-1 min-w-[200px]">{label}</div>
        <div className="flex items-center gap-2 shrink-0">
          {children}
          <button onClick={() => setOpen((v) => !v)} className="btn-secondary text-xs py-1 px-2">
            {open ? 'Masquer commentaires' : 'Commentaires'}
          </button>
        </div>
      </div>
      {open && comments}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Section 1 : Prospects en attente (gestion complète existante)
───────────────────────────────────────────────────────────── */
function ProspectsSection() {
  const [items, setItems] = useState<PendingDriver[]>([]);
  const [loading, setLoading] = useState(true);
  const [contractFilter, setContractFilter] = useState('');
  const [q, setQ] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (contractFilter) params.set('contractType', contractFilter);
    if (q) params.set('q', q);
    const res = await fetch(`/api/pending-drivers?${params.toString()}`);
    const d = await res.json();
    setItems(Array.isArray(d) ? d : []);
    setLoading(false);
  }, [contractFilter, q]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function openCreateForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError('');
    setShowForm(true);
  }

  function openEditForm(item: PendingDriver) {
    setEditingId(item.id);
    setForm({
      fullName: item.fullName,
      phone: item.phone,
      location: item.location ?? '',
      licenseNumber: item.licenseNumber ?? '',
      contractType: item.contractType,
      cautionPaid: String(Number(item.cautionPaid)),
      comment: item.comment ?? '',
    });
    setError('');
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);

    const payload = {
      fullName: form.fullName,
      phone: form.phone,
      location: form.location || undefined,
      licenseNumber: form.licenseNumber || undefined,
      contractType: form.contractType,
      cautionPaid: Number(form.cautionPaid || 0),
      comment: form.comment || undefined,
    };

    const res = await fetch(editingId ? `/api/pending-drivers/${editingId}` : '/api/pending-drivers', {
      method: editingId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    setSaving(false);

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? 'Erreur.');
      return;
    }

    setShowForm(false);
    fetchData();
  }

  async function handleDelete(id: string) {
    if (!confirm('Supprimer ce chauffeur en attente de véhicule ?')) return;
    const res = await fetch(`/api/pending-drivers/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json();
      alert(data.error ?? 'Erreur.');
      return;
    }
    fetchData();
  }

  const conditionVenteItems = items.filter((i) => i.contractType === 'CONDITION_VENTE');
  const locationItems = items.filter((i) => i.contractType === 'LOCATION');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm text-gray-600">
          Prospects ayant déjà versé une caution/avance, sans véhicule encore affecté.
        </p>
        <button onClick={openCreateForm} className="btn-primary text-sm">
          + Ajouter un prospect
        </button>
      </div>

      <div className="card p-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="hud-label">Recherche</label>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nom, téléphone..." className="form-input w-56" />
        </div>
        <div>
          <label className="hud-label">Type de contrat</label>
          <select value={contractFilter} onChange={(e) => setContractFilter(e.target.value)} className="form-select w-44">
            <option value="">Tous</option>
            <option value="CONDITION_VENTE">Condition-Vente</option>
            <option value="LOCATION">Location</option>
          </select>
        </div>
        <button onClick={fetchData} className="btn-secondary text-sm">Filtrer</button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="card p-4 grid grid-cols-2 gap-3">
          <h2 className="col-span-2 hud-title">
            {editingId ? 'Modifier' : 'Ajouter'} un prospect en attente de véhicule
          </h2>
          <div>
            <label className="hud-label">Nom complet</label>
            <input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required className="form-input w-full" />
          </div>
          <div>
            <label className="hud-label">Téléphone</label>
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required className="form-input w-full" />
          </div>
          <div>
            <label className="hud-label">Localisation</label>
            <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className="form-input w-full" />
          </div>
          <div>
            <label className="hud-label">N° de permis</label>
            <input value={form.licenseNumber} onChange={(e) => setForm({ ...form, licenseNumber: e.target.value })} className="form-input w-full" />
          </div>
          <div>
            <label className="hud-label">Type de contrat souhaité</label>
            <select
              value={form.contractType}
              onChange={(e) => setForm({ ...form, contractType: e.target.value as 'CONDITION_VENTE' | 'LOCATION' })}
              className="form-select w-full"
            >
              <option value="CONDITION_VENTE">Condition-Vente</option>
              <option value="LOCATION">Location</option>
            </select>
          </div>
          <div>
            <label className="hud-label">Caution déjà versée (FCFA)</label>
            <input
              type="number"
              value={form.cautionPaid}
              onChange={(e) => setForm({ ...form, cautionPaid: e.target.value })}
              required
              className="form-input w-full"
            />
          </div>
          <div className="col-span-2">
            <label className="hud-label">Commentaire (note rapide)</label>
            <input value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} className="form-input w-full" />
          </div>

          {error && <p className="col-span-2 text-sm text-empire-rougeVif">{error}</p>}

          <div className="col-span-2 flex gap-2">
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Enregistrement...' : editingId ? 'Enregistrer' : 'Ajouter'}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">
              Annuler
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-gray-500 text-sm tracking-widest">⟳ Chargement...</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ProspectTable title="Condition-Vente" badgeClass="badge-cv" items={conditionVenteItems} onEdit={openEditForm} onDelete={handleDelete} />
          <ProspectTable title="Location" badgeClass="badge-loc" items={locationItems} onEdit={openEditForm} onDelete={handleDelete} />
        </div>
      )}
    </div>
  );
}

function ProspectTable({
  title,
  badgeClass,
  items,
  onEdit,
  onDelete,
}: {
  title: string;
  badgeClass: string;
  items: PendingDriver[];
  onEdit: (item: PendingDriver) => void;
  onDelete: (id: string) => void;
}) {
  const total = items.reduce((sum, i) => sum + Number(i.cautionPaid), 0);

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="hud-title flex items-center gap-2">
          <span className={badgeClass}>{title}</span>
          <span className="text-gray-500 text-xs font-normal normal-case tracking-normal">({items.length})</span>
        </h2>
        <span className="text-xs text-gray-600">Total caution : {formatFCFA(total)}</span>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-gray-500 italic">Aucun prospect pour ce type de contrat.</p>
      ) : (
        <div>
          {items.map((item) => (
            <ExpandableRow
              key={item.id}
              label={
                <div>
                  <span className="font-semibold text-gray-800">{item.fullName}</span>
                  <span className="text-xs text-gray-500 ml-2">{item.phone}</span>
                  {item.comment && <div className="text-xs text-gray-500 italic">{item.comment}</div>}
                  <div className="text-xs text-gray-600 mt-0.5">
                    {formatFCFA(Number(item.cautionPaid))} · saisi par {fmtEntered(item.enteredBy)}
                  </div>
                </div>
              }
              comments={
                <CommentThread
                  getUrl={`/api/pending-drivers/${item.id}/comments`}
                  onPost={(text) =>
                    fetch(`/api/pending-drivers/${item.id}/comments`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ text }),
                    })
                  }
                />
              }
            >
              <button onClick={() => onEdit(item)} className="btn-secondary text-xs py-1 px-2">Modifier</button>
              <button onClick={() => onDelete(item.id)} className="btn-danger text-xs py-1 px-2">Supprimer</button>
            </ExpandableRow>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Section 1bis : Propriétaires en attente (prospects, pas encore
   intégrés à la table Owner) — CRUD + fil de commentaires
───────────────────────────────────────────────────────────── */
function PendingOwnersSection() {
  const [items, setItems] = useState<PendingOwner[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_OWNER_FORM);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    const res = await fetch(`/api/pending-owners?${params.toString()}`);
    const d = await res.json();
    setItems(Array.isArray(d) ? d : []);
    setLoading(false);
  }, [q]);

  useEffect(() => { fetchData(); }, [fetchData]);

  function openCreateForm() {
    setEditingId(null);
    setForm(EMPTY_OWNER_FORM);
    setError('');
    setShowForm(true);
  }

  function openEditForm(item: PendingOwner) {
    setEditingId(item.id);
    setForm({
      fullName: item.fullName,
      phone: item.phone,
      location: item.location ?? '',
      comment: item.comment ?? '',
    });
    setError('');
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);

    const payload = {
      fullName: form.fullName,
      phone: form.phone,
      location: form.location || undefined,
      comment: form.comment || undefined,
    };

    const res = await fetch(editingId ? `/api/pending-owners/${editingId}` : '/api/pending-owners', {
      method: editingId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    setSaving(false);

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? 'Erreur.');
      return;
    }

    setShowForm(false);
    fetchData();
  }

  async function handleDelete(id: string) {
    if (!confirm('Supprimer ce propriétaire en attente ?')) return;
    const res = await fetch(`/api/pending-owners/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json();
      alert(data.error ?? 'Erreur.');
      return;
    }
    fetchData();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm text-gray-600">
          Propriétaires prospects, en cours d'onboarding — pas encore intégrés à la liste officielle.
        </p>
        <button onClick={openCreateForm} className="btn-primary text-sm">
          + Ajouter un propriétaire en attente
        </button>
      </div>

      <div className="card p-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="hud-label">Recherche</label>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nom, téléphone..." className="form-input w-56" />
        </div>
        <button onClick={fetchData} className="btn-secondary text-sm">Filtrer</button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="card p-4 grid grid-cols-2 gap-3">
          <h2 className="col-span-2 hud-title">
            {editingId ? 'Modifier' : 'Ajouter'} un propriétaire en attente
          </h2>
          <div>
            <label className="hud-label">Nom complet</label>
            <input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required className="form-input w-full" />
          </div>
          <div>
            <label className="hud-label">Téléphone</label>
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required className="form-input w-full" />
          </div>
          <div className="col-span-2">
            <label className="hud-label">Localisation</label>
            <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className="form-input w-full" />
          </div>
          <div className="col-span-2">
            <label className="hud-label">Commentaire (note rapide)</label>
            <input value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} className="form-input w-full" />
          </div>

          {error && <p className="col-span-2 text-sm text-empire-rougeVif">{error}</p>}

          <div className="col-span-2 flex gap-2">
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Enregistrement...' : editingId ? 'Enregistrer' : 'Ajouter'}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">
              Annuler
            </button>
          </div>
        </form>
      )}

      <div className="card p-4">
        {loading ? (
          <p className="text-gray-500 text-sm tracking-widest">⟳ Chargement...</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-gray-500 italic">Aucun propriétaire en attente.</p>
        ) : (
          <div>
            {items.map((item) => (
              <ExpandableRow
                key={item.id}
                label={
                  <div>
                    <span className="font-semibold text-gray-800">{item.fullName}</span>
                    <span className="text-xs text-gray-500 ml-2">{item.phone}</span>
                    {item.location && <span className="text-xs text-gray-500 ml-2">— {item.location}</span>}
                    {item.comment && <div className="text-xs text-gray-500 italic">{item.comment}</div>}
                    <div className="text-xs text-gray-600 mt-0.5">saisi par {fmtEntered(item.enteredBy)}</div>
                  </div>
                }
                comments={
                  <CommentThread
                    getUrl={`/api/pending-owners/${item.id}/comments`}
                    onPost={(text) =>
                      fetch(`/api/pending-owners/${item.id}/comments`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ text }),
                      })
                    }
                  />
                }
              >
                <button onClick={() => openEditForm(item)} className="btn-secondary text-xs py-1 px-2">Modifier</button>
                <button onClick={() => handleDelete(item.id)} className="btn-danger text-xs py-1 px-2">Supprimer</button>
              </ExpandableRow>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

