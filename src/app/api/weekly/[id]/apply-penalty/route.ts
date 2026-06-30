import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession, requireDriverWriteAccess, handleAccessError, logAudit } from '@/lib/access';

// POST /api/weekly/[id]/apply-penalty
// Applique manuellement la penalite deja calculee :
// - Location -> cree un mouvement de caution DEDUCTION_SANCTION
// - Condition-Vente -> marque la penalite comme appliquee (vient s'ajouter au reste a payer)
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

    const result = await prisma.$transaction(async (tx) => {
      if (tracking.driver.contractType === 'LOCATION') {
        const agg = await tx.cautionMovement.aggregate({
          where: { driverId: tracking.driverId },
          _sum: { amount: true },
        });
        const currentBalance = Number(agg._sum.amount ?? 0);
        const newBalance = currentBalance - penaltyAmount;

        await tx.cautionMovement.create({
          data: {
            driverId: tracking.driverId,
            date: new Date(),
            type: 'DEDUCTION_SANCTION',
            amount: -penaltyAmount,
            reason: `Pénalité heures manquantes — semaine du ${tracking.weekStartDate.toLocaleDateString('fr-FR')}`,
            resultBalance: newBalance,
            enteredById: session.user.id,
          },
        });
      }

      return tx.weeklyTracking.update({
        where: { id: tracking.id },
        data: { penaltyApplied: true, penaltyAppliedAt: new Date() },
      });
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
