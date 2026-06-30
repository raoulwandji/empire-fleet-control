'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import Navbar from '@/components/Navbar';

type User = {
  id: string;
  username: string;
  fullName: string;
  role: 'ADMIN' | 'EMPLOYEE';
  active: boolean;
};

export default function UsersPage() {
  const { data: session } = useSession();
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ username: '', password: '', fullName: '', role: 'EMPLOYEE' as 'ADMIN' | 'EMPLOYEE' });

  const fetchUsers = useCallback(async () => {
    const res = await fetch('/api/users');
    if (res.ok) setUsers(await res.json());
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

  if (session && session.user.role !== 'ADMIN') {
    return (
      <div>
        <Navbar />
        <div className="p-6">Accès réservé aux administrateurs.</div>
      </div>
    );
  }

  return (
    <div>
      <Navbar />
      <div className="p-6 max-w-4xl mx-auto">
        <h1 className="text-xl font-bold mb-4">Gestion des utilisateurs</h1>

        <form onSubmit={handleCreate} className="bg-white rounded shadow p-4 mb-6 flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-gray-500">Identifiant</label>
            <input
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              className="border rounded px-2 py-1 text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500">Mot de passe</label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="border rounded px-2 py-1 text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500">Nom complet</label>
            <input
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              className="border rounded px-2 py-1 text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500">Rôle</label>
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as 'ADMIN' | 'EMPLOYEE' })}
              className="border rounded px-2 py-1 text-sm"
            >
              <option value="EMPLOYEE">Employé</option>
              <option value="ADMIN">Administrateur</option>
            </select>
          </div>
          <button type="submit" className="bg-empire-rouge text-white px-4 py-1.5 rounded text-sm">
            Créer
          </button>
          {error && <p className="text-sm text-red-600 w-full">{error}</p>}
        </form>

        <div className="bg-white rounded shadow overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 text-left">
              <tr>
                <th className="p-2">Identifiant</th>
                <th className="p-2">Nom</th>
                <th className="p-2">Rôle</th>
                <th className="p-2">Statut</th>
                <th className="p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t">
                  <td className="p-2">{u.username}</td>
                  <td className="p-2">{u.fullName}</td>
                  <td className="p-2">{u.role === 'ADMIN' ? 'Administrateur' : 'Employé'}</td>
                  <td className="p-2">
                    <span className={u.active ? 'text-green-600' : 'text-gray-400'}>
                      {u.active ? 'Actif' : 'Désactivé'}
                    </span>
                  </td>
                  <td className="p-2 flex gap-2">
                    <button onClick={() => toggleActive(u)} className="text-xs border rounded px-2 py-0.5 hover:bg-gray-50">
                      {u.active ? 'Désactiver' : 'Activer'}
                    </button>
                    <button onClick={() => handleDelete(u)} className="text-xs border rounded px-2 py-0.5 text-red-600 hover:bg-red-50">
                      Supprimer
                    </button>
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
