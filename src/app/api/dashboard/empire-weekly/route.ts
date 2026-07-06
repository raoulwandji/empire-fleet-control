import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession, handleAccessError } from '@/lib/access';

// GET /api/dashboard/empire-weekly?week=YYYY-MM-DD
// Retourne pour une semaine (par défaut la semaine en cours) :
// - cumul commissions Empire sur tous les propriétaires
// - cumul préfinancements Empire sur tous les propriétaires
// - liste propriétaires avec versements bruts, commissions, préfinancements, net à verser
export async function GET(req: NextRequest) {
  try {
    await requireSession();

    const weekParam = req.nextUrl.searchParams.get('week');
    const ref = weekParam ? new Date(weekParam) : new Date();
    const day = ref.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const weekStart = new Date(ref);
    weekStart.setDate(ref.getDate() + diff);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);

    // Tous les propriétaires avec leurs données de la semaine
    const owners = await prisma.owner.findMany({
      orderBy: { fullName: 'asc' },
      select: {
        id: true,
        fullName: true,
        phone: true,
        drivers: {
          where: { active: true },
          select: {
            payments: {
              where: { date: { gte: weekStart, lt: weekEnd } },
              select: { amount: true },
            },
          },
        },
        commissions: {
          where: { weekStart: { gte: weekStart, lt: weekEnd } },
          select: { amount: true },
        },
        prefinancements: {
          where: { weekStart: { gte: weekStart, lt: weekEnd } },
          select: { amount: true },
        },
      },
    });

    const ownerStats = owners.map((o) => {
      const versements = o.drivers.reduce(
        (s, d) => s + d.payments.reduce((ps, p) => ps + Number(p.amount), 0),
        0
      );
      const commission = o.commissions.reduce((s, c) => s + Number(c.amount), 0);
      const prefinancement = o.prefinancements.reduce((s, p) => s + Number(p.amount), 0);
      const net = versements - commission - prefinancement;
      return { id: o.id, fullName: o.fullName, versements, commission, prefinancement, net };
    });

    // Filtrer les propriétaires qui ont une activité (versements ou déductions)
    const activeOwners = ownerStats.filter(
      (o) => o.versements > 0 || o.commission > 0 || o.prefinancement > 0
    );

    const totalCommissions = ownerStats.reduce((s, o) => s + o.commission, 0);
    const totalPrefinancements = ownerStats.reduce((s, o) => s + o.prefinancement, 0);
    const totalVersements = ownerStats.reduce((s, o) => s + o.versements, 0);
    const totalNet = ownerStats.reduce((s, o) => s + o.net, 0);

    return NextResponse.json({
      weekStart: weekStart.toISOString(),
      totalVersements,
      totalCommissions,
      totalPrefinancements,
      totalNet,
      owners: activeOwners,
    });
  } catch (err) {
    return handleAccessError(err);
  }
}
