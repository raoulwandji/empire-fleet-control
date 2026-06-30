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
  enteredBy: { fullName: string };
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

export default function PendingDriversPage() {
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
    setItems(await res.json());
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
    <div>
      <Navbar />
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-xl font-bold">Chauffeurs en attente de véhicule</h1>
            <p className="text-sm text-gray-500">
              Chauffeurs ayant déjà versé une caution/avance, sans véhicule encore affecté.
            </p>
          </div>
          <button
            onClick={openCreateForm}
            className="bg-empire-rouge text-white px-4 py-2 rounded text-sm hover:bg-empire-rougeVif"
          >
            + Ajouter un chauffeur en attente
          </button>
        </div>

        <div className="bg-white rounded shadow p-4 flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-gray-500">Recherche</label>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nom, téléphone..." className="border rounded px-2 py-1 text-sm w-56" />
          </div>
          <div>
            <label className="block text-xs text-gray-500">Type de contrat</label>
            <select value={contractFilter} onChange={(e) => setContractFilter(e.target.value)} className="border rounded px-2 py-1 text-sm">
              <option value="">Tous</option>
              <option value="CONDITION_VENTE">Condition-Vente</option>
              <option value="LOCATION">Location</option>
            </select>
          </div>
          <button onClick={fetchData} className="bg-empire-noir text-white px-3 py-1.5 rounded text-sm">
            Filtrer
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="bg-white rounded shadow p-4 grid grid-cols-2 gap-3">
            <h2 className="col-span-2 font-semibold text-sm">
              {editingId ? 'Modifier' : 'Ajouter'} un chauffeur en attente de véhicule
            </h2>
            <div>
              <label className="block text-xs text-gray-500 mb-0.5">Nom complet</label>
              <input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required className="border rounded px-2 py-1.5 text-sm w-full" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-0.5">Téléphone</label>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required className="border rounded px-2 py-1.5 text-sm w-full" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-0.5">Localisation</label>
              <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className="border rounded px-2 py-1.5 text-sm w-full" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-0.5">N° de permis</label>
              <input value={form.licenseNumber} onChange={(e) => setForm({ ...form, licenseNumber: e.target.value })} className="border rounded px-2 py-1.5 text-sm w-full" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-0.5">Type de contrat souhaité</label>
              <select
                value={form.contractType}
                onChange={(e) => setForm({ ...form, contractType: e.target.value as 'CONDITION_VENTE' | 'LOCATION' })}
                className="border rounded px-2 py-1.5 text-sm w-full"
              >
                <option value="CONDITION_VENTE">Condition-Vente</option>
                <option value="LOCATION">Location</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-0.5">Caution déjà versée (FCFA)</label>
              <input
                type="number"
                value={form.cautionPaid}
                onChange={(e) => setForm({ ...form, cautionPaid: e.target.value })}
                required
                className="border rounded px-2 py-1.5 text-sm w-full"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-gray-500 mb-0.5">Commentaire</label>
              <input value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} className="border rounded px-2 py-1.5 text-sm w-full" />
            </div>

            {error && <p className="col-span-2 text-sm text-red-600">{error}</p>}

            <div className="col-span-2 flex gap-2">
              <button type="submit" disabled={saving} className="bg-empire-rouge text-white px-4 py-1.5 rounded text-sm disabled:opacity-50">
                {saving ? 'Enregistrement...' : editingId ? 'Enregistrer' : 'Ajouter'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="border px-4 py-1.5 rounded text-sm hover:bg-gray-50">
                Annuler
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <p className="text-gray-400">Chargement...</p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <PendingTable
              title="Condition-Vente"
              color="blue"
              items={conditionVenteItems}
              onEdit={openEditForm}
              onDelete={handleDelete}
            />
            <PendingTable
              title="Location"
              color="green"
              items={locationItems}
              onEdit={openEditForm}
              onDelete={handleDelete}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function PendingTable({
  title,
  color,
  items,
  onEdit,
  onDelete,
}: {
  title: string;
  color: 'blue' | 'green';
  items: PendingDriver[];
  onEdit: (item: PendingDriver) => void;
  onDelete: (id: string) => void;
}) {
  const total = items.reduce((sum, i) => sum + Number(i.cautionPaid), 0);

  return (
    <div className="bg-white rounded shadow p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className={clsx('font-semibold', color === 'blue' ? 'text-blue-700' : 'text-green-700')}>
          {title} <span className="text-gray-400 text-sm font-normal">({items.length})</span>
        </h2>
        <span className="text-sm text-gray-500">Total caution : {formatFCFA(total)}</span>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-gray-400">Aucun chauffeur en attente pour ce type de contrat.</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-gray-100 text-left">
            <tr>
              <th className="p-2">Nom</th>
              <th className="p-2">Téléphone</th>
              <th className="p-2">Caution versée</th>
              <th className="p-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t">
                <td className="p-2">
                  {item.fullName}
                  {item.comment && <div className="text-xs text-gray-400">{item.comment}</div>}
                </td>
                <td className="p-2">{item.phone}</td>
                <td className="p-2 font-medium">{formatFCFA(Number(item.cautionPaid))}</td>
                <td className="p-2">
                  <div className="flex gap-2">
                    <button onClick={() => onEdit(item)} className="text-xs border rounded px-2 py-0.5 hover:bg-gray-50">
                      Modifier
                    </button>
                    <button onClick={() => onDelete(item.id)} className="text-xs border border-red-300 text-red-600 rounded px-2 py-0.5 hover:bg-red-50">
                      Supprimer
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
