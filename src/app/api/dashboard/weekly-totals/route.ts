import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession, handleAccessError } from '@/lib/access';
import { getWeekStart, getWeekEnd } from '@/lib/business';

// GET /api/dashboard/weekly-totals?week=YYYY-MM-DD
// Cumul des versements/loyers d'une semaine (par défaut la semaine en cours), par type de contrat.
export async function GET(req: NextRequest) {
  try {
    await requireSession();

    const weekParam = req.nextUrl.searchParams.get('week');
    const ref = weekParam ? new Date(weekParam) : new Date();
    const weekStart = getWeekStart(ref);
    // Semaine choisie : borne à la fin de semaine ; semaine en cours : borne à maintenant.
    const now = weekParam ? getWeekEnd(weekStart) : new Date();

    const [cvResult, locResult] = await Promise.all([
      // Total versé semaine en cours — Condition-Vente
      prisma.payment.aggregate({
        where: {
          date: { gte: weekStart, lte: now },
          driver: { contractType: 'CONDITION_VENTE' },
        },
        _sum: { amount: true },
        _count: { id: true },
      }),
      // Total versé semaine en cours — Location
      prisma.payment.aggregate({
        where: {
          date: { gte: weekStart, lte: now },
          driver: { contractType: 'LOCATION' },
        },
        _sum: { amount: true },
        _count: { id: true },
      }),
    ]);

    // Nombre de chauffeurs distincts ayant versé cette semaine, par type
    const [cvDrivers, locDrivers] = await Promise.all([
      prisma.payment.groupBy({
        by: ['driverId'],
        where: {
          date: { gte: weekStart, lte: now },
          driver: { contractType: 'CONDITION_VENTE' },
        },
      }),
      prisma.payment.groupBy({
        by: ['driverId'],
        where: {
          date: { gte: weekStart, lte: now },
          driver: { contractType: 'LOCATION' },
        },
      }),
    ]);

    return NextResponse.json({
      weekStartDate: weekStart,
      conditionVente: {
        totalAmount: Number(cvResult._sum.amount ?? 0),
        paymentCount: cvResult._count.id,
        driverCount: cvDrivers.length,
      },
      location: {
        totalAmount: Number(locResult._sum.amount ?? 0),
        paymentCount: locResult._count.id,
        driverCount: locDrivers.length,
      },
    });
  } catch (err) {
    return handleAccessError(err);
  }
}
