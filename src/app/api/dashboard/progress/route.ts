import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession, handleAccessError } from '@/lib/access';

// GET /api/dashboard/progress?limit=5
// Bilan de progression des chauffeurs Condition-Vente vers la fin de leur contrat,
// trié par pourcentage payé décroissant (les plus proches de finir en tête).
export async function GET(req: NextRequest) {
  try {
    await requireSession();

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') ?? '5', 10);

    const drivers = await prisma.driver.findMany({
      where: { contractType: 'CONDITION_VENTE', active: true },
      include: {
        payments: { select: { amount: true } },
        weeklyTrackings: { where: { penaltyApplied: true }, select: { computedPenalty: true } },
        cautionMovements: { select: { amount: true } },
      },
    });

    const ranked = drivers
      .map((d) => {
        const totalPaid = d.payments.reduce((sum, p) => sum + Number(p.amount), 0);
        const appliedPenalties = d.weeklyTrackings.reduce((sum, w) => sum + Number(w.computedPenalty), 0);
        // La caution du CV est une avance de remboursement : comptée dans la progression.
        const cautionAdvance = d.cautionMovements.reduce((sum, m) => sum + Number(m.amount), 0);
        const totalFixed = Number(d.totalPriceFixed ?? 0);
        const totalPaidWithAdvance = totalPaid + cautionAdvance;
        // Les pénalités ne sont plus soustraites du reste à payer (déduction gérée en interne) :
        // appliedPenalties reste affiché à titre informatif uniquement.
        const resteAPayer = totalFixed - totalPaidWithAdvance;
        const percent = totalFixed > 0 ? Math.min(100, (totalPaidWithAdvance / totalFixed) * 100) : 0;

        return {
          driverId: d.id,
          code: d.code,
          fullName: d.fullName,
          totalFixed,
          totalPaid,
          cautionAdvance,
          totalPaidWithAdvance,
          appliedPenalties,
          resteAPayer,
          percent: Math.round(percent * 10) / 10,
        };
      })
      .filter((d) => d.totalFixed > 0)
      .sort((a, b) => b.percent - a.percent)
      .slice(0, limit);

    return NextResponse.json(ranked);
  } catch (err) {
    return handleAccessError(err);
  }
}
