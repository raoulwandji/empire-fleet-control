'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// La gestion des affectations est désormais une sous-section de la cellule Paramètres.
export default function AssignmentsPageRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/settings?tab=affectations'); }, [router]);
  return null;
}
