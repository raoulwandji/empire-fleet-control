import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Role } from '@prisma/client';
import { hasCapability, type CapabilityKey } from '@/lib/capabilities';

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

/**
 * Vérifie que l'utilisateur possède une capacité (défaut du rôle ou surcharge admin).
 * ADMIN passe toujours. Fait une lecture des capacités en base.
 */
export async function requireCapability(userId: string, role: Role, cap: CapabilityKey) {
  if (role === 'ADMIN') return;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { capabilities: true },
  });
  if (!user || !hasCapability(role, user.capabilities, cap)) {
    throw new AccessError('Cette capacité n\'est pas autorisée pour votre compte.', 403);
  }
}

/**
 * Vérifie que l'utilisateur gère la structure (business unit) visée.
 * ADMIN passe toujours, sans affectation nécessaire.
 */
export async function requireStructureAccess(userId: string, role: Role, businessUnit: string) {
  if (role === 'ADMIN') return;
  const assignment = await prisma.structureAssignment.findUnique({
    where: { userId_businessUnit: { userId, businessUnit: businessUnit as any } },
  });
  if (!assignment) {
    throw new AccessError("Vous n'êtes pas affecté à cette structure.", 403);
  }
}

const FIVE_HOURS_MS = 5 * 60 * 60 * 1000;

/**
 * Fenêtre de modification/suppression pour les données saisies par un gestionnaire
 * sur une structure (Empire Group) : 5 heures après la création. Passé ce délai,
 * seul l'ADMIN peut encore modifier ou supprimer. L'ADMIN n'a jamais de délai.
 * Si businessUnit est null (écriture générale, non liée à une structure), ne
 * s'applique pas ici — la capacité 'accounting_delete' gère ce cas.
 */
export async function requireStructureWriteWindow(
  userId: string,
  role: Role,
  businessUnit: string | null,
  createdAt: Date
) {
  if (role === 'ADMIN') return;
  if (!businessUnit) return;
  await requireStructureAccess(userId, role, businessUnit);
  if (Date.now() - createdAt.getTime() > FIVE_HOURS_MS) {
    throw new AccessError(
      'Le délai de modification de 5 heures est dépassé pour cette structure. Contactez un administrateur.',
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
