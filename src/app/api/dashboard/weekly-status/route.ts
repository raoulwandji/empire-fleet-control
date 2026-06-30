import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession, handleAccessError } from '@/lib/access';
import { getWeekStart } from '@/lib/business';

// Jours de versement attendus : Lundi(1), Mercredi(3), Jeudi(4), Vendredi(5), Samedi(6)
const EXPECTED_DAYS = [1, 3, 4, 5, 6];

// GET /api/dashboard/weekly-status?weekStartDate=ISO&status=complete|partial|none&contractType=
// Bilan des chauffeurs ayant complété tous leurs versements attendus de la semaine,
// ou liste de ceux n'ayant rien versé du tout sur la semaine.
export async function GET(req: NextRequest) {
  try {
    await requireSession();

    const { searchParams } = new URL(req.url);
    const weekParam = searchParams.get('weekStartDate');
    const statusFilter = searchParams.get('status'); // complete | partial | none | null(=all)
    const contractType = searchParams.get('contractType');

    const reference = weekParam ? new Date(weekParam) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const weekStart = getWeekStart(reference);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const drivers = await prisma.driver.findMany({
      where: { active: true, ...(contractType ? { contractType: contractType as any } : {}) },
      select: {
        id: true,
        code: true,
        fullName: true,
        contractType: true,
        payments: {
          where: { date: { gte: weekStart, lt: weekEnd } },
          select: { date: true, amount: true },
        },
      },
    });

    const results = drivers.map((d) => {
      const daysPaid = new Set(d.payments.map((p) => new Date(p.date).getDay()));
      const expectedPaidCount = EXPECTED_DAYS.filter((day) => daysPaid.has(day)).length;
      const totalAmount = d.payments.reduce((sum, p) => sum + Number(p.amount), 0);

      let status: 'complete' | 'partial' | 'none';
      if (expectedPaidCount === 0) status = 'none';
      else if (expectedPaidCount === EXPECTED_DAYS.length) status = 'complete';
      else status = 'partial';

      return {
        driverId: d.id,
        code: d.code,
        fullName: d.fullName,
        contractType: d.contractType,
        expectedDays: EXPECTED_DAYS.length,
        daysPaid: expectedPaidCount,
        totalAmount,
        status,
      };
    });

    const filtered = statusFilter ? results.filter((r) => r.status === statusFilter) : results;

    return NextResponse.json({ weekStartDate: weekStart, results: filtered });
  } catch (err) {
    return handleAccessError(err);
  }
}
