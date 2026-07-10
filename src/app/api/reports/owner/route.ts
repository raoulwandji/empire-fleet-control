import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession, requireAdminOrManager, handleAccessError , requireCapability } from '@/lib/access';

export async function GET(req: NextRequest) {
  try {
    const session = await requireSession();
    await requireCapability(session.user.id, session.user.role, 'reports');

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

    const [payments, prefinancements, commissions] = await Promise.all([
      prisma.payment.findMany({
        where: {
          driver: { ownerId },
          ...(Object.keys(dateFilter).length > 0 ? { date: dateFilter } : {}),
        },
        select: { amount: true, date: true, driverId: true, isInactive: true, inactivityReason: true, comment: true },
        orderBy: { date: 'asc' },
      }),
      prisma.ownerPrefinancement.findMany({
        where: {
          ownerId,
          ...(Object.keys(dateFilter).length > 0 ? { weekStart: dateFilter } : {}),
        },
        select: {
          id: true,
          amount: true,
          weekStart: true,
          note: true,
          driver: { select: { vehiclePlate: true, fullName: true, code: true } },
        },
        orderBy: { weekStart: 'asc' },
      }),
      prisma.ownerCommission.findMany({
        where: {
          ownerId,
          ...(Object.keys(dateFilter).length > 0 ? { weekStart: dateFilter } : {}),
        },
        select: { id: true, amount: true, weekStart: true, note: true },
        orderBy: { weekStart: 'asc' },
      }),
    ]);

    function getWeekStart(date: Date): string {
      const d = new Date(date);
      const day = d.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      d.setDate(d.getDate() + diff);
      d.setHours(0, 0, 0, 0);
      return d.toISOString().slice(0, 10);
    }

    // weekKey -> driverId -> total versements
    const byWeekDriver = new Map<string, Map<string, number>>();
    // weekKey -> driverId -> jours d'inactivité (motif)
    const byWeekInactive = new Map<string, Map<string, { date: string; reason: string | null }[]>>();
    // weekKey -> driverId -> versements avec commentaire (jours incomplets / remarques)
    const byWeekNotes = new Map<string, Map<string, { date: string; amount: number; comment: string }[]>>();
    for (const p of payments) {
      const wk = getWeekStart(p.date);
      if (!byWeekDriver.has(wk)) byWeekDriver.set(wk, new Map());
      const dMap = byWeekDriver.get(wk)!;
      dMap.set(p.driverId, (dMap.get(p.driverId) ?? 0) + Number(p.amount));

      if (p.isInactive) {
        if (!byWeekInactive.has(wk)) byWeekInactive.set(wk, new Map());
        const iMap = byWeekInactive.get(wk)!;
        if (!iMap.has(p.driverId)) iMap.set(p.driverId, []);
        iMap.get(p.driverId)!.push({ date: p.date.toISOString().slice(0, 10), reason: p.inactivityReason });
      } else if (p.comment?.trim()) {
        if (!byWeekNotes.has(wk)) byWeekNotes.set(wk, new Map());
        const nMap = byWeekNotes.get(wk)!;
        if (!nMap.has(p.driverId)) nMap.set(p.driverId, []);
        nMap.get(p.driverId)!.push({ date: p.date.toISOString().slice(0, 10), amount: Number(p.amount), comment: p.comment.trim() });
      }
    }

    // weekKey -> préfinancements[]
    const byWeekPref = new Map<string, typeof prefinancements>();
    for (const pf of prefinancements) {
      const wk = pf.weekStart.toISOString().slice(0, 10);
      if (!byWeekPref.has(wk)) byWeekPref.set(wk, []);
      byWeekPref.get(wk)!.push(pf);
    }

    // weekKey -> commission (unique par semaine)
    const byWeekComm = new Map<string, typeof commissions[0]>();
    for (const c of commissions) {
      byWeekComm.set(c.weekStart.toISOString().slice(0, 10), c);
    }

    // Merge all weeks
    const allWeeks = [...new Set([
      ...byWeekDriver.keys(),
      ...byWeekPref.keys(),
      ...byWeekComm.keys(),
    ])].sort();

    const rows = allWeeks.map((wk) => {
      const dMap = byWeekDriver.get(wk) ?? new Map<string, number>();
      const iMap = byWeekInactive.get(wk) ?? new Map<string, { date: string; reason: string | null }[]>();
      const nMap = byWeekNotes.get(wk) ?? new Map<string, { date: string; amount: number; comment: string }[]>();
      const perDriver = drivers.map((d) => ({
        driverId: d.id,
        vehiclePlate: d.vehiclePlate,
        fullName: d.fullName,
        code: d.code,
        total: dMap.get(d.id) ?? 0,
        inactiveDays: iMap.get(d.id) ?? [],
        notes: nMap.get(d.id) ?? [],
      }));
      const weekTotal = perDriver.reduce((s, x) => s + x.total, 0);
      const weekPrefs = (byWeekPref.get(wk) ?? []).map((pf) => ({
        id: pf.id,
        amount: Number(pf.amount),
        note: pf.note,
        vehiclePlate: pf.driver?.vehiclePlate ?? null,
        driverName: pf.driver?.fullName ?? null,
        driverCode: pf.driver?.code ?? null,
      }));
      const totalPrefs = weekPrefs.reduce((s, pf) => s + pf.amount, 0);
      const comm = byWeekComm.get(wk);
      const commission = comm ? { id: comm.id, amount: Number(comm.amount), note: comm.note } : null;
      const totalComm = commission?.amount ?? 0;
      const netWeek = weekTotal - totalPrefs - totalComm;
      return { weekStart: wk, perDriver, weekTotal, prefinancements: weekPrefs, totalPrefs, commission, totalComm, netWeek };
    });

    const grandTotal = rows.reduce((s, r) => s + r.weekTotal, 0);
    const grandTotalPrefs = rows.reduce((s, r) => s + r.totalPrefs, 0);
    const grandTotalComm = rows.reduce((s, r) => s + r.totalComm, 0);
    const grandNet = grandTotal - grandTotalPrefs - grandTotalComm;

    return NextResponse.json({ owner, drivers, rows, grandTotal, grandTotalPrefs, grandTotalComm, grandNet });
  } catch (err) {
    return handleAccessError(err);
  }
}
