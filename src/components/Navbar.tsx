'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import AvatarUploader from './AvatarUploader';
import CredentialsEditor from './CredentialsEditor';

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
  const btnRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!session?.user) return;
    fetch('/api/profile')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => data && setAvatarUrl(data.avatarUrl ?? null));
  }, [session?.user]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        btnRef.current && !btnRef.current.contains(e.target as Node)
      ) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  // Position fixe calculée depuis le bouton (toujours visible à droite de la nav)
  const [dropPos, setDropPos] = useState({ top: 0, right: 16 });
  useEffect(() => {
    if (menuOpen && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setDropPos({
        top: rect.bottom + 8,
        right: Math.max(8, window.innerWidth - rect.right),
      });
    }
  }, [menuOpen]);

  return (
    <nav className="sticky top-0 z-50 bg-hud-panel/80 backdrop-blur-md border-b border-hud-cyan/20 px-4 py-3 flex items-center gap-2">
      {/* Logo — toujours visible */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="relative w-9 h-9 rounded-lg overflow-hidden ring-1 ring-hud-cyan/50 shadow-neon">
          <Image src="/logo.jpg" alt="Yango Empire Drive" fill className="object-cover" />
        </div>
        <span className="font-display font-bold tracking-widest text-sm text-transparent bg-clip-text bg-gradient-to-r from-hud-cyan to-empire-rougeVif whitespace-nowrap hidden sm:inline">
          EMPIRE-FLEET CONTROL
        </span>
      </div>

      {/* Liens de navigation — scrollables si l'écran est étroit */}
      <div className="flex gap-1 text-sm font-medium overflow-x-auto flex-1 min-w-0">
        {links
          .filter((l) => !l.managerOnly || isAdminOrManager)
          .map((l) => {
            const active = pathname?.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={clsx(
                  'px-3 py-1.5 rounded-lg transition-all duration-150 border whitespace-nowrap shrink-0',
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

      {/* Bouton profil — toujours visible à droite */}
      <button
        ref={btnRef}
        onClick={() => setMenuOpen((v) => !v)}
        className="flex items-center gap-2 shrink-0"
      >
        <AvatarUploader fullName={session?.user.name ?? '?'} avatarUrl={avatarUrl} size={32} />
        <span className="text-gray-400 hidden md:inline whitespace-nowrap">
          {session?.user.name}{' '}
          <span className={clsx(
            'font-semibold',
            role === 'ADMIN' ? 'text-empire-rougeVif' : role === 'MANAGER' ? 'text-yellow-400' : 'text-hud-cyan'
          )}>
            ({roleLabel(role)})
          </span>
        </span>
      </button>

      {/* Dropdown profil en position fixe */}
      {menuOpen && (
        <div
          ref={dropdownRef}
          style={{ position: 'fixed', top: dropPos.top, right: dropPos.right }}
          className="card p-4 w-64 z-50 space-y-3"
        >
          <p className="text-xs text-gray-500 uppercase tracking-widest">Photo de profil</p>
          <AvatarUploader
            fullName={session?.user.name ?? '?'}
            avatarUrl={avatarUrl}
            size={56}
            editable
            onUpdated={setAvatarUrl}
          />
          <div className="h-px bg-hud-line" />
          {session?.user.username && <CredentialsEditor username={session.user.username} />}
          <div className="h-px bg-hud-line" />
          <button onClick={() => signOut({ callbackUrl: '/login' })} className="btn-danger w-full !py-1.5">
            Déconnexion
          </button>
        </div>
      )}
    </nav>
  );
}
