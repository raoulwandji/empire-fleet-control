'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import Navbar from '@/components/Navbar';
import { useCapabilities } from '@/lib/useCapabilities';

type Assignment = {
  id: string;
  employee: { id: string; fullName: string };
  driver: { id: string; fullName: string; code: string };
};
type SimpleUser = { id: string; fullName: string; role: string };
type SimpleDriver = { id: string; fullName: string; code: string };

export default function AssignmentsPage() {
  const { data: session } = useSession();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [employees, setEmployees] = useState<SimpleUser[]>([]);
  const [drivers, setDrivers] = useState<SimpleDriver[]>([]);
  const [employeeId, setEmployeeId] = useState('');
  const [driverId, setDriverId] = useState('');
  const [error, setError] = useState('');

  const fetchAll = useCallback(async () => {
    const [aRes, uRes, dRes] = await Promise.all([
      fetch('/api/assignments'),
      fetch('/api/users'),
      fetch('/api/drivers'),
    ]);
    if (aRes.ok) setAssignments(await aRes.json());
    if (uRes.ok) {
      const users: SimpleUser[] = await uRes.json();
      setEmployees(users.filter((u) => u.role === 'EMPLOYEE'));
    }
    if (dRes.ok) setDrivers(await dRes.json());
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const res = await fetch('/api/assignments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeId, driverId }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? 'Erreur.');
      return;
    }
    setEmployeeId('');
    setDriverId('');
    fetchAll();
  }

  async function handleDelete(id: string) {
    if (!confirm('Retirer cette affectation ?')) return;
    await fetch(`/api/assignments/${id}`, { method: 'DELETE' });
    fetchAll();
  }

  const { caps, loading: capsLoading } = useCapabilities();
  const canAccess = !!caps.assignments;

  if (session && !capsLoading && !canAccess) {
    return (
      <div>
        <Navbar />
        <div className="p-6">Accès réservé aux administrateurs et gestionnaires.</div>
      </div>
    );
  }

  return (
    <div>
      <Navbar />
      <div className="p-6 max-w-3xl mx-auto">
        <h1 className="text-xl font-bold mb-4">Affectations employé ↔ chauffeur</h1>

        <form onSubmit={handleCreate} className="bg-white rounded shadow p-4 mb-6 flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-gray-500">Employé</label>
            <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className="border rounded px-2 py-1 text-sm" required>
              <option value="">— Choisir —</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.fullName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500">Chauffeur</label>
            <select value={driverId} onChange={(e) => setDriverId(e.target.value)} className="border rounded px-2 py-1 text-sm" required>
              <option value="">— Choisir —</option>
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.code} — {d.fullName}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="bg-empire-rouge text-white px-4 py-1.5 rounded text-sm">
            Affecter
          </button>
          {error && <p className="text-sm text-red-600 w-full">{error}</p>}
        </form>

        <div className="bg-white rounded shadow overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 text-left">
              <tr>
                <th className="p-2">Employé</th>
                <th className="p-2">Chauffeur</th>
                <th className="p-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {assignments.map((a) => (
                <tr key={a.id} className="border-t">
                  <td className="p-2">{a.employee.fullName}</td>
                  <td className="p-2">
                    {a.driver.code} — {a.driver.fullName}
                  </td>
                  <td className="p-2">
                    <button onClick={() => handleDelete(a.id)} className="text-xs border rounded px-2 py-0.5 text-red-600 hover:bg-red-50">
                      Retirer
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
