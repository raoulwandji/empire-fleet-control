import { Role } from '@prisma/client';

/**
 * Capacités granulaires. Chaque clé correspond à une zone fonctionnelle
 * réellement protégée côté serveur ET côté navigation.
 * L'administrateur peut, par utilisateur, accorder ou révoquer chaque capacité
 * (surcharge des valeurs par défaut du rôle).
 */
export const CAPABILITIES = [
  { key: 'owners', label: 'Propriétaires', desc: 'Créer et gérer les propriétaires' },
  { key: 'reports', label: 'Rapports', desc: 'Consulter et exporter les rapports propriétaires' },
  { key: 'assignments', label: 'Affectations', desc: 'Affecter des chauffeurs aux employés' },
  { key: 'users_manage', label: 'Gérer les utilisateurs', desc: 'Créer et modifier des comptes (hors rôle)' },
  { key: 'accounting_delete', label: 'Supprimer en comptabilité', desc: 'Supprimer des écritures comptables' },
] as const;

export type CapabilityKey = (typeof CAPABILITIES)[number]['key'];

const ALL_TRUE: Record<CapabilityKey, boolean> = {
  owners: true, reports: true, assignments: true, users_manage: true, accounting_delete: true,
};
const ALL_FALSE: Record<CapabilityKey, boolean> = {
  owners: false, reports: false, assignments: false, users_manage: false, accounting_delete: false,
};

const ROLE_DEFAULTS: Record<Role, Record<CapabilityKey, boolean>> = {
  ADMIN: { ...ALL_TRUE },
  MANAGER: { ...ALL_TRUE },
  EMPLOYEE: { ...ALL_FALSE },
};

/**
 * Calcule les capacités effectives : défauts du rôle + surcharges par utilisateur.
 * L'ADMIN conserve toujours toutes les capacités (protection anti-verrouillage).
 */
export function resolveCapabilities(role: Role, overrides: unknown): Record<CapabilityKey, boolean> {
  const base = { ...ROLE_DEFAULTS[role] };
  if (role === 'ADMIN') return base;
  if (overrides && typeof overrides === 'object') {
    const o = overrides as Record<string, unknown>;
    for (const { key } of CAPABILITIES) {
      if (typeof o[key] === 'boolean') base[key] = o[key] as boolean;
    }
  }
  return base;
}

export function hasCapability(role: Role, overrides: unknown, cap: CapabilityKey): boolean {
  return resolveCapabilities(role, overrides)[cap];
}
