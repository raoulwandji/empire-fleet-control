'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { useSession } from 'next-auth/react';

type Owner = { id: string; fullName: string; phone: string; location: string | null };

export default function OwnersPage() {
  const { data: session } = useSession();
  const isAdminOrManager = session?.user.role === 'ADMIN' || session?.user.role === 'MANAGER';

  const [owners, setOwners] = useState<Owner[]>([]);
  const [loading, setLoading] = useState(true);

  // Formulaire création
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ fullName: '', phone: '', location: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/owners')
      .then((r) => r.json())
      .then((data) => { setOwners(Array.isArray(data) ? data : []); setLoading(false); });
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    const res = await fetch('/api/owners', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    if (!res.ok) {
      const d = await res.json();
      setError(d.error ?? 'Erreur');
      setSaving(false);
      return;
    }
    const newOwner = await res.json();
    setOwners((prev) => [...prev, newOwner].sort((a, b) => a.fullName.localeCompare(b.fullName)));
    setForm({ fullName: '', phone: '', location: '' });
    setShowForm(false);
    setSaving(false);
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        {/* En-tête */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display font-bold text-2xl text-transparent bg-clip-text bg-gradient-to-r from-hud-cyan to-empire-rouge tracking-widest">
              PROPRIÉTAIRES
            </h1>
            <p className="text-xs text-gray-500 tracking-widest uppercase mt-1">
              Propriétaires de véhicules — {owners.length} enregistré{owners.length > 1 ? 's' : ''}
            </p>
          </div>
          {isAdminOrManager && (
            <button onClick={() => setShowForm((v) => !v)} className="btn-primary">
              {showForm ? 'Annuler' : '+ Nouveau propriétaire'}
            </button>
          )}
        </div>

        {/* Formulaire création */}
        {showForm && (
          <div className="card p-5">
            <h2 className="hud-title mb-4">Nouveau propriétaire</h2>
            <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="hud-label">Nom complet *</label>
                <input className="hud-input" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required />
              </div>
              <div>
                <label className="hud-label">Téléphone *</label>
                <input className="hud-input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
              </div>
              <div>
                <label className="hud-label">Localisation</label>
                <input className="hud-input" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
              </div>
              {error && <p className="col-span-3 text-empire-rougeVif text-sm">{error}</p>}
              <div className="col-span-3 flex justify-end">
                <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Enregistrement...' : 'Enregistrer'}</button>
              </div>
            </form>
          </div>
        )}

        {/* Liste */}
        {loading ? (
          <p className="text-gray-500 text-sm">Chargement...</p>
        ) : owners.length === 0 ? (
          <div className="card p-8 text-center text-gray-500">Aucun propriétaire enregistré.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {owners.map((owner) => (
              <Link key={owner.id} href={`/owners/${owner.id}`} className="card-hover p-5 block">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-hud-cyan/10 border border-hud-cyan/30 flex items-center justify-center shrink-0">
                    <span className="text-hud-cyan font-bold text-sm">{owner.fullName.charAt(0).toUpperCase()}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-100 truncate">{owner.fullName}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{owner.phone}</p>
                    {owner.location && <p className="text-xs text-gray-600 truncate">{owner.location}</p>}
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-hud-line text-xs text-hud-cyan font-medium">
                  Voir détails →
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
