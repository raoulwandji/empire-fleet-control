'use client';

import { useEffect, useState } from 'react';
import type { CapabilityKey } from '@/lib/capabilities';

/**
 * Récupère les capacités effectives de l'utilisateur connecté.
 * `loading` reste vrai jusqu'à la première réponse pour éviter un flash d'accès refusé.
 */
export function useCapabilities() {
  const [caps, setCaps] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.capabilities) setCaps(d.capabilities); })
      .finally(() => setLoading(false));
  }, []);

  return {
    caps,
    loading,
    can: (cap: CapabilityKey) => !!caps[cap],
  };
}
