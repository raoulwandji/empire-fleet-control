'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import AvatarUploader from './AvatarUploader';

const links = [
  { href: '/dashboard', label: 'Tableau de bord' },
  { href: '/drivers', label: 'Chauffeurs' },
  { href: '/pending-drivers', label: 'En attente' },
  { href: '/users', label: 'Utilisateurs', managerOnly: true },
  { href: '/assignments', label: 'Affectations', managerOnly: true },
];

function roleLabel(role?: string) {
  if (role === 'ADMIN') return 'Admin';
  if (role === 'MANAGER') return 'Gestionnaire';
  return 'Employé';
}

export default function Navbar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const role = session?.user.role;
  const isAdminOrManager = role === 'ADMIN' || role === 'MANAGER';

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!session?.user) return;
    fetch('/api/profile')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => data && setAvatarUrl(data.avatarUrl ?? null));
  }, [session?.user]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  return (
    <nav className="sticky top-0 z-50 bg-hud-panel/80 backdrop-blur-md border-b border-hud-cyan/20 px-4 py-3 flex items-center justify-between flex-wrap gap-2">
      <div className="flex items-center gap-6 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="relative w-9 h-9 rounded-lg overflow-hidden ring-1 ring-hud-cyan/50 shadow-neon">
            <Image src="/logo.jpg" alt="Yango Empire Drive" fill className="object-cover" />
          </div>
          <span className="font-display font-bold tracking-widest text-sm text-transparent bg-clip-text bg-gradient-to-r from-hud-cyan to-empire-rougeVif">
            EMPIRE-FLEET CONTROL
          </span>
        </div>
        <div className="flex gap-1 flex-wrap text-sm font-medium">
          {links
            .filter((l) => !l.managerOnly || isAdminOrManager)
            .map((l) => {
              const active = pathname?.startsWith(l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={clsx(
                    'px-3 py-1.5 rounded-lg transition-all duration-150 border',
                    active
                      ? 'border-hud-cyan/50 text-hud-cyan bg-hud-cyan/10 shadow-neon'
                      : 'border-transparent text-gray-400 hover:text-gray-100 hover:border-hud-line'
                  )}
                >
                  {l.label}
                </Link>
              );
            })}
        </div>
      </div>
      <div className="flex items-center gap-3 text-sm relative" ref={menuRef}>
        <button onClick={() => setMenuOpen((v) => !v)} className="flex items-center gap-2">
          <AvatarUploader fullName={session?.user.name ?? '?'} avatarUrl={avatarUrl} size={32} />
          <span className="text-gray-400 hidden sm:inline">
            {session?.user.name}{' '}
            <span className={clsx(
              'font-semibold',
              role === 'ADMIN' ? 'text-empire-rougeVif' : role === 'MANAGER' ? 'text-yellow-400' : 'text-hud-cyan'
            )}>
              ({roleLabel(role)})
            </span>
          </span>
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-full mt-2 card p-4 w-64 z-50 space-y-3">
            <p className="text-xs text-gray-500 uppercase tracking-widest">Photo de profil</p>
            <AvatarUploader
              fullName={session?.user.name ?? '?'}
              avatarUrl={avatarUrl}
              size={56}
              editable
              onUpdated={setAvatarUrl}
            />
            <div className="h-px bg-hud-line" />
            <button onClick={() => signOut({ callbackUrl: '/login' })} className="btn-danger w-full !py-1.5">
              Déconnexion
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
