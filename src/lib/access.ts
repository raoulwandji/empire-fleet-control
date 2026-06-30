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
 */
export async function requireSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    throw new AccessError('Non authentifié.', 401);
  }
  return session;
}

/**
 * Passe pour ADMIN et MANAGER. Bloque EMPLOYEE.
 */
export function requireAdminOrManager(role: Role) {
  if (role !== 'ADMIN' && role !== 'MANAGER') {
    throw new AccessError('Action réservée aux administrateurs et gestionnaires.', 403);
  }
}

/**
 * Passe uniquement pour ADMIN (pour les actions destructives sur les comptes).
 */
export function requireAdmin(role: Role) {
  if (role !== 'ADMIN') {
    throw new AccessError('Action réservée aux administrateurs.', 403);
  }
}

/**
 * Vérifie qu'un employé est affecté au chauffeur visé avant toute écriture.
 * ADMIN et MANAGER passent toujours.
 */
export async function requireDriverWriteAccess(
  userId: string,
  role: Role,
  driverId: string
) {
  if (role === 'ADMIN' || role === 'MANAGER') return;

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
