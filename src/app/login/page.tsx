'use client';

import { useState } from 'react';
import Image from 'next/image';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const res = await signIn('credentials', { username, password, redirect: false });
    setLoading(false);
    if (res?.error) { setError('Identifiant ou mot de passe incorrect.'); return; }
    router.push('/dashboard');
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden">
      {/* Décorations de fond */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-hud-cyan/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-empire-rouge/10 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-sm relative">
        {/* Coins décoratifs HUD */}
        <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-hud-cyan/70" />
        <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-hud-cyan/70" />
        <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-hud-cyan/70" />
        <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-hud-cyan/70" />

        <div className="card p-8 space-y-6">
          {/* Logo + Titre */}
          <div className="flex flex-col items-center gap-4">
            <div className="relative w-40 h-40 rounded-2xl overflow-hidden ring-2 ring-hud-cyan/50 shadow-neon">
              <Image src="/logo.jpg" alt="Yango Empire Drive" fill className="object-cover" priority />
            </div>
            <div className="text-center space-y-1">
              <h1 className="font-display font-black text-2xl tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-hud-cyan via-white to-empire-rougeVif">
                EMPIRE-FLEET
              </h1>
              <h2 className="font-display font-black text-2xl tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-empire-rougeVif via-white to-hud-cyan">
                CONTROL
              </h2>
              <p className="text-xs text-gray-500 tracking-widest uppercase pt-1">
                Gestion de flotte YANGO
              </p>
            </div>
          </div>

          {/* Séparateur néon */}
          <div className="h-px bg-gradient-to-r from-transparent via-hud-cyan/50 to-transparent" />

          {/* Formulaire */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="hud-label">Identifiant</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="hud-input"
                placeholder="Votre identifiant"
                required
                autoFocus
              />
            </div>
            <div>
              <label className="hud-label">Mot de passe</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="hud-input"
                placeholder="••••••••"
                required
              />
            </div>

            {error && (
              <div className="text-xs text-empire-rougeVif border border-empire-rouge/30 bg-empire-rouge/10 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full py-3 font-display tracking-widest">
              {loading ? '⟳  CONNEXION...' : '→  SE CONNECTER'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
