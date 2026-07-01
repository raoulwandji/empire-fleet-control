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

    const [payments, prefinancements] = await Promise.all([
      prisma.payment.findMany({
        where: {
          driver: { ownerId },
          ...(Object.keys(dateFilter).length > 0 ? { date: dateFilter } : {}),
        },
        select: { amount: true, date: true, driverId: true },
        orderBy: { date: 'asc' },
      }),
      prisma.ownerPrefinancement.findMany({
        where: {
          ownerId,
          ...(Object.keys(dateFilter).length > 0 ? { weekStart: dateFilter } : {}),
        },
        select: {
          amount: true,
          weekStart: true,
          note: true,
          driver: { select: { vehiclePlate: true, fullName: true, code: true } },
        },
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

    const byWeekDriver = new Map<string, Map<string, number>>();
    for (const p of payments) {
      const wk = getWeekStart(p.date);
      if (!byWeekDriver.has(wk)) byWeekDriver.set(wk, new Map());
      const dMap = byWeekDriver.get(wk)!;
      dMap.set(p.driverId, (dMap.get(p.driverId) ?? 0) + Number(p.amount));
    }

    const byWeekPref = new Map<string, typeof prefinancements>();
    for (const pf of prefinancements) {
      const wk = pf.weekStart.toISOString().slice(0, 10);
      if (!byWeekPref.has(wk)) byWeekPref.set(wk, []);
      byWeekPref.get(wk)!.push(pf);
    }

    const allWeeks = [...new Set([...byWeekDriver.keys(), ...byWeekPref.keys()])].sort();

    const fmt = (n: number) => n.toLocaleString('fr-FR', { minimumFractionDigits: 0 }) + ' XOF';

    // Flatten to rows with versements + préfinancements per week
    const rows: Record<string, unknown>[] = [];
    for (const wk of allWeeks) {
      const dMap = byWeekDriver.get(wk) ?? new Map<string, number>();
      const weekPrefs = byWeekPref.get(wk) ?? [];

      // Versements par véhicule
      for (const d of drivers) {
        const total = dMap.get(d.id) ?? 0;
        if (total > 0) {
          rows.push({ semaine: wk, ligne: 'Versement', vehicule: d.vehiclePlate, detail: `${d.fullName} (${d.code})`, montant: fmt(total) });
        }
      }

      const weekTotal = [...dMap.values()].reduce((s, v) => s + v, 0);
      rows.push({ semaine: '', ligne: 'TOTAL VERSEMENTS', vehicule: '', detail: '', montant: fmt(weekTotal) });

      // Préfinancements
      for (const pf of weekPrefs) {
        const veh = pf.driver ? `${pf.driver.vehiclePlate} — ${pf.driver.fullName}` : 'Non spécifié';
        rows.push({ semaine: '', ligne: 'Préfinancement', vehicule: veh, detail: pf.note ?? '', montant: `− ${fmt(Number(pf.amount))}` });
      }

      if (weekPrefs.length > 0) {
        const totalPrefs = weekPrefs.reduce((s, pf) => s + Number(pf.amount), 0);
        const net = weekTotal - totalPrefs;
        rows.push({ semaine: '', ligne: 'NET À VERSER', vehicule: '', detail: '', montant: fmt(net) });
      }

      // Séparateur visuel
      rows.push({ semaine: '---', ligne: '', vehicule: '', detail: '', montant: '' });
    }

    // Retirer le dernier séparateur
    if (rows.length > 0 && rows[rows.length - 1].semaine === '---') rows.pop();

    const columns = [
      { key: 'semaine', header: 'Semaine' },
      { key: 'ligne', header: 'Type' },
      { key: 'vehicule', header: 'Véhicule' },
      { key: 'detail', header: 'Détail / Objet' },
      { key: 'montant', header: 'Montant' },
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
