import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession, requireDriverWriteAccess, handleAccessError, logAudit } from '@/lib/access';
import { computePenalty } from '@/lib/business';
import { z } from 'zod';

const weeklyTrackingUpdateSchema = z.object({
  hoursWorked: z.number().nonnegative(),
  ridesCompleted: z.number().int().nonnegative(),
});

// PATCH /api/weekly/[id] — corriger une saisie manuelle (heures/courses).
// Verrouillé une fois la pénalité appliquée, pour préserver l'intégrité du mouvement déjà comptabilisé.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();

    const tracking = await prisma.weeklyTracking.findUnique({ where: { id: params.id }, include: { driver: true } });
    if (!tracking) {
      return NextResponse.json({ error: 'Suivi hebdomadaire introuvable.' }, { status: 404 });
    }

    await requireDriverWriteAccess(session.user.id, session.user.role, tracking.driverId);

    if (tracking.penaltyApplied) {
      return NextResponse.json(
        { error: 'Pénalité déjà appliquée : cette ligne ne peut plus être modifiée.' },
        { status: 400 }
      );
    }

    const body = await req.json();
    const data = weeklyTrackingUpdateSchema.parse(body);

    const computedPenalty = computePenalty(data.hoursWorked, tracking.hourTarget, Number(tracking.penaltyRateUsed));

    const updated = await prisma.weeklyTracking.update({
      where: { id: tracking.id },
      data: {
        hoursWorked: data.hoursWorked,
        ridesCompleted: data.ridesCompleted,
        computedPenalty,
        enteredById: session.user.id,
      },
    });

    await logAudit(session.user.id, 'UPDATE_WEEKLY_TRACKING', 'WeeklyTracking', tracking.id, data);

    return NextResponse.json(updated);
  } catch (err) {
    return handleAccessError(err);
  }
}

// DELETE /api/weekly/[id] — supprimer une saisie manuelle non encore appliquée.
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();

    const tracking = await prisma.weeklyTracking.findUnique({ where: { id: params.id } });
    if (!tracking) {
      return NextResponse.json({ error: 'Suivi hebdomadaire introuvable.' }, { status: 404 });
    }

    await requireDriverWriteAccess(session.user.id, session.user.role, tracking.driverId);

    if (tracking.penaltyApplied) {
      return NextResponse.json(
        { error: 'Pénalité déjà appliquée : cette ligne ne peut plus être supprimée.' },
        { status: 400 }
      );
    }

    await prisma.weeklyTracking.delete({ where: { id: tracking.id } });
    await logAudit(session.user.id, 'DELETE_WEEKLY_TRACKING', 'WeeklyTracking', tracking.id);

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleAccessError(err);
  }
}
