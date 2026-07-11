'use client';

import { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { formatFCFA } from '@/lib/business';
import { getBusinessUnitConfig } from '@/lib/businessUnits';
import type { AccountingSummary } from '@/components/AccountingCharts';

const AccountingCharts = dynamic(() => import('@/components/AccountingCharts'), {
  ssr: false,
  loading: () => (
    <div className="card p-6 flex items-center justify-center h-56">
      <div className="w-8 h-8 border-2 border-hud-cyan border-t-transparent rounded-full animate-spin" />
    </div>
  ),
});

type Product = {
  id: string;
  name: string;
  unitPrice: string | number;
  quantityInStock: number;
  active: boolean;
};

type Entry = {
  id: string;
  date: string;
  type: 'ENTREE' | 'SORTIE';
  category: string;
  label: string;
  amount: number;
  paymentMode: string;
  note?: string | null;
  businessUnit?: string | null;
  createdAt: string;
  enteredBy: string;
};

const MODE_LABELS: Record<string, string> = {
  ESPECES: 'Espèces', MOBILE_MONEY: 'Mobile Money', VIREMENT: 'Virement', AUTRE: 'Autre', PORTEFEUILLE: 'Portefeuille',
};

const todayISO = () => new Date().toISOString().slice(0, 10);

export default function StructurePanel({ businessUnit, canDelete }: { businessUnit: string; canDelete: boolean }) {
  const config = getBusinessUnitConfig(businessUnit);
  const [products, setProducts] = useState<Product[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [summary, setSummary] = useState<AccountingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ businessUnit });
    if (dateFrom) params.set('from', dateFrom);
    if (dateTo) params.set('to', dateTo);
    const qs = params.toString();
    const [pRes, eRes, sRes] = await Promise.all([
      config?.hasStock ? fetch(`/api/business-units/products?businessUnit=${businessUnit}`) : Promise.resolve(null),
      fetch(`/api/accounting?${qs}`),
      fetch(`/api/accounting/summary?${qs}`),
    ]);
    if (pRes?.ok) setProducts(await pRes.json());
    if (eRes.ok) setEntries(await eRes.json());
    if (sRes.ok) setSummary(await sRes.json());
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessUnit, dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  async function handleDeleteEntry(id: string) {
    if (!confirm('Supprimer cette écriture ?')) return;
    const res = await fetch(`/api/accounting/${id}`, { method: 'DELETE' });
    if (!res.ok) { const d = await res.json().catch(() => ({})); alert(d.error ?? 'Erreur.'); return; }
    load();
  }

  if (!config) return null;

  return (
    <div className="space-y-6">
      {error && <p className="text-sm text-empire-rouge font-bold">{error}</p>}

      {/* Filtre de période — comptabilité partielle de cette structure */}
      <div className="card p-3 flex flex-wrap items-center gap-3">
        <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Période</span>
        <div className="flex items-center gap-1.5">
          <label className="text-xs text-gray-500 font-bold">Du</label>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="form-input text-xs py-1 px-2 w-36" />
          <label className="text-xs text-gray-500 font-bold">Au</label>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="form-input text-xs py-1 px-2 w-36" />
          {(dateFrom || dateTo) && (
            <button onClick={() => { setDateFrom(''); setDateTo(''); }} className="text-xs text-hud-cyan font-bold hover:underline">
              Réinitialiser
            </button>
          )}
        </div>
      </div>

      {/* Flux de la structure — comptabilité partielle */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="stat-card">
            <span className="stat-label">Entrées</span>
            <span className="font-display font-black text-lg tabular-nums" style={{ color: '#2f7d4f' }}>+ {formatFCFA(summary.totals.entrees)}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Sorties</span>
            <span className="font-display font-black text-lg tabular-nums" style={{ color: '#b3122a' }}>− {formatFCFA(summary.totals.sorties)}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Solde net</span>
            <span className="font-display font-black text-lg tabular-nums" style={{ color: summary.totals.solde >= 0 ? '#2f7d4f' : '#b3122a' }}>
              {formatFCFA(summary.totals.solde)}
            </span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Opérations</span>
            <span className="font-display font-black text-lg tabular-nums text-hud-cyan">{summary.totals.count}</span>
          </div>
        </div>
      )}
      {summary && <AccountingCharts summary={summary} animate />}

      {config.hasStock && (
        <StockSection
          businessUnit={businessUnit}
          stockLabel={config.stockLabel!}
          products={products}
          onChange={load}
          setError={setError}
        />
      )}

      {config.services.length > 0 && (
        <ServiceSection businessUnit={businessUnit} services={[...config.services]} onSaved={load} />
      )}

      <div className="card overflow-hidden">
        <div className="p-4 border-b border-hud-line">
          <h2 className="hud-title">Journal — {config.label}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="hud-table">
            <thead>
              <tr>
                <th>Date</th><th>Type</th><th>Catégorie</th><th>Libellé</th><th>Mode</th>
                <th className="text-right">Montant</th><th>Saisi par</th>{canDelete && <th></th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="text-center italic text-gray-500 py-6">⟳ Chargement...</td></tr>
              ) : entries.length === 0 ? (
                <tr><td colSpan={8} className="text-center italic text-gray-500 py-6">Aucune opération pour cette structure.</td></tr>
              ) : entries.map((e) => (
                <tr key={e.id}>
                  <td className="whitespace-nowrap">{new Date(e.date).toLocaleDateString('fr-FR')}</td>
                  <td>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-bold border ${
                      e.type === 'ENTREE' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-red-100 text-red-800 border-red-300'
                    }`}>
                      {e.type === 'ENTREE' ? 'Entrée' : 'Sortie'}
                    </span>
                  </td>
                  <td>{e.category}</td>
                  <td className="font-semibold">{e.label}</td>
                  <td className="text-xs">{MODE_LABELS[e.paymentMode] ?? e.paymentMode}</td>
                  <td className="text-right font-bold tabular-nums whitespace-nowrap" style={{ color: e.type === 'ENTREE' ? '#2f7d4f' : '#b3122a' }}>
                    {e.type === 'ENTREE' ? '+' : '−'} {formatFCFA(e.amount)}
                  </td>
                  <td className="text-xs text-gray-500">{e.enteredBy}</td>
                  {canDelete && (
                    <td>
                      <button onClick={() => handleDeleteEntry(e.id)} className="btn-danger text-xs py-1 px-2">Suppr.</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StockSection({
  businessUnit, stockLabel, products, onChange, setError,
}: {
  businessUnit: string; stockLabel: string; products: Product[]; onChange: () => void; setError: (e: string) => void;
}) {
  const [showNewProduct, setShowNewProduct] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newQty, setNewQty] = useState('0');
  const [actionFor, setActionFor] = useState<{ productId: string; type: 'VENTE' | 'APPRO' } | null>(null);
  const [qty, setQty] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [recordCost, setRecordCost] = useState(false);
  const [note, setNote] = useState('');
  const [date, setDate] = useState(todayISO());

  async function createProduct(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const res = await fetch('/api/business-units/products', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ businessUnit, name: newName, unitPrice: Number(newPrice), quantityInStock: Number(newQty || 0) }),
    });
    if (!res.ok) { const d = await res.json().catch(() => ({})); setError(d.error ?? 'Erreur.'); return; }
    setNewName(''); setNewPrice(''); setNewQty('0'); setShowNewProduct(false);
    onChange();
  }

  function openAction(productId: string, type: 'VENTE' | 'APPRO', defaultPrice: number) {
    setActionFor({ productId, type });
    setQty(''); setUnitPrice(String(defaultPrice)); setRecordCost(false); setNote(''); setDate(todayISO());
  }

  async function submitAction(e: React.FormEvent) {
    e.preventDefault();
    if (!actionFor) return;
    setError('');
    const res = await fetch('/api/business-units/stock-movements', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productId: actionFor.productId, type: actionFor.type, quantity: Number(qty),
        unitPrice: unitPrice ? Number(unitPrice) : undefined, date, note: note || undefined,
        recordCost: actionFor.type === 'APPRO' ? recordCost : undefined,
      }),
    });
    if (!res.ok) { const d = await res.json().catch(() => ({})); setError(d.error ?? 'Erreur.'); return; }
    setActionFor(null);
    onChange();
  }

  async function deleteProduct(id: string) {
    if (!confirm('Supprimer ce produit du catalogue ?')) return;
    const res = await fetch(`/api/business-units/products/${id}`, { method: 'DELETE' });
    if (!res.ok) { const d = await res.json().catch(() => ({})); alert(d.error ?? 'Erreur.'); return; }
    onChange();
  }

  const totalValue = products.reduce((s, p) => s + Number(p.unitPrice) * p.quantityInStock, 0);

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="w-1 h-5 rounded-full bg-hud-cyan" />
          <h2 className="hud-title">Stock — {stockLabel}</h2>
          <span className="text-xs text-gray-500">Valeur totale : {formatFCFA(totalValue)}</span>
        </div>
        <button onClick={() => setShowNewProduct((v) => !v)} className="btn-primary text-xs px-3 py-1.5">
          {showNewProduct ? 'Annuler' : `+ Nouveau ${stockLabel.toLowerCase()}`}
        </button>
      </div>

      {showNewProduct && (
        <form onSubmit={createProduct} className="flex flex-wrap gap-3 items-end p-3 bg-hud-panel2 rounded-lg">
          <div>
            <label className="hud-label">Nom</label>
            <input value={newName} onChange={(e) => setNewName(e.target.value)} required className="form-input w-48" placeholder={stockLabel} />
          </div>
          <div>
            <label className="hud-label">Prix unitaire (FCFA)</label>
            <input type="number" min="0" value={newPrice} onChange={(e) => setNewPrice(e.target.value)} required className="form-input w-36" />
          </div>
          <div>
            <label className="hud-label">Stock initial</label>
            <input type="number" min="0" value={newQty} onChange={(e) => setNewQty(e.target.value)} className="form-input w-28" />
          </div>
          <button type="submit" className="btn-primary text-sm">Créer</button>
        </form>
      )}

      <div className="overflow-x-auto">
        <table className="hud-table">
          <thead><tr><th>Produit</th><th className="text-right">Prix unitaire</th><th className="text-right">Stock</th><th className="text-right">Valeur</th><th></th></tr></thead>
          <tbody>
            {products.length === 0 ? (
              <tr><td colSpan={5} className="text-center italic text-gray-500 py-6">Aucun produit en catalogue.</td></tr>
            ) : products.map((p) => (
              <tr key={p.id}>
                <td className="font-semibold">{p.name}</td>
                <td className="text-right font-mono">{formatFCFA(Number(p.unitPrice))}</td>
                <td className={`text-right font-bold ${p.quantityInStock <= 0 ? 'text-empire-rouge' : ''}`}>{p.quantityInStock}</td>
                <td className="text-right font-mono text-hud-cyan">{formatFCFA(Number(p.unitPrice) * p.quantityInStock)}</td>
                <td className="flex gap-1.5 flex-wrap justify-end py-2">
                  <button onClick={() => openAction(p.id, 'VENTE', Number(p.unitPrice))} className="btn-secondary text-xs py-1 px-2">Vendre</button>
                  <button onClick={() => openAction(p.id, 'APPRO', Number(p.unitPrice))} className="btn-secondary text-xs py-1 px-2">Réappro.</button>
                  <button onClick={() => deleteProduct(p.id)} className="btn-danger text-xs py-1 px-2">Suppr.</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {actionFor && (
        <form onSubmit={submitAction} className="flex flex-wrap gap-3 items-end p-3 bg-hud-panel2 rounded-lg border border-hud-cyan/30">
          <h3 className="w-full text-xs font-bold uppercase tracking-widest text-hud-cyan">
            {actionFor.type === 'VENTE' ? 'Enregistrer une vente' : 'Enregistrer un réapprovisionnement'}
          </h3>
          <div>
            <label className="hud-label">Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className="form-input w-auto" />
          </div>
          <div>
            <label className="hud-label">Quantité</label>
            <input type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} required className="form-input w-24" />
          </div>
          <div>
            <label className="hud-label">Prix unitaire (FCFA)</label>
            <input type="number" min="0" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} className="form-input w-32" />
          </div>
          {actionFor.type === 'APPRO' && (
            <label className="flex items-center gap-2 text-xs text-gray-600">
              <input type="checkbox" checked={recordCost} onChange={(e) => setRecordCost(e.target.checked)} className="w-4 h-4" />
              Enregistrer le coût d'achat en sortie comptable
            </label>
          )}
          <div className="flex-1 min-w-[160px]">
            <label className="hud-label">Note</label>
            <input value={note} onChange={(e) => setNote(e.target.value)} className="form-input w-full" />
          </div>
          <button type="submit" className="btn-primary text-sm">Valider</button>
          <button type="button" onClick={() => setActionFor(null)} className="btn-secondary text-sm">Annuler</button>
        </form>
      )}
    </div>
  );
}

function ServiceSection({ businessUnit, services, onSaved }: { businessUnit: string; services: string[]; onSaved: () => void }) {
  const [serviceName, setServiceName] = useState(services[0] ?? '');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState('');
  const [paymentMode, setPaymentMode] = useState('ESPECES');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setSaving(true);
    const res = await fetch('/api/accounting', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date, type: 'ENTREE', category: serviceName, label: serviceName, amount: Number(amount),
        paymentMode, note: note || undefined, businessUnit,
      }),
    });
    setSaving(false);
    if (!res.ok) { const d = await res.json().catch(() => ({})); setError(d.error ?? 'Erreur.'); return; }
    setAmount(''); setNote('');
    onSaved();
  }

  return (
    <div className="card p-5 space-y-3">
      <div className="flex items-center gap-2">
        <div className="w-1 h-5 rounded-full bg-empire-rouge" />
        <h2 className="hud-title">Services</h2>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="hud-label">Service</label>
          <select value={serviceName} onChange={(e) => setServiceName(e.target.value)} className="form-select w-56">
            {services.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="hud-label">Montant (FCFA)</label>
          <input type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} required className="form-input w-36" />
        </div>
        <div>
          <label className="hud-label">Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className="form-input w-auto" />
        </div>
        <div>
          <label className="hud-label">Mode</label>
          <select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)} className="form-select w-36">
            <option value="ESPECES">Espèces</option>
            <option value="MOBILE_MONEY">Mobile Money</option>
            <option value="VIREMENT">Virement</option>
            <option value="AUTRE">Autre</option>
          </select>
        </div>
        <div className="flex-1 min-w-[160px]">
          <label className="hud-label">Note</label>
          <input value={note} onChange={(e) => setNote(e.target.value)} className="form-input w-full" />
        </div>
        <button type="submit" disabled={saving} className="btn-primary text-sm">
          {saving ? 'Enregistrement...' : 'Enregistrer la vente'}
        </button>
        {error && <p className="text-xs text-empire-rouge w-full font-bold">{error}</p>}
      </form>
    </div>
  );
}
