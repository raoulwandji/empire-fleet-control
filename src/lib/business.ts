/**
 * Jours de versement/loyer attendus : Lundi, Mercredi, Jeudi, Vendredi, Samedi.
 * Jours de repos (anomalie si saisie) : Mardi (repos véhicule) et Dimanche (jour du chauffeur).
 * getDay(): 0=dimanche, 1=lundi, 2=mardi, 3=mercredi, 4=jeudi, 5=vendredi, 6=samedi
 */
export function isUnusualPaymentDay(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 2;
}

/** Lundi de la semaine ISO contenant `date`, à minuit. */
export function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day; // recule jusqu'au lundi
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Dimanche (fin) de la semaine débutant à `weekStart` (lundi), à minuit. */
export function getWeekEnd(weekStart: Date): Date {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + 6);
  return d;
}

/** "22/06/2026 — 28/06/2026" */
export function formatWeekRange(weekStart: Date | string): string {
  const start = new Date(weekStart);
  const end = getWeekEnd(start);
  return `${start.toLocaleDateString('fr-FR')} — ${end.toLocaleDateString('fr-FR')}`;
}

/** Pénalité calculée sur les heures manquantes uniquement, jamais négative. */
export function computePenalty(
  hoursWorked: number,
  hourTarget: number,
  hourlyPenaltyRate: number
): number {
  const missing = hourTarget - hoursWorked;
  if (missing <= 0) return 0;
  return Math.round(missing * hourlyPenaltyRate * 100) / 100;
}

export function formatFCFA(amount: number | string): string {
  const n = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(n) + ' FCFA';
}
