'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import Navbar from '@/components/Navbar';
import AvatarUploader from '@/components/AvatarUploader';
import { CAPABILITIES, resolveCapabilities, type CapabilityKey } from '@/lib/capabilities';

type User = {
  id: string;
  username: string;
  fullName: string;
  role: 'ADMIN' | 'MANAGER' | 'EMPLOYEE';
  active: boolean;
  avatarUrl?: string | null;
  capabilities?: Record<string, boolean> | null;
};

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrateur',
  MANAGER: 'Gestionnaire',
  EMPLOYEE: 'Employé',
};

const ROLE_MATRIX = [
  { cap: 'Voir les chauffeurs & versements', admin: true, manager: true, employee: 'Affectés' },
  { cap: 'Saisir versements / loyers', admin: true, manager: true, employee: 'Affectés' },
  { cap: 'Propriétaires & rapports', admin: true, manager: true, employee: false },
  { cap: 'Comptabilité Empire', admin: true, manager: true, employee: true },
  { cap: 'Créer / modifier des comptes', admin: true, manager: 'Sans ADMIN', employee: false },
  { cap: 'Changer les rôles', admin: true, manager: false, employee: false },
  { cap: 'Supprimer un compte', admin: true, manager: false, employee: false },
];

export default function SettingsPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user.role === 'ADMIN';

  const [users, setUsers] = useState<User[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [flash, setFlash] = useState('');
  const [selectedId, setSelectedId] = useState<string>('');

  const fetchUsers = useCallback(async () => {
    const res = await fetch('/api/users');
    if (res.ok) {
      const d = await res.json();
      setUsers(Array.isArray(d) ? d : []);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  async function toggleCap(user: User, cap: CapabilityKey) {
    const effective = resolveCapabilities(user.role, user.capabilities);
    const current = { ...(user.capabilities ?? {}) } as Record<string, boolean>;
    current[cap] = !effective[cap];
    await patch(
      user.id,
      { capabilities: current },
      `Capacité « ${CAPABILITIES.find((c) => c.key === cap)?.label} » ${!effective[cap] ? 'accordée' : 'révoquée'} à ${user.fullName}`,
    );
  }

  async function patch(id: string, body: Record<string, unknown>, msg: string) {
    setSavingId(id);
    const res = await fetch(`/api/users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    setSavingId(null);
    if (res.ok) {
      setFlash(msg);
      setTimeout(() => setFlash(''), 2500);
      fetchUsers();
    }
  }

  if (session && !isAdmin) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="p-6 max-w-2xl mx-auto">
          <div className="card p-6 text-center">
            <p className="font-bold text-empire-rouge">Accès réservé à l&apos;administrateur principal.</p>
            <p className="text-sm text-gray-500 mt-1">La gestion des accès et des rôles est exclusive à l&apos;ADMIN.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="font-display font-bold text-2xl text-transparent bg-clip-text bg-gradient-to-r from-hud-cyan to-empire-rouge tracking-widest">
            PARAMÈTRES
          </h1>
          <p className="text-xs text-gray-500 tracking-widest uppercase font-bold">Gestion des accès & des rôles — administrateur principal</p>
        </div>
        <div className="h-px bg-gradient-to-r from-transparent via-hud-cyan/30 to-transparent" />

        {flash && (
          <div className="card p-3 border-emerald-400 bg-emerald-50 text-emerald-800 font-bold text-sm">
            ✓ {flash}
          </div>
        )}

        {/* Contrôle des accès */}
        <div className="card overflow-hidden">
          <div className="flex items-center gap-2 p-4 border-b border-hud-line">
            <div className="w-1 h-5 rounded-full bg-empire-rouge" />
            <h2 className="hud-title">Contrôle des accès utilisateurs</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="hud-table">
              <thead>
                <tr>
                  <th>Utilisateur</th>
                  <th>Identifiant</th>
                  <th>Rôle</th>
                  <th>Accès</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const isSelf = u.id === session?.user.id;
                  return (
                    <tr key={u.id}>
                      <td>
                        <div className="flex items-center gap-2">
                          <AvatarUploader fullName={u.fullName} avatarUrl={u.avatarUrl} size={32} />
                          <span className="font-bold text-gray-800">{u.fullName}</span>
                          {isSelf && <span className="text-[10px] text-hud-cyan font-bold">(vous)</span>}
                        </div>
                      </td>
                      <td className="font-mono text-hud-cyan">{u.username}</td>
                      <td>
                        <select
                          value={u.role}
                          disabled={isSelf || savingId === u.id}
                          onChange={(e) => patch(u.id, { role: e.target.value }, `Rôle de ${u.fullName} : ${ROLE_LABELS[e.target.value]}`)}
                          className="form-select w-40 disabled:opacity-50"
                        >
                          <option value="EMPLOYEE">Employé</option>
                          <option value="MANAGER">Gestionnaire</option>
                          <option value="ADMIN">Administrateur</option>
                        </select>
                      </td>
                      <td>
                        <button
                          onClick={() => patch(u.id, { active: !u.active }, `${u.fullName} ${u.active ? 'bloqué' : 'autorisé'}`)}
                          disabled={isSelf || savingId === u.id}
                          className={`text-xs font-bold px-3 py-1.5 rounded-lg border-2 transition-all disabled:opacity-40 ${
                            u.active
                              ? 'border-emerald-500 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                              : 'border-gray-400 bg-gray-100 text-gray-500'
                          }`}
                        >
                          {u.active ? '● Accès autorisé' : '○ Accès bloqué'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Capacités par utilisateur */}
        <div className="card overflow-hidden">
          <div className="flex items-center gap-2 p-4 border-b border-hud-line">
            <div className="w-1 h-5 rounded-full bg-empire-rouge" />
            <h2 className="hud-title">Capacités individuelles</h2>
          </div>
          <div className="p-4 space-y-4">
            <div>
              <label className="hud-label">Choisir un utilisateur</label>
              <select
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                className="form-select w-full md:w-80"
              >
                <option value="">— Sélectionner —</option>
                {users.filter((u) => u.id !== session?.user.id).map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.fullName} ({ROLE_LABELS[u.role]})
                  </option>
                ))}
              </select>
            </div>

            {(() => {
              const u = users.find((x) => x.id === selectedId);
              if (!u) {
                return <p className="text-sm text-gray-500 italic">Sélectionnez un utilisateur pour ajuster ses capacités au-delà de son rôle.</p>;
              }
              if (u.role === 'ADMIN') {
                return <p className="text-sm font-bold text-empire-rouge">Un administrateur dispose de toutes les capacités (non modifiable).</p>;
              }
              const eff = resolveCapabilities(u.role, u.capabilities);
              return (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {CAPABILITIES.map((c) => {
                    const on = eff[c.key];
                    return (
                      <button
                        key={c.key}
                        onClick={() => toggleCap(u, c.key)}
                        disabled={savingId === u.id}
                        className={`flex items-start justify-between gap-3 p-3 rounded-lg border-2 text-left transition-all disabled:opacity-50 ${
                          on ? 'border-emerald-500 bg-emerald-50' : 'border-hud-line bg-white'
                        }`}
                      >
                        <span>
                          <span className="block font-bold text-sm text-gray-800">{c.label}</span>
                          <span className="block text-xs text-gray-500">{c.desc}</span>
                        </span>
                        <span className={`shrink-0 w-11 h-6 rounded-full relative transition-colors ${on ? 'bg-emerald-500' : 'bg-gray-300'}`}>
                          <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} />
                        </span>
                      </button>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </div>

        {/* Matrice des permissions */}
        <div className="card overflow-hidden">
          <div className="flex items-center gap-2 p-4 border-b border-hud-line">
            <div className="w-1 h-5 rounded-full bg-hud-cyan" />
            <h2 className="hud-title">Matrice des permissions par défaut (par rôle)</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="hud-table">
              <thead>
                <tr>
                  <th>Capacité</th>
                  <th className="text-center">Administrateur</th>
                  <th className="text-center">Gestionnaire</th>
                  <th className="text-center">Employé</th>
                </tr>
              </thead>
              <tbody>
                {ROLE_MATRIX.map((row) => (
                  <tr key={row.cap}>
                    <td className="font-bold">{row.cap}</td>
                    <td className="text-center"><Cell v={row.admin} /></td>
                    <td className="text-center"><Cell v={row.manager} /></td>
                    <td className="text-center"><Cell v={row.employee} /></td>
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

function Cell({ v }: { v: boolean | string }) {
  if (v === true) return <span className="text-emerald-600 font-bold text-lg">✓</span>;
  if (v === false) return <span className="text-gray-300 font-bold text-lg">✕</span>;
  return <span className="text-xs font-bold text-hud-cyan bg-hud-cyan/10 px-2 py-0.5 rounded-full">{v}</span>;
}
