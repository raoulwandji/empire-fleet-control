import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession, handleAccessError } from '@/lib/access';

// GET /api/accounting/summary — indicateurs + séries pour graphiques
export async function GET() {
  try {
    await requireSession();

    const entries = await prisma.accountingEntry.findMany({
      orderBy: { date: 'asc' },
      select: { date: true, type: true, category: true, amount: true },
    });

    let totalEntrees = 0;
    let totalSorties = 0;

    // Agrégats par mois (YYYY-MM)
    const byMonth = new Map<string, { entrees: number; sorties: number }>();
    // Répartition des sorties et entrées par catégorie
    const catSorties = new Map<string, number>();
    const catEntrees = new Map<string, number>();

    for (const e of entries) {
      const amt = Number(e.amount);
      const key = e.date.toISOString().slice(0, 7); // YYYY-MM
      const m = byMonth.get(key) ?? { entrees: 0, sorties: 0 };
      if (e.type === 'ENTREE') {
        totalEntrees += amt;
        m.entrees += amt;
        catEntrees.set(e.category, (catEntrees.get(e.category) ?? 0) + amt);
      } else {
        totalSorties += amt;
        m.sorties += amt;
        catSorties.set(e.category, (catSorties.get(e.category) ?? 0) + amt);
      }
      byMonth.set(key, m);
    }

    // Série mensuelle avec solde cumulé
    const MONTHS_FR = ['jan', 'fév', 'mar', 'avr', 'mai', 'juin', 'juil', 'aoû', 'sep', 'oct', 'nov', 'déc'];
    let cumul = 0;
    const monthly = Array.from(byMonth.entries()).map(([key, v]) => {
      const net = v.entrees - v.sorties;
      cumul += net;
      const [y, mo] = key.split('-');
      return {
        month: key,
        label: `${MONTHS_FR[parseInt(mo, 10) - 1]} ${y.slice(2)}`,
        entrees: v.entrees,
        sorties: v.sorties,
        net,
        cumul,
      };
    });

    const toSortedArray = (m: Map<string, number>) =>
      Array.from(m.entries())
        .map(([category, amount]) => ({ category, amount }))
        .sort((a, b) => b.amount - a.amount);

    // Flux du mois en cours
    const nowKey = new Date().toISOString().slice(0, 7);
    const current = byMonth.get(nowKey) ?? { entrees: 0, sorties: 0 };

    return NextResponse.json({
      totals: {
        entrees: totalEntrees,
        sorties: totalSorties,
        solde: totalEntrees - totalSorties,
        count: entries.length,
      },
      currentMonth: {
        entrees: current.entrees,
        sorties: current.sorties,
        net: current.entrees - current.sorties,
      },
      monthly,
      categoriesSorties: toSortedArray(catSorties),
      categoriesEntrees: toSortedArray(catEntrees),
    });
  } catch (err) {
    return handleAccessError(err);
  }
}
