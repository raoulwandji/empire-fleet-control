'use client';

import { useEffect, useState, useCallback } from 'react';

type Assignment = {
  id: string;
  employee: { id: string; fullName: string };
  driver: { id: string; fullName: string; code: string };
};
type SimpleUser = { id: string; fullName: string; role: string };
type SimpleDriver = { id: string; fullName: string; code: string };

// Affectation employé ↔ chauffeur — sous-section de la cellule Paramètres.
export default function AssignmentsManager() {
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

  useEffect(() => { fetchAll(); }, [fetchAll]);

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

  return (
    <div className="space-y-4">
      <form onSubmit={handleCreate} className="card p-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="hud-label">Employé</label>
          <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className="form-select w-56" required>
            <option value="">— Choisir —</option>
            {employees.map((e) => <option key={e.id} value={e.id}>{e.fullName}</option>)}
          </select>
        </div>
        <div>
          <label className="hud-label">Chauffeur</label>
          <select value={driverId} onChange={(e) => setDriverId(e.target.value)} className="form-select w-64" required>
            <option value="">— Choisir —</option>
            {drivers.map((d) => <option key={d.id} value={d.id}>{d.code} — {d.fullName}</option>)}
          </select>
        </div>
        <button type="submit" className="btn-primary">Affecter</button>
        {error && <p className="text-sm text-empire-rouge font-bold w-full">{error}</p>}
      </form>

      <div className="card overflow-x-auto">
        <table className="hud-table">
          <thead><tr><th>Employé</th><th>Chauffeur</th><th></th></tr></thead>
          <tbody>
            {assignments.length === 0 ? (
              <tr><td colSpan={3} className="text-center italic text-gray-500 py-6">Aucune affectation.</td></tr>
            ) : assignments.map((a) => (
              <tr key={a.id}>
                <td className="font-semibold text-gray-800">{a.employee.fullName}</td>
                <td className="font-mono text-hud-cyan text-sm">{a.driver.code} — {a.driver.fullName}</td>
                <td><button onClick={() => handleDelete(a.id)} className="btn-danger text-xs py-1 px-2">Retirer</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
