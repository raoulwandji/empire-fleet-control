import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  requireSession,
  requireDriverWriteAccess,
  handleAccessError,
  logAudit,
} from '@/lib/access';
import { driverUpdateSchema } from '@/lib/validation';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireSession();

    const driver = await prisma.driver.findUnique({
      where: { id: params.id },
      include: {
        assignments: { include: { employee: { select: { id: true, fullName: true } } } },
        payments: {
          include: { enteredBy: { select: { fullName: true, username: true } } },
          orderBy: { date: 'desc' },
        },
        cautionMovements: {
          include: { enteredBy: { select: { fullName: true, username: true } } },
          orderBy: { date: 'desc' },
        },
        walletMovements: {
          include: { enteredBy: { select: { fullName: true, username: true } } },
          orderBy: { date: 'desc' },
        },
        weeklyTrackings: {
          include: { enteredBy: { select: { fullName: true, username: true } } },
          orderBy: { weekStartDate: 'desc' },
        },
        comments: {
          include: { author: { select: { fullName: true, username: true } } },
          orderBy: { date: 'desc' },
        },
      },
    });

    if (!driver) {
      return NextResponse.json({ error: 'Chauffeur introuvable.' }, { status: 404 });
    }

    const totalPaid = driver.payments.reduce((sum, p) => sum + Number(p.amount), 0);
    const appliedPenalties = driver.weeklyTrackings
      .filter((w) => w.penaltyApplied)
      .reduce((sum, w) => sum + Number(w.computedPenalty), 0);
    const pendingPenalties = driver.weeklyTrackings
      .filter((w) => !w.penaltyApplied)
      .reduce((sum, w) => sum + Number(w.computedPenalty), 0);
    const totalComputedPenalties = appliedPenalties + pendingPenalties;

    // Solde caution : calculé pour les deux types de contrat.
    const cautionBalance = driver.cautionMovements.reduce((sum, m) => sum + Number(m.amount), 0);

    // Solde portefeuille (CV uniquement) : réserve de trésorerie courante, indépendante
    // de l'avance/caution — n'affecte jamais le reste à verser.
    const walletBalance = driver.walletMovements.reduce((sum, m) => sum + Number(m.amount), 0);

    // En Condition-Vente, la caution est une avance de remboursement :
    // elle s'ajoute au total versé et se déduit du reste à verser.
    // Les pénalités/sanctions ne sont plus soustraites automatiquement (déduction gérée en interne) :
    // elles restent affichées à titre purement informatif (appliedPenalties / pendingPenalties).
    const isCV = driver.contractType === 'CONDITION_VENTE';
    const cautionAdvance = isCV ? cautionBalance : 0;
    const totalPaidWithAdvance = totalPaid + cautionAdvance;
    const resteAPayer = isCV
      ? Number(driver.totalPriceFixed ?? 0) - totalPaidWithAdvance
      : null;

    return NextResponse.json({
      ...driver,
      summary: {
        totalPaid,
        cautionAdvance,
        totalPaidWithAdvance,
        appliedPenalties,
        pendingPenalties,
        totalComputedPenalties,
        resteAPayer,
        cautionBalance,
        walletBalance,
      },
    });
  } catch (err) {
    return handleAccessError(err);
  }
}

// PATCH — admin, ou employe affecte a ce chauffeur (modifie le profil)
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    await requireDriverWriteAccess(session.user.id, session.user.role, params.id);

    const body = await req.json();
    const data = driverUpdateSchema.parse(body);

    const driver = await prisma.driver.update({
      where: { id: params.id },
      data: {
        ...data,
        vehicleInService: data.vehicleInService ? new Date(data.vehicleInService) : undefined,
      },
    });

    await logAudit(session.user.id, 'UPDATE_DRIVER', 'Driver', driver.id, data);

    return NextResponse.json(driver);
  } catch (err) {
    return handleAccessError(err);
  }
}

// DELETE — admin, ou employe affecte a ce chauffeur
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    await requireDriverWriteAccess(session.user.id, session.user.role, params.id);

    await prisma.driver.delete({ where: { id: params.id } });
    await logAudit(session.user.id, 'DELETE_DRIVER', 'Driver', params.id);

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleAccessError(err);
  }
}
