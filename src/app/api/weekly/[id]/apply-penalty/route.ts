import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession, requireDriverWriteAccess, handleAccessError, logAudit } from '@/lib/access';

// POST /api/weekly/[id]/apply-penalty
// Applique manuellement la penalite deja calculee.
// La penalite N'EST PLUS deduite de la caution des chauffeurs (Location comme Condition-Vente) :
// elle est seulement marquee comme appliquee et suivie (et vient s'ajouter au reste a payer en CV).
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();

    const tracking = await prisma.weeklyTracking.findUnique({
      where: { id: params.id },
      include: { driver: true },
    });

    if (!tracking) {
      return NextResponse.json({ error: 'Suivi hebdomadaire introuvable.' }, { status: 404 });
    }

    await requireDriverWriteAccess(session.user.id, session.user.role, tracking.driverId);

    if (tracking.penaltyApplied) {
      return NextResponse.json({ error: 'Cette pénalité a déjà été appliquée.' }, { status: 400 });
    }

    const penaltyAmount = Number(tracking.computedPenalty);
    if (penaltyAmount <= 0) {
      return NextResponse.json({ error: 'Aucune pénalité à appliquer pour cette semaine.' }, { status: 400 });
    }

    // La pénalité n'est plus déduite de la caution : on marque seulement la pénalité
    // comme appliquée (le suivi et, en Condition-Vente, le reste à payer en tiennent compte).
    const result = await prisma.weeklyTracking.update({
      where: { id: tracking.id },
      data: { penaltyApplied: true, penaltyAppliedAt: new Date() },
    });

    await logAudit(session.user.id, 'APPLY_PENALTY', 'WeeklyTracking', tracking.id, {
      driverId: tracking.driverId,
      penaltyAmount,
    });

    return NextResponse.json(result);
  } catch (err) {
    return handleAccessError(err);
  }
}
