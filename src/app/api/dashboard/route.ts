import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession, handleAccessError } from '@/lib/access';
import { getWeekStart } from '@/lib/business';

// GET /api/dashboard?weekStartDate=ISO  (optionnel — sinon cumul total)
export async function GET(req: NextRequest) {
  try {
    await requireSession();

    const { searchParams } = new URL(req.url);
    const weekStartParam = searchParams.get('weekStartDate');
    const weekFilter = weekStartParam ? getWeekStart(new Date(weekStartParam)) : null;

    const trackings = await prisma.weeklyTracking.findMany({
      where: weekFilter ? { weekStartDate: weekFilter } : undefined,
      include: { driver: { select: { id: true, code: true, fullName: true, contractType: true } } },
    });

    const byDriver = new Map<
      string,
      { driverId: string; code: string; fullName: string; contractType: string; totalRides: number; totalHours: number }
    >();

    for (const t of trackings) {
      const key = t.driverId;
      const entry =
        byDriver.get(key) ??
        {
          driverId: t.driverId,
          code: t.driver.code,
          fullName: t.driver.fullName,
          contractType: t.driver.contractType,
          totalRides: 0,
          totalHours: 0,
        };
      entry.totalRides += t.ridesCompleted;
      entry.totalHours += Number(t.hoursWorked);
      byDriver.set(key, entry);
    }

    const all = Array.from(byDriver.values());

    const conditionVente = all
      .filter((d) => d.contractType === 'CONDITION_VENTE')
      .sort((a, b) => b.totalRides - a.totalRides);

    const location = all
      .filter((d) => d.contractType === 'LOCATION')
      .sort((a, b) => b.totalRides - a.totalRides);

    return NextResponse.json({
      weekStartDate: weekFilter,
      conditionVente,
      location,
    });
  } catch (err) {
    return handleAccessError(err);
  }
}
