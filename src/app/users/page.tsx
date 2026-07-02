'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import Navbar from '@/components/Navbar';
import AvatarUploader from '@/components/AvatarUploader';
import { useCapabilities } from '@/lib/useCapabilities';

type User = {
  id: string;
  username: string;
  fullName: string;
  role: 'ADMIN' | 'MANAGER' | 'EMPLOYEE';
  active: boolean;
  avatarUrl?: string | null;
};

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrateur',
  MANAGER: 'Gestionnaire',
  EMPLOYEE: 'Employé',
};

export default function UsersPage() {
  const { data: session } = useSession();
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ username: '', password: '', fullName: '', role: 'EMPLOYEE' as 'ADMIN' | 'MANAGER' | 'EMPLOYEE' });

  const { caps, loading: capsLoading } = useCapabilities();
  const isAdmin = session?.user.role === 'ADMIN';
  const canAccess = !!caps.users_manage;

  const fetchUsers = useCallback(async () => {
    const res = await fetch('/api/users');
    if (res.ok) {
      const d = await res.json();
      setUsers(Array.isArray(d) ? d : []);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? 'Erreur.');
      return;
    }
    setForm({ username: '', password: '', fullName: '', role: 'EMPLOYEE' });
    fetchUsers();
  }

  async function toggleActive(u: User) {
    await fetch(`/api/users/${u.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !u.active }),
    });
    fetchUsers();
  }

  async function handleDelete(u: User) {
    if (!confirm(`Supprimer le compte ${u.username} ?`)) return;
    await fetch(`/api/users/${u.id}`, { method: 'DELETE' });
    fetchUsers();
  }

  if (session && !capsLoading && !canAccess) {
    return (
      <div>
        <Navbar />
        <div className="p-6">Accès réservé aux administrateurs et gestionnaires.</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="font-display font-bold text-2xl text-transparent bg-clip-text bg-gradient-to-r from-hud-cyan to-empire-rouge tracking-widest">
            UTILISATEURS
          </h1>
          <p className="text-xs text-gray-500 tracking-widest uppercase">Gestion des comptes</p>
        </div>

        <div className="h-px bg-gradient-to-r from-transparent via-hud-cyan/30 to-transparent" />

        <form onSubmit={handleCreate} className="card p-4 flex flex-wrap gap-3 items-end">
          <div>
            <label className="hud-label">Identifiant</label>
            <input
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              className="form-input w-40"
              required
            />
          </div>
          <div>
            <label className="hud-label">Mot de passe</label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="form-input w-36"
              required
            />
          </div>
          <div>
            <label className="hud-label">Nom complet</label>
            <input
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              className="form-input w-48"
              required
            />
          </div>
          <div>
            <label className="hud-label">Rôle</label>
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as 'ADMIN' | 'MANAGER' | 'EMPLOYEE' })}
              className="form-select w-44"
            >
              <option value="EMPLOYEE">Employé</option>
              <option value="MANAGER">Gestionnaire</option>
              {/* Seul l'admin peut créer un autre administrateur */}
              {isAdmin && <option value="ADMIN">Administrateur</option>}
            </select>
          </div>
          <button type="submit" className="btn-primary">Créer</button>
          {error && <p className="text-sm text-red-400 w-full">{error}</p>}
        </form>

        <div className="card overflow-x-auto">
          <table className="hud-table">
            <thead>
              <tr>
                <th>Photo</th>
                <th>Identifiant</th>
                <th>Nom</th>
                <th>Rôle</th>
                <th>Statut</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td><AvatarUploader fullName={u.fullName} avatarUrl={u.avatarUrl} size={32} /></td>
                  <td className="font-mono text-hud-cyan">{u.username}</td>
                  <td className="font-semibold text-white">{u.fullName}</td>
                  <td>
                    <span className={
                      u.role === 'ADMIN' ? 'text-empire-rougeVif font-bold' :
                      u.role === 'MANAGER' ? 'text-yellow-400 font-bold' :
                      'text-gray-400'
                    }>
                      {ROLE_LABELS[u.role]}
                    </span>
                  </td>
                  <td>
                    <span className={u.active ? 'text-emerald-400 font-semibold' : 'text-gray-500 italic'}>
                      {u.active ? 'Actif' : 'Désactivé'}
                    </span>
                  </td>
                  <td className="flex gap-2">
                    <button
                      onClick={() => toggleActive(u)}
                      disabled={u.id === session?.user.id}
                      className="btn-secondary text-xs py-1 px-2 disabled:opacity-30"
                    >
                      {u.active ? 'Désactiver' : 'Activer'}
                    </button>
                    {/* Supprimer : ADMIN uniquement */}
                    {isAdmin && u.id !== session?.user.id && (
                      <button
                        onClick={() => handleDelete(u)}
                        className="btn-danger text-xs py-1 px-2"
                      >
                        Supprimer
                      </button>
                    )}
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
