'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';

type DriverDetail = any;

export default function EditDriverPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [driver, setDriver] = useState<DriverDetail | null>(null);
  const [contractType, setContractType] = useState<'CONDITION_VENTE' | 'LOCATION'>('CONDITION_VENTE');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/drivers/${params.id}`)
      .then((res) => res.json())
      .then((data) => {
        setDriver(data);
        setContractType(data.contractType);
        setLoading(false);
      });
  }, [params.id]);

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

    const res = await fetch(`/api/drivers/${params.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    setSaving(false);

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? 'Erreur lors de la modification.');
      return;
    }

    router.push(`/drivers/${params.id}`);
  }

  if (loading || !driver) {
    return (
      <div>
        <Navbar />
        <div className="p-6 max-w-3xl mx-auto text-gray-400">Chargement...</div>
      </div>
    );
  }

  return (
    <div>
      <Navbar />
      <div className="p-6 max-w-3xl mx-auto">
        <h1 className="text-xl font-bold mb-4">
          Modifier {driver.fullName} <span className="text-gray-400 font-mono text-sm">({driver.code})</span>
        </h1>

        <form onSubmit={handleSubmit} className="bg-white rounded shadow p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium mb-1">Type de contrat</label>
            <select
              value={contractType}
              onChange={(e) => setContractType(e.target.value as 'CONDITION_VENTE' | 'LOCATION')}
              className="border rounded px-2 py-1.5 text-sm w-full"
            >
              <option value="CONDITION_VENTE">Condition-Vente</option>
              <option value="LOCATION">Location</option>
            </select>
          </div>

          <fieldset className="grid grid-cols-2 gap-3">
            <legend className="font-semibold text-sm mb-2 col-span-2">Chauffeur</legend>
            <Field name="fullName" label="Nom complet" required defaultValue={driver.fullName} />
            <Field name="phone" label="Téléphone" required defaultValue={driver.phone} />
            <Field name="location" label="Localisation" required defaultValue={driver.location} />
            <Field name="licenseNumber" label="N° de permis" required defaultValue={driver.licenseNumber} />
          </fieldset>

          <fieldset className="grid grid-cols-2 gap-3">
            <legend className="font-semibold text-sm mb-2 col-span-2">Propriétaire & Garant</legend>
            <Field name="ownerName" label="Nom du propriétaire" required defaultValue={driver.ownerName} />
            <Field name="ownerPhone" label="Téléphone propriétaire" required defaultValue={driver.ownerPhone} />
            <Field name="ownerLocation" label="Localisation propriétaire" required defaultValue={driver.ownerLocation} />
            <Field name="guarantorName" label="Nom du garant" required defaultValue={driver.guarantorName} />
            <Field name="guarantorPhone" label="Téléphone garant" required defaultValue={driver.guarantorPhone} />
          </fieldset>

          <fieldset className="grid grid-cols-2 gap-3">
            <legend className="font-semibold text-sm mb-2 col-span-2">Véhicule</legend>
            <Field name="vehicleBrand" label="Marque" required defaultValue={driver.vehicleBrand} />
            <Field name="vehicleModel" label="Modèle" required defaultValue={driver.vehicleModel} />
            <Field name="vehiclePlate" label="Plaque d'immatriculation" required defaultValue={driver.vehiclePlate} />
            <Field name="vehicleColor" label="Couleur" required defaultValue={driver.vehicleColor} />
            <Field
              name="vehicleInService"
              label="Date de mise en service"
              type="date"
              required
              defaultValue={driver.vehicleInService ? driver.vehicleInService.slice(0, 10) : ''}
            />
          </fieldset>

          <fieldset className="grid grid-cols-2 gap-3">
            <legend className="font-semibold text-sm mb-2 col-span-2">
              {contractType === 'CONDITION_VENTE' ? 'Condition-Vente' : 'Location'}
            </legend>
            {contractType === 'CONDITION_VENTE' ? (
              <Field
                name="totalPriceFixed"
                label="Montant total fixé (FCFA)"
                type="number"
                required
                defaultValue={driver.totalPriceFixed ?? ''}
              />
            ) : (
              <>
                <Field
                  name="cautionReference"
                  label="Caution de référence (FCFA)"
                  type="number"
                  required
                  defaultValue={driver.cautionReference ?? ''}
                />
                <Field
                  name="cautionMinThreshold"
                  label="Seuil minimal d'alerte (FCFA)"
                  type="number"
                  required
                  defaultValue={driver.cautionMinThreshold ?? ''}
                />
              </>
            )}
          </fieldset>

          <fieldset className="grid grid-cols-2 gap-3">
            <legend className="font-semibold text-sm mb-2 col-span-2">
              Sanction <span className="text-gray-400 font-normal">(facultatif)</span>
            </legend>
            <Field
              name="hourlyPenaltyRate"
              label="Taux pénalité / heure manquante (FCFA)"
              type="number"
              defaultValue={driver.hourlyPenaltyRate ?? 0}
            />
            <Field
              name="weeklyHourTarget"
              label="Objectif heures / semaine"
              type="number"
              defaultValue={driver.weeklyHourTarget ?? 55}
            />
          </fieldset>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="bg-empire-rouge text-white px-4 py-2 rounded text-sm hover:bg-empire-rougeVif disabled:opacity-50"
          >
            {saving ? 'Enregistrement...' : 'Enregistrer les modifications'}
          </button>
        </form>
      </div>
    </div>
  );
}

function Field({
  name,
  label,
  type = 'text',
  required,
  defaultValue,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  defaultValue?: string | number;
}) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-0.5">{label}</label>
      <input
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        className="border rounded px-2 py-1.5 text-sm w-full"
      />
    </div>
  );
}
