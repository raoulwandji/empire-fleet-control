'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { useSession } from 'next-auth/react';
import { formatFCFA } from '@/lib/business';

type Driver = {
  id: string; code: string; fullName: string; phone: string;
  contractType: 'CONDITION_VENTE' | 'LOCATION';
  vehicleBrand: string; vehicleModel: string; vehiclePlate: string;
  ownerName: string; totalPriceFixed: string | null; cautionReference: string | null;
  assignments: { employee: { id: string; fullName: string } }[];
  paidToday: boolean;
};

export default function DriversPage() {
  const { data: session } = useSession();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [q, setQ] = useState('');
  const [contractType, setContractType] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(true);

  const buildQuery = useCallback(() => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (contractType) params.set('contractType', contractType);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    return params.toString();
  }, [q, contractType, from, to]);

  const fetchDrivers = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/drivers?${buildQuery()}`);
    setDrivers(await res.json());
    setLoading(false);
  }, [buildQuery]);

  useEffect(() => { fetchDrivers(); }, [fetchDrivers]);

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="p-6 max-w-7xl mx-auto space-y-6">

        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="font-display font-bold text-2xl text-transparent bg-clip-text bg-gradient-to-r from-hud-cyan to-white tracking-widest">
              CHAUFFEURS
            </h1>
            <p className="text-xs text-gray-500 tracking-widest uppercase">Base d'identification de la flotte</p>
          </div>
          {session?.user && (
            <Link href="/drivers/new" className="btn-primary">+ Nouveau chauffeur</Link>
          )}
        </div>

        <div className="h-px bg-gradient-to-r from-transparent via-hud-cyan/30 to-transparent" />

        <div className="card p-4 flex flex-wrap gap-3 items-end">
          <div>
            <label className="hud-label">Recherche</label>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nom, téléphone, plaque..." className="hud-input w-56" />
          </div>
          <div>
            <label className="hud-label">Contrat</label>
            <select value={contractType} onChange={(e) => setContractType(e.target.value)} className="hud-select w-36">
              <option value="">Tous</option>
              <option value="CONDITION_VENTE">Condition-Vente</option>
              <option value="LOCATION">Location</option>
            </select>
          </div>
          <div>
            <label className="hud-label">Du</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="hud-input w-36" />
          </div>
          <div>
            <label className="hud-label">Au</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="hud-input w-36" />
          </div>
          <button onClick={fetchDrivers} className="btn-primary">Filtrer</button>
          <div className="flex gap-2 ml-auto">
            <a href={`/api/drivers/export?${buildQuery()}&format=excel`} className="btn-secondary text-xs py-1.5">Excel</a>
            <a href={`/api/drivers/export?${buildQuery()}&format=pdf`} className="btn-secondary text-xs py-1.5">PDF</a>
          </div>
        </div>

        {/* ── EXPORTS ────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Cellule 1 — Profils chauffeurs */}
          <div className="card p-4 flex flex-col gap-3">
            <div>
              <h3 className="font-display font-bold text-sm text-hud-cyan tracking-widest uppercase">Profils Chauffeurs</h3>
              <p className="text-xs text-gray-500 mt-1">Fiche identité : chauffeur, propriétaire &amp; garant. Aucune donnée financière.</p>
            </div>
            <a href="/api/export/driver-profiles" className="btn-primary text-xs py-2 text-center">
              ⬇ Télécharger les profils (Excel)
            </a>
          </div>

          {/* Cellule 2 — Modèle versements hebdo */}
          <div className="card p-4 flex flex-col gap-3">
            <div>
              <h3 className="font-display font-bold text-sm text-hud-cyan tracking-widest uppercase">Feuille Versements</h3>
              <p className="text-xs text-gray-500 mt-1">Modèle Excel prérempli avec noms + dates de la semaine. Colonnes : Versement · Heures · Courses · Commentaire.</p>
            </div>
            <a href="/api/export/payment-template" className="btn-primary text-xs py-2 text-center">
              ⬇ Télécharger le modèle (Excel)
            </a>
          </div>

          {/* Cellule 3 — Modèle suivi hebdo */}
          <div className="card p-4 flex flex-col gap-3">
            <div>
              <h3 className="font-display font-bold text-sm text-hud-cyan tracking-widest uppercase">Feuille Suivi Hebdo</h3>
              <p className="text-xs text-gray-500 mt-1">Modèle Excel prérempli par semaine (4 semaines). Colonnes : Heures · Courses · Total Versement · Commentaire.</p>
            </div>
            <a href="/api/export/weekly-template" className="btn-primary text-xs py-2 text-center">
              ⬇ Télécharger le modèle (Excel)
            </a>
          </div>
        </div>

        <div className="h-px bg-gradient-to-r from-transparent via-hud-cyan/20 to-transparent" />

        {/* Légende */}
        <div className="flex items-center gap-4 text-xs text-gray-400">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-emerald-500" />
            <span>A versé la recette aujourd'hui</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <span>N'a pas encore versé aujourd'hui</span>
          </div>
        </div>

        <div className="card overflow-x-auto">
          <table className="hud-table">
            <thead>
              <tr>
                <th>Statut</th><th>Code</th><th>Nom</th><th>Téléphone</th><th>Contrat</th>
                <th>Véhicule</th><th>Plaque</th><th>Propriétaire</th>
                <th>Montant / Caution</th><th>Affecté à</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={10} className="text-center text-hud-cyan text-xs tracking-widest animate-pulse py-8">⟳ CHARGEMENT...</td></tr>
              ) : drivers.length === 0 ? (
                <tr><td colSpan={10} className="text-center text-gray-600 py-8 italic">Aucun chauffeur trouvé.</td></tr>
              ) : drivers.map((d) => (
                <tr key={d.id} className={d.paidToday ? 'bg-emerald-900/20 border-l-2 border-emerald-500' : 'bg-red-900/15 border-l-2 border-red-700'}>
                  <td>
                    {d.paidToday
                      ? <span className="flex items-center gap-1.5 text-emerald-400 text-xs font-semibold"><span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse inline-block" />Versé</span>
                      : <span className="flex items-center gap-1.5 text-red-400 text-xs font-semibold"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" />En attente</span>
                    }
                  </td>
                  <td>
                    <Link href={`/drivers/${d.id}`} className="neon-link font-mono font-bold">{d.code}</Link>
                  </td>
                  <td className="font-semibold text-white">{d.fullName}</td>
                  <td className="font-mono text-gray-400">{d.phone}</td>
                  <td>
                    {d.contractType === 'CONDITION_VENTE' ? <span className="badge-cv">C-Vente</span> : <span className="badge-loc">Location</span>}
                  </td>
                  <td>{d.vehicleBrand} {d.vehicleModel}</td>
                  <td className="font-mono text-hud-cyan">{d.vehiclePlate}</td>
                  <td>{d.ownerName}</td>
                  <td className="font-display text-xs text-hud-green">
                    {formatFCFA(Number(d.contractType === 'CONDITION_VENTE' ? d.totalPriceFixed ?? 0 : d.cautionReference ?? 0))}
                  </td>
                  <td className="text-xs text-gray-500">
                    {d.assignments.map((a) => a.employee.fullName).join(', ') || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
