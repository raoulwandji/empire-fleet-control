import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Role } from '@prisma/client';

export class AccessError extends Error {
  status: number;
  constructor(message: string, status = 403) {
    super(message);
    this.status = status;
  }
}

/**
 * Retourne la session ou lève une AccessError 401 si non authentifié.
 * A appeler en tout premier dans chaque handler d'API.
 */
export async function requireSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    throw new AccessError('Non authentifié.', 401);
  }
  return session;
}

/**
 * Lève une AccessError 403 si l'utilisateur n'est pas admin.
 */
export function requireAdmin(role: Role) {
  if (role !== 'ADMIN') {
    throw new AccessError('Action réservée aux administrateurs.', 403);
  }
}

/**
 * Vérifie qu'un employé est affecté au chauffeur visé avant toute écriture.
 * Un admin passe toujours. Un employé non affecté est rejeté côté serveur,
 * quelle que soit l'UI — c'est le verrou réel demandé par le cahier des charges.
 */
export async function requireDriverWriteAccess(
  userId: string,
  role: Role,
  driverId: string
) {
  if (role === 'ADMIN') return;

  const assignment = await prisma.assignment.findUnique({
    where: { employeeId_driverId: { employeeId: userId, driverId } },
  });

  if (!assignment) {
    throw new AccessError(
      "Vous n'êtes pas affecté à ce chauffeur. Action refusée.",
      403
    );
  }
}

export function handleAccessError(err: unknown) {
  if (err instanceof AccessError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  console.error(err);
  return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 });
}

export async function logAudit(
  userId: string,
  action: string,
  entity: string,
  entityId?: string,
  details?: Record<string, unknown>
) {
  await prisma.auditLog.create({
    data: { userId, action, entity, entityId, details: details as any },
  });
}
