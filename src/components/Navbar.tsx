'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import AvatarUploader from './AvatarUploader';
import CredentialsEditor from './CredentialsEditor';

const links = [
  { href: '/dashboard', label: 'Accueil' },
  { href: '/drivers', label: 'Chauffeurs' },
  { href: '/pending-drivers', label: 'En attente' },
  { href: '/owners', label: 'Propriétaires', managerOnly: true },
  { href: '/reports', label: 'Rapports', managerOnly: true },
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
  const router = useRouter();
  const { data: session } = useSession();
  const role = session?.user.role;
  const isAdminOrManager = role === 'ADMIN' || role === 'MANAGER';

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const btnRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Clé localStorage par utilisateur pour la date de dernière lecture
  const storageKey = session?.user.id ? `chat_last_read_${session.user.id}` : null;

  // Marque le chat comme lu quand on est sur la page /chat
  useEffect(() => {
    if (pathname?.startsWith('/chat') && storageKey) {
      localStorage.setItem(storageKey, new Date().toISOString());
      setUnreadCount(0);
    }
  }, [pathname, storageKey]);

  // Polling des messages non lus toutes les 15s
  useEffect(() => {
    if (!session?.user || !storageKey) return;
    function checkUnread() {
      const lastRead = localStorage.getItem(storageKey!) ?? new Date(0).toISOString();
      fetch(`/api/chat?since=${encodeURIComponent(lastRead)}`)
        .then((r) => r.ok ? r.json() : { count: 0 })
        .then((data) => {
          if (!pathname?.startsWith('/chat')) {
            setUnreadCount(data.count ?? 0);
          }
        });
    }
    checkUnread();
    const id = setInterval(checkUnread, 15_000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user, storageKey]);

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
    <nav className="sticky top-0 z-50 bg-yango-dark/95 backdrop-blur-md border-b border-yango-line px-4 py-2.5 flex items-center gap-2">
      {/* Logo */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="relative w-8 h-8 rounded-xl overflow-hidden ring-2 ring-yango-yellow/60">
          <Image src="/logo.jpg" alt="Yango Empire Drive" fill className="object-cover" />
        </div>
        <span className="font-display font-black tracking-tight text-sm text-yango-yellow whitespace-nowrap hidden sm:inline">
          EMPIRE-FLEET
        </span>
      </div>

      {/* Liens */}
      <div className="flex gap-0.5 text-sm font-medium overflow-x-auto flex-1 min-w-0">
        {links
          .filter((l) => !l.managerOnly || isAdminOrManager)
          .map((l) => {
            const active = pathname?.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={clsx(
                  'px-3 py-1.5 rounded-lg transition-all duration-150 whitespace-nowrap shrink-0 font-semibold',
                  active
                    ? 'bg-yango-yellow text-yango-black'
                    : 'text-yango-muted hover:text-yango-text hover:bg-yango-card'
                )}
              >
                {l.label}
              </Link>
            );
          })}
      </div>

      {/* Bouton Chat */}
      <button
        onClick={() => router.push('/chat')}
        title="Chat"
        className={clsx(
          'shrink-0 relative w-8 h-8 rounded-xl flex items-center justify-center transition-all',
          pathname?.startsWith('/chat')
            ? 'bg-yango-yellow text-yango-black'
            : 'bg-yango-card text-yango-muted hover:text-yango-yellow'
        )}
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
          <path fillRule="evenodd" d="M2 5a2 2 0 012-2h12a2 2 0 012 2v7a2 2 0 01-2 2H6l-4 4V5z" clipRule="evenodd" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-0.5 rounded-full bg-empire-rougeVif text-white text-[10px] font-bold flex items-center justify-center leading-none">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Bouton profil — toujours visible à droite */}
      <button
        ref={btnRef}
        onClick={() => setMenuOpen((v) => !v)}
        className="flex items-center gap-2 shrink-0"
      >
        <AvatarUploader fullName={session?.user.name ?? '?'} avatarUrl={avatarUrl} size={32} />
        <span className="text-yango-muted hidden md:inline whitespace-nowrap text-sm">
          {session?.user.name}{' '}
          <span className={clsx(
            'font-bold',
            role === 'ADMIN' ? 'text-yango-yellow' : role === 'MANAGER' ? 'text-yango-yellow/80' : 'text-yango-muted'
          )}>
            ({roleLabel(role)})
          </span>
        </span>
      </button>

      {/* Dropdown profil */}
      {menuOpen && (
        <div
          ref={dropdownRef}
          style={{ position: 'fixed', top: dropPos.top, right: dropPos.right }}
          className="card p-4 w-64 z-50 space-y-3"
        >
          <p className="text-xs text-yango-muted uppercase tracking-widest font-bold">Photo de profil</p>
          <AvatarUploader
            fullName={session?.user.name ?? '?'}
            avatarUrl={avatarUrl}
            size={56}
            editable
            onUpdated={setAvatarUrl}
          />
          <div className="h-px bg-yango-line" />
          {session?.user.username && <CredentialsEditor username={session.user.username} />}
          <div className="h-px bg-yango-line" />
          <button onClick={() => signOut({ callbackUrl: '/login' })} className="btn-danger w-full !py-1.5">
            Déconnexion
          </button>
        </div>
      )}
    </nav>
  );
}
