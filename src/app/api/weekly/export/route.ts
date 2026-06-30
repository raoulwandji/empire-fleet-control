import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession, handleAccessError } from '@/lib/access';
import { buildExcelBuffer, Column } from '@/lib/export';
import { buildPdfBuffer } from '@/lib/pdf';
import { formatFCFA, formatWeekRange } from '@/lib/business';
import { Prisma } from '@prisma/client';

const columns: Column[] = [
  { header: 'Semaine', key: 'week', width: 24 },
  { header: 'Heures réalisées', key: 'hours', width: 16 },
  { header: 'Objectif heures', key: 'target', width: 14 },
  { header: 'Courses', key: 'rides', width: 10 },
  { header: 'Pénalité calculée', key: 'penalty', width: 18 },
  { header: 'Statut sanction', key: 'status', width: 16 },
];

// GET /api/weekly/export?driverId=...&from=&to=&format=pdf|excel
// Feuille de suivi hebdomadaire (heures/courses/sanctions) d'un chauffeur, filtrable par plage de semaines.
export async function GET(req: NextRequest) {
  try {
    await requireSession();

    const { searchParams } = new URL(req.url);
    const driverId = searchParams.get('driverId');
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const format = searchParams.get('format') ?? 'excel';

    if (!driverId) {
      return NextResponse.json({ error: 'driverId requis.' }, { status: 400 });
    }

    const driver = await prisma.driver.findUnique({ where: { id: driverId } });
    if (!driver) {
      return NextResponse.json({ error: 'Chauffeur introuvable.' }, { status: 404 });
    }

    const where: Prisma.WeeklyTrackingWhereInput = { driverId };
    if (from || to) {
      where.weekStartDate = {};
      if (from) where.weekStartDate.gte = new Date(from);
      if (to) where.weekStartDate.lte = new Date(to);
    }

    const trackings = await prisma.weeklyTracking.findMany({ where, orderBy: { weekStartDate: 'asc' } });

    const rows = trackings.map((t) => ({
      week: formatWeekRange(t.weekStartDate),
      hours: Number(t.hoursWorked),
      target: t.hourTarget,
      rides: t.ridesCompleted,
      penalty: Number(t.computedPenalty) > 0 ? formatFCFA(Number(t.computedPenalty)) : '—',
      status: t.penaltyApplied ? 'Appliquée' : Number(t.computedPenalty) > 0 ? 'En attente' : '—',
    }));

    const title = `EMPIRE-FLEET CONTROL — Suivi hebdomadaire & sanctions — ${driver.fullName} (${driver.code})`;

    if (format === 'pdf') {
      const buffer = await buildPdfBuffer(title, columns, rows);
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="suivi-hebdo-${driver.code}.pdf"`,
        },
      });
    }

    const buffer = await buildExcelBuffer('Suivi hebdo', columns, rows);
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="suivi-hebdo-${driver.code}.xlsx"`,
      },
    });
  } catch (err) {
    return handleAccessError(err);
  }
}
