'use client';

import { useState } from 'react';
import { signOut } from 'next-auth/react';

export default function CredentialsEditor({ username }: { username: string }) {
  const [open, setOpen] = useState(false);
  const [newUsername, setNewUsername] = useState(username);
  const [newPassword, setNewPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const body: Record<string, string> = { currentPassword };
    if (newUsername && newUsername !== username) body.username = newUsername;
    if (newPassword) body.newPassword = newPassword;

    if (!body.username && !body.newPassword) {
      setError('Modifiez l\'identifiant ou le mot de passe.');
      return;
    }

    setBusy(true);
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Erreur.');
        return;
      }
      // Les identifiants ont changé : reconnexion nécessaire.
      await signOut({ callbackUrl: '/login' });
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn-secondary text-xs py-1 px-2 w-full">
        Modifier identifiant / mot de passe
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <div>
        <label className="hud-label">Identifiant</label>
        <input
          value={newUsername}
          onChange={(e) => setNewUsername(e.target.value)}
          className="form-input w-full text-xs"
        />
      </div>
      <div>
        <label className="hud-label">Nouveau mot de passe</label>
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="Laisser vide pour ne pas changer"
          className="form-input w-full text-xs"
        />
      </div>
      <div>
        <label className="hud-label">Mot de passe actuel</label>
        <input
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          required
          className="form-input w-full text-xs"
        />
      </div>
      {error && <p className="text-xs text-empire-rougeVif">{error}</p>}
      <div className="flex gap-1.5">
        <button type="submit" disabled={busy} className="btn-primary text-xs py-1 px-2 disabled:opacity-40">
          {busy ? '...' : 'Enregistrer'}
        </button>
        <button
          type="button"
          onClick={() => { setOpen(false); setError(''); setCurrentPassword(''); setNewPassword(''); setNewUsername(username); }}
          className="btn-secondary text-xs py-1 px-2"
        >
          Annuler
        </button>
      </div>
    </form>
  );
}
