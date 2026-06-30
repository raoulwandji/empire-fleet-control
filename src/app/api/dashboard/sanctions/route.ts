import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession, handleAccessError } from '@/lib/access';
import { getWeekStart } from '@/lib/business';

// GET /api/dashboard/sanctions?scope=total|lastWeek&contractType=&limit=
// Bilan des chauffeurs avec les pénalités (sanctions) les plus élevées.
// scope=total -> cumul depuis le début de leur "aventure" (toutes les pénalités appliquées).
// scope=lastWeek -> uniquement la pénalité appliquée la semaine précédente.
export async function GET(req: NextRequest) {
  try {
    await requireSession();

    const { searchParams } = new URL(req.url);
    const scope = searchParams.get('scope') === 'lastWeek' ? 'lastWeek' : 'total';
    const contractType = searchParams.get('contractType');
    const limit = parseInt(searchParams.get('limit') ?? '10', 10);

    const lastWeekStart = getWeekStart(new Date());
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);

    const trackings = await prisma.weeklyTracking.findMany({
      where: {
        penaltyApplied: true,
        ...(scope === 'lastWeek' ? { weekStartDate: lastWeekStart } : {}),
        driver: contractType ? { contractType: contractType as any } : undefined,
      },
      include: { driver: { select: { id: true, code: true, fullName: true, contractType: true } } },
    });

    const byDriver = new Map<
      string,
      { driverId: string; code: string; fullName: string; contractType: string; totalPenalty: number; count: number }
    >();

    for (const t of trackings) {
      const key = t.driverId;
      const entry =
        byDriver.get(key) ??
        { driverId: t.driverId, code: t.driver.code, fullName: t.driver.fullName, contractType: t.driver.contractType, totalPenalty: 0, count: 0 };
      entry.totalPenalty += Number(t.computedPenalty);
      entry.count += 1;
      byDriver.set(key, entry);
    }

    const ranked = Array.from(byDriver.values())
      .sort((a, b) => b.totalPenalty - a.totalPenalty)
      .slice(0, limit);

    return NextResponse.json({ scope, weekStartDate: scope === 'lastWeek' ? lastWeekStart : null, ranked });
  } catch (err) {
    return handleAccessError(err);
  }
}
