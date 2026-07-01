import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession, handleAccessError } from '@/lib/access';

export async function GET() {
  try {
    await requireSession();

    // Récupérer tous les chauffeurs actifs avec leur date d'entrée (vehicleInService)
    const drivers = await prisma.driver.findMany({
      where: { active: true },
      select: {
        vehicleInService: true,
        contractType: true,
      },
      orderBy: { vehicleInService: 'asc' },
    });

    if (drivers.length === 0) return NextResponse.json({ points: [] });

    // Générer une série de points semaine par semaine depuis le 1er chauffeur
    function getWeekStart(date: Date): string {
      const d = new Date(date);
      const day = d.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      d.setDate(d.getDate() + diff);
      d.setHours(0, 0, 0, 0);
      return d.toISOString().slice(0, 10);
    }

    // Trouver la 1ère et la dernière semaine
    const first = drivers.find((d) => d.vehicleInService)?.vehicleInService ?? new Date();
    const last = new Date();

    const weeks: string[] = [];
    const cur = new Date(getWeekStart(first));
    const end = new Date(getWeekStart(last));
    while (cur <= end) {
      weeks.push(cur.toISOString().slice(0, 10));
      cur.setDate(cur.getDate() + 7);
    }

    // Pour chaque semaine, compter les chauffeurs entrés avant ou pendant cette semaine
    const points = weeks.map((wk) => {
      const wkDate = new Date(wk);
      const wkEnd = new Date(wk);
      wkEnd.setDate(wkEnd.getDate() + 7);

      let cv = 0;
      let loc = 0;
      for (const d of drivers) {
        const inService = d.vehicleInService ? new Date(d.vehicleInService) : null;
        if (!inService || inService >= wkEnd) continue;
        if (d.contractType === 'CONDITION_VENTE') cv++;
        else loc++;
      }

      // Label court : "JJ/MM"
      const label = wkDate.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
      return { week: wk, label, cv, loc, total: cv + loc };
    });

    return NextResponse.json({ points });
  } catch (err) {
    return handleAccessError(err);
  }
}
