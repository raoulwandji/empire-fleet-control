import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession, requireAdminOrManager, handleAccessError } from '@/lib/access';

export async function GET(req: NextRequest) {
  try {
    const session = await requireSession();
    requireAdminOrManager(session.user.role);

    const url = req.nextUrl;
    const ownerId = url.searchParams.get('ownerId');
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');

    if (!ownerId) return NextResponse.json({ error: 'ownerId requis' }, { status: 400 });

    const owner = await prisma.owner.findUniqueOrThrow({
      where: { id: ownerId },
      select: { id: true, fullName: true, phone: true, location: true },
    });

    const drivers = await prisma.driver.findMany({
      where: { ownerId },
      select: { id: true, code: true, fullName: true, vehiclePlate: true, contractType: true },
      orderBy: { fullName: 'asc' },
    });

    const dateFilter: Record<string, Date> = {};
    if (from) dateFilter.gte = new Date(from);
    if (to) {
      const toDate = new Date(to);
      toDate.setDate(toDate.getDate() + 1);
      dateFilter.lt = toDate;
    }

    const payments = await prisma.payment.findMany({
      where: {
        driver: { ownerId },
        ...(Object.keys(dateFilter).length > 0 ? { date: dateFilter } : {}),
      },
      select: {
        amount: true,
        date: true,
        driverId: true,
      },
      orderBy: { date: 'asc' },
    });

    // Group by driver then week
    function getWeekStart(date: Date): string {
      const d = new Date(date);
      const day = d.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      d.setDate(d.getDate() + diff);
      d.setHours(0, 0, 0, 0);
      return d.toISOString().slice(0, 10);
    }

    const driverMap = new Map(drivers.map((d) => [d.id, d]));
    // weekKey -> driverId -> total
    const byWeekDriver = new Map<string, Map<string, number>>();

    for (const p of payments) {
      const wk = getWeekStart(p.date);
      if (!byWeekDriver.has(wk)) byWeekDriver.set(wk, new Map());
      const dMap = byWeekDriver.get(wk)!;
      dMap.set(p.driverId, (dMap.get(p.driverId) ?? 0) + Number(p.amount));
    }

    const weeks = [...byWeekDriver.keys()].sort();

    const rows = weeks.map((wk) => {
      const dMap = byWeekDriver.get(wk)!;
      const perDriver = drivers.map((d) => ({
        driverId: d.id,
        vehiclePlate: d.vehiclePlate,
        fullName: d.fullName,
        code: d.code,
        total: dMap.get(d.id) ?? 0,
      }));
      const weekTotal = perDriver.reduce((s, x) => s + x.total, 0);
      return { weekStart: wk, perDriver, weekTotal };
    });

    const grandTotal = rows.reduce((s, r) => s + r.weekTotal, 0);

    return NextResponse.json({ owner, drivers, rows, grandTotal });
  } catch (err) {
    return handleAccessError(err);
  }
}
