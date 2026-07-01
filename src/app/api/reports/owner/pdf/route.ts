import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession, requireAdminOrManager, handleAccessError } from '@/lib/access';
import { buildPdfBuffer } from '@/lib/pdf';

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
      select: { fullName: true },
    });

    const drivers = await prisma.driver.findMany({
      where: { ownerId },
      select: { id: true, fullName: true, vehiclePlate: true, code: true },
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
      select: { amount: true, date: true, driverId: true },
      orderBy: { date: 'asc' },
    });

    function getWeekStart(date: Date): string {
      const d = new Date(date);
      const day = d.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      d.setDate(d.getDate() + diff);
      d.setHours(0, 0, 0, 0);
      return d.toISOString().slice(0, 10);
    }

    const driverMap = new Map(drivers.map((d) => [d.id, d]));
    const byWeekDriver = new Map<string, Map<string, number>>();

    for (const p of payments) {
      const wk = getWeekStart(p.date);
      if (!byWeekDriver.has(wk)) byWeekDriver.set(wk, new Map());
      const dMap = byWeekDriver.get(wk)!;
      dMap.set(p.driverId, (dMap.get(p.driverId) ?? 0) + Number(p.amount));
    }

    const weeks = [...byWeekDriver.keys()].sort();

    // Flatten to rows: Semaine | Véhicule | Chauffeur | Total
    const rows: Record<string, unknown>[] = [];
    for (const wk of weeks) {
      const dMap = byWeekDriver.get(wk)!;
      for (const d of drivers) {
        const total = dMap.get(d.id) ?? 0;
        if (total > 0) {
          rows.push({
            semaine: wk,
            vehicule: d.vehiclePlate,
            chauffeur: `${d.fullName} (${d.code})`,
            total: total.toLocaleString('fr-FR', { minimumFractionDigits: 0 }) + ' XOF',
          });
        }
      }
      // Subtotal row
      const weekTotal = [...dMap.values()].reduce((s, v) => s + v, 0);
      rows.push({
        semaine: '',
        vehicule: '',
        chauffeur: 'TOTAL SEMAINE',
        total: weekTotal.toLocaleString('fr-FR', { minimumFractionDigits: 0 }) + ' XOF',
      });
    }

    const columns = [
      { key: 'semaine', header: 'Semaine' },
      { key: 'vehicule', header: 'Véhicule' },
      { key: 'chauffeur', header: 'Chauffeur' },
      { key: 'total', header: 'Total versé' },
    ];

    const period = from && to ? `${from} → ${to}` : from ? `À partir du ${from}` : to ? `Jusqu'au ${to}` : 'Toutes périodes';
    const title = `Rapport propriétaire — ${owner.fullName} | ${period}`;

    const pdfBuffer = await buildPdfBuffer(title, columns, rows);

    return new NextResponse(pdfBuffer as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="rapport-${owner.fullName.replace(/\s+/g, '-')}.pdf"`,
      },
    });
  } catch (err) {
    return handleAccessError(err);
  }
}
