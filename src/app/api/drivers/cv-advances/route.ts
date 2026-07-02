import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession, requireAdminOrManager, handleAccessError } from '@/lib/access';

// GET /api/drivers/cv-advances
// Liste des chauffeurs Condition-Vente avec leur progression de remboursement,
// pour permettre à l'administrateur de saisir/appliquer leur avance (caution) existante.
export async function GET() {
  try {
    const session = await requireSession();
    requireAdminOrManager(session.user.role);

    const drivers = await prisma.driver.findMany({
      where: { contractType: 'CONDITION_VENTE', active: true },
      include: {
        payments: { select: { amount: true } },
        weeklyTrackings: { where: { penaltyApplied: true }, select: { computedPenalty: true } },
        cautionMovements: { select: { amount: true } },
      },
      orderBy: { code: 'asc' },
    });

    const rows = drivers.map((d) => {
      const totalPaid = d.payments.reduce((s, p) => s + Number(p.amount), 0);
      const appliedPenalties = d.weeklyTrackings.reduce((s, w) => s + Number(w.computedPenalty), 0);
      const cautionAdvance = d.cautionMovements.reduce((s, m) => s + Number(m.amount), 0);
      const totalFixed = Number(d.totalPriceFixed ?? 0);
      const totalPaidWithAdvance = totalPaid + cautionAdvance;
      const resteAPayer = totalFixed - totalPaidWithAdvance + appliedPenalties;
      const percent = totalFixed > 0 ? Math.min(100, (totalPaidWithAdvance / totalFixed) * 100) : 0;

      return {
        driverId: d.id,
        code: d.code,
        fullName: d.fullName,
        totalFixed,
        totalPaid,
        cautionAdvance,
        hasAdvance: d.cautionMovements.length > 0,
        resteAPayer,
        percent: Math.round(percent * 10) / 10,
      };
    });

    return NextResponse.json(rows);
  } catch (err) {
    return handleAccessError(err);
  }
}
