'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// La gestion des utilisateurs est désormais une sous-section de la cellule Paramètres.
export default function UsersPageRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/settings?tab=utilisateurs'); }, [router]);
  return null;
}
