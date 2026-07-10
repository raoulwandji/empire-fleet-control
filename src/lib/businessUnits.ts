// Configuration centrale des structures du groupe Empire, gérées depuis la cellule Comptabilité.
export const BUSINESS_UNITS = [
  {
    key: 'EMPIRE_ASSURANCE',
    label: 'Empire Assurance',
    hasStock: true,
    stockLabel: 'Attestation',
    services: [] as string[],
  },
  {
    key: 'AUTO_ECOLE_EMPIRE',
    label: 'Auto École Empire',
    hasStock: true,
    stockLabel: 'Manuel',
    services: ['Formation', 'Recyclage', "Frais d'inscription", 'Perfectionnement'],
  },
  {
    key: 'EMPIRE_LANGUAGE_ACADEMY',
    label: 'Empire Language Academy',
    hasStock: true,
    stockLabel: 'Manuel',
    services: ['Frais de formation', 'Inscription', 'Test de niveau', 'Frais de formation en ligne'],
  },
  {
    key: 'EMPIRE_TRAVEL',
    label: 'Empire Travel',
    hasStock: false,
    stockLabel: null,
    services: ['Frais de procédure', "Frais d'enregistrement", 'Autre'],
  },
  {
    key: 'EMPIRE_DRIVE',
    label: 'Empire Drive',
    hasStock: false,
    stockLabel: null,
    services: ['Caution chauffeur'],
  },
  {
    key: 'EMPIRE_SECURE',
    label: 'Empire Secure',
    hasStock: true,
    stockLabel: 'Kit GPS',
    services: ["Frais d'installation", 'Frais de réparation'],
  },
] as const;

export type BusinessUnitKey = (typeof BUSINESS_UNITS)[number]['key'];

export function getBusinessUnitConfig(key: string) {
  return BUSINESS_UNITS.find((u) => u.key === key) ?? null;
}

export function businessUnitLabel(key?: string | null): string {
  if (!key) return 'Général (hors structure)';
  return getBusinessUnitConfig(key)?.label ?? key;
}
