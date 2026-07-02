/**
 * Rate limiter en mémoire pour les tentatives de connexion.
 * 5 échecs par identifiant sur 15 min → blocage 15 min.
 * (En serverless, chaque instance a son propre compteur — protection
 * best-effort suffisante contre le brute-force simple.)
 */
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;

const attempts = new Map<string, { count: number; firstAt: number }>();

export function isBlocked(key: string): boolean {
  const entry = attempts.get(key);
  if (!entry) return false;
  if (Date.now() - entry.firstAt > WINDOW_MS) {
    attempts.delete(key);
    return false;
  }
  return entry.count >= MAX_FAILURES;
}

export function recordFailure(key: string): void {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || now - entry.firstAt > WINDOW_MS) {
    attempts.set(key, { count: 1, firstAt: now });
  } else {
    entry.count += 1;
  }
}

export function clearFailures(key: string): void {
  attempts.delete(key);
}
