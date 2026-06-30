import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  requireSession,
  requireAdmin,
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
        payments: { orderBy: { date: 'desc' } },
        cautionMovements: { orderBy: { date: 'desc' } },
        weeklyTrackings: { orderBy: { weekStartDate: 'desc' } },
        comments: { include: { author: { select: { fullName: true } } }, orderBy: { date: 'desc' } },
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
    const resteAPayer =
      driver.contractType === 'CONDITION_VENTE'
        ? Number(driver.totalPriceFixed ?? 0) - totalPaid + appliedPenalties
        : null;
    const cautionBalance =
      driver.contractType === 'LOCATION'
        ? driver.cautionMovements.reduce((sum, m) => sum + Number(m.amount), 0)
        : null;

    return NextResponse.json({
      ...driver,
      summary: { totalPaid, appliedPenalties, pendingPenalties, totalComputedPenalties, resteAPayer, cautionBalance },
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

// DELETE — reserve a l'admin
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    requireAdmin(session.user.role);

    await prisma.driver.delete({ where: { id: params.id } });
    await logAudit(session.user.id, 'DELETE_DRIVER', 'Driver', params.id);

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleAccessError(err);
  }
}
