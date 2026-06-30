'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';

type PendingDriver = {
  id: string;
  fullName: string;
  phone: string;
  location: string | null;
  licenseNumber: string | null;
  contractType: 'CONDITION_VENTE' | 'LOCATION';
  cautionPaid: string;
  comment: string | null;
};

export default function NewDriverPage() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [contractType, setContractType] = useState<'CONDITION_VENTE' | 'LOCATION'>('CONDITION_VENTE');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [pendingDrivers, setPendingDrivers] = useState<PendingDriver[]>([]);
  const [selectedPendingId, setSelectedPendingId] = useState('');

  // Champs contrôlés pour pouvoir les pré-remplir depuis la liste d'attente
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');

  useEffect(() => {
    fetch('/api/pending-drivers')
      .then((r) => r.json())
      .then(setPendingDrivers)
      .catch(() => {});
  }, []);

  function handleSelectPending(id: string) {
    setSelectedPendingId(id);
    if (!id) return;
    const p = pendingDrivers.find((d) => d.id === id);
    if (!p) return;
    setFullName(p.fullName);
    setPhone(p.phone);
    setLocation(p.location ?? '');
    setLicenseNumber(p.licenseNumber ?? '');
    setContractType(p.contractType);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setSaving(true);

    const form = new FormData(e.currentTarget);
    const payload: Record<string, unknown> = {
      fullName: form.get('fullName'),
      phone: form.get('phone'),
      location: form.get('location'),
      licenseNumber: form.get('licenseNumber'),
      contractType,
      ownerName: form.get('ownerName'),
      ownerPhone: form.get('ownerPhone'),
      ownerLocation: form.get('ownerLocation'),
      guarantorName: form.get('guarantorName'),
      guarantorPhone: form.get('guarantorPhone'),
      vehicleBrand: form.get('vehicleBrand'),
      vehicleModel: form.get('vehicleModel'),
      vehiclePlate: form.get('vehiclePlate'),
      vehicleColor: form.get('vehicleColor'),
      vehicleInService: form.get('vehicleInService'),
      hourlyPenaltyRate: form.get('hourlyPenaltyRate') ? Number(form.get('hourlyPenaltyRate')) : undefined,
      weeklyHourTarget: form.get('weeklyHourTarget') ? Number(form.get('weeklyHourTarget')) : undefined,
    };

    if (contractType === 'CONDITION_VENTE') {
      payload.totalPriceFixed = Number(form.get('totalPriceFixed'));
    } else {
      payload.cautionReference = Number(form.get('cautionReference'));
      payload.cautionMinThreshold = form.get('cautionMinThreshold') ? Number(form.get('cautionMinThreshold')) : undefined;
    }

    const res = await fetch('/api/drivers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      setSaving(false);
      const data = await res.json();
      setError(data.error ?? 'Erreur lors de la création.');
      return;
    }

    const driver = await res.json();

    // Suppression automatique de la liste d'attente si un chauffeur y était sélectionné
    if (selectedPendingId) {
      await fetch(`/api/pending-drivers/${selectedPendingId}`, { method: 'DELETE' });
    }

    setSaving(false);
    router.push(`/drivers/${driver.id}`);
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="p-6 max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="font-display font-bold text-2xl text-transparent bg-clip-text bg-gradient-to-r from-hud-cyan to-white tracking-widest">
            NOUVEAU CHAUFFEUR
          </h1>
          <p className="text-xs text-gray-500 tracking-widest uppercase mt-1">Enregistrement d'un chauffeur avec véhicule</p>
        </div>

        {/* Sélection depuis la liste d'attente */}
        {pendingDrivers.length > 0 && (
          <div className="card p-4 mb-6 border-hud-cyan/30">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-1 h-4 rounded-full bg-hud-cyan shadow-neon" />
              <span className="hud-label !mb-0">Importer depuis la liste d'attente</span>
            </div>
            <p className="text-xs text-gray-500 mb-3">
              Sélectionne un chauffeur en attente pour pré-remplir ses informations.
              Il sera automatiquement retiré de la liste d'attente après création.
            </p>
            <select
              value={selectedPendingId}
              onChange={(e) => handleSelectPending(e.target.value)}
              className="hud-select w-full"
            >
              <option value="">— Sélectionner un chauffeur en attente —</option>
              {pendingDrivers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.fullName} · {p.phone} · {p.contractType === 'CONDITION_VENTE' ? 'Condition-Vente' : 'Location'} · Caution versée : {Number(p.cautionPaid).toLocaleString('fr-FR')} FCFA
                </option>
              ))}
            </select>
            {selectedPendingId && (
              <div className="mt-2 flex items-center gap-2 text-xs text-hud-green">
                <span>✓</span>
                <span>Formulaire pré-rempli — ce chauffeur sera supprimé de la liste d'attente à la création.</span>
              </div>
            )}
          </div>
        )}

        <form ref={formRef} onSubmit={handleSubmit} className="card p-6 space-y-6">

          {/* Type de contrat */}
          <div>
            <label className="hud-label">Type de contrat</label>
            <select value={contractType} onChange={(e) => setContractType(e.target.value as 'CONDITION_VENTE' | 'LOCATION')} className="hud-select w-full">
              <option value="CONDITION_VENTE">Condition-Vente</option>
              <option value="LOCATION">Location</option>
            </select>
          </div>

          <Separator label="Chauffeur" />
          <div className="grid grid-cols-2 gap-3">
            <Field name="fullName" label="Nom complet" required value={fullName} onChange={setFullName} />
            <Field name="phone" label="Téléphone" required value={phone} onChange={setPhone} />
            <Field name="location" label="Localisation" required value={location} onChange={setLocation} />
            <Field name="licenseNumber" label="N° de permis" required value={licenseNumber} onChange={setLicenseNumber} />
          </div>

          <Separator label="Propriétaire & Garant" />
          <div className="grid grid-cols-2 gap-3">
            <Field name="ownerName" label="Nom du propriétaire" required />
            <Field name="ownerPhone" label="Téléphone propriétaire" required />
            <Field name="ownerLocation" label="Localisation propriétaire" required />
            <Field name="guarantorName" label="Nom du garant" required />
            <Field name="guarantorPhone" label="Téléphone garant" required />
          </div>

          <Separator label="Véhicule" />
          <div className="grid grid-cols-2 gap-3">
            <Field name="vehicleBrand" label="Marque" required />
            <Field name="vehicleModel" label="Modèle" required />
            <Field name="vehiclePlate" label="Plaque d'immatriculation" required />
            <Field name="vehicleColor" label="Couleur" required />
            <Field name="vehicleInService" label="Date de mise en service" type="date" required />
          </div>

          <Separator label={contractType === 'CONDITION_VENTE' ? 'Condition-Vente' : 'Location'} />
          <div className="grid grid-cols-2 gap-3">
            {contractType === 'CONDITION_VENTE' ? (
              <Field name="totalPriceFixed" label="Montant total fixé (FCFA)" type="number" required />
            ) : (
              <>
                <Field name="cautionReference" label="Caution de référence (FCFA)" type="number" required />
                <Field name="cautionMinThreshold" label="Seuil minimal d'alerte (FCFA)" type="number" required />
              </>
            )}
          </div>

          <Separator label="Sanction (facultatif)" />
          <div className="grid grid-cols-2 gap-3">
            <Field name="hourlyPenaltyRate" label="Taux pénalité / heure manquante (FCFA)" type="number" />
            <Field name="weeklyHourTarget" label="Objectif heures / semaine" type="number" defaultValue={55} />
          </div>

          {error && (
            <div className="text-xs text-empire-rougeVif border border-empire-rouge/30 bg-empire-rouge/10 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <button type="submit" disabled={saving} className="btn-primary w-full py-3 font-display tracking-widest">
            {saving ? '⟳  ENREGISTREMENT...' : '→  CRÉER LE CHAUFFEUR'}
          </button>
        </form>
      </div>
    </div>
  );
}

function Separator({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-1 h-4 rounded-full bg-hud-cyan/60" />
      <span className="text-xs font-display text-hud-cyan uppercase tracking-widest">{label}</span>
      <div className="flex-1 h-px bg-hud-line" />
    </div>
  );
}

function Field({
  name, label, type = 'text', required, defaultValue, value, onChange,
}: {
  name: string; label: string; type?: string; required?: boolean;
  defaultValue?: string | number; value?: string; onChange?: (v: string) => void;
}) {
  const isControlled = value !== undefined && onChange !== undefined;
  return (
    <div>
      <label className="hud-label">{label}</label>
      <input
        name={name}
        type={type}
        required={required}
        className="hud-input"
        {...(isControlled
          ? { value, onChange: (e) => onChange!(e.target.value) }
          : { defaultValue })}
      />
    </div>
  );
}
