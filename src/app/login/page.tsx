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
    <div className="min-h-screen bg-yango-black flex">
      {/* Panneau gauche — branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-yango-yellow flex-col items-center justify-center p-12 relative overflow-hidden">
        {/* Cercles décoratifs */}
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-black/10" />
        <div className="absolute -bottom-32 -right-32 w-[28rem] h-[28rem] rounded-full bg-black/10" />

        <div className="relative z-10 flex flex-col items-center gap-8 text-center">
          <div className="relative w-36 h-36 rounded-3xl overflow-hidden shadow-2xl ring-4 ring-black/20">
            <Image src="/logo.jpg" alt="Empire Drive" fill className="object-cover" priority />
          </div>
          <div>
            <h1 className="text-5xl font-black text-yango-black tracking-tight leading-none">
              EMPIRE
            </h1>
            <h2 className="text-5xl font-black text-yango-black tracking-tight leading-none">
              FLEET
            </h2>
            <div className="mt-3 h-1 w-16 bg-black/30 rounded-full mx-auto" />
            <p className="mt-4 text-yango-black/70 font-semibold text-lg">
              Partenaire Yango
            </p>
          </div>
          <div className="grid grid-cols-3 gap-4 mt-4 w-full max-w-xs">
            {['Chauffeurs', 'Versements', 'Rapports'].map((label) => (
              <div key={label} className="bg-black/10 rounded-2xl px-3 py-4 text-center">
                <p className="text-yango-black font-bold text-xs uppercase tracking-wider">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Panneau droit — formulaire */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        {/* Logo mobile */}
        <div className="flex flex-col items-center gap-4 mb-10 lg:hidden">
          <div className="relative w-24 h-24 rounded-2xl overflow-hidden ring-2 ring-yango-yellow/50">
            <Image src="/logo.jpg" alt="Empire Drive" fill className="object-cover" priority />
          </div>
          <div className="text-center">
            <h1 className="text-3xl font-black text-yango-yellow tracking-tight">EMPIRE FLEET</h1>
            <p className="text-yango-muted text-sm mt-1">Partenaire Yango</p>
          </div>
        </div>

        <div className="w-full max-w-sm space-y-8">
          <div>
            <h2 className="text-3xl font-black text-yango-text">Connexion</h2>
            <p className="text-yango-muted mt-2 text-sm">Accédez à votre espace de gestion de flotte.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-bold text-yango-muted mb-2 uppercase tracking-wider">
                Identifiant
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-yango-card border border-yango-line rounded-xl px-4 py-3.5 text-yango-text
                           text-sm focus:outline-none focus:border-yango-yellow focus:ring-2 focus:ring-yango-yellow/20
                           transition-all placeholder:text-yango-muted"
                placeholder="Votre identifiant"
                required
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-yango-muted mb-2 uppercase tracking-wider">
                Mot de passe
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-yango-card border border-yango-line rounded-xl px-4 py-3.5 text-yango-text
                           text-sm focus:outline-none focus:border-yango-yellow focus:ring-2 focus:ring-yango-yellow/20
                           transition-all placeholder:text-yango-muted"
                placeholder="••••••••"
                required
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-red-400 bg-red-950/40 border border-red-800/50 rounded-xl px-4 py-3">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-yango-yellow text-yango-black font-black text-base py-3.5 rounded-xl
                         hover:bg-yango-yellowDark transition-all duration-200
                         disabled:opacity-50 disabled:cursor-not-allowed
                         shadow-neon flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  Connexion...
                </>
              ) : (
                'Se connecter'
              )}
            </button>
          </form>

          <p className="text-center text-xs text-yango-muted">
            EMPIRE-FLEET CONTROL — Gestion de flotte Yango
          </p>
        </div>
      </div>
    </div>
  );
}
