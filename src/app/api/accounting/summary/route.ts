import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession, handleAccessError } from '@/lib/access';
import { BUSINESS_UNITS } from '@/lib/businessUnits';

// GET /api/accounting/summary?businessUnit=&from=&to= — indicateurs + séries pour graphiques.
// Sans businessUnit : vue générale (toutes structures confondues) + répartition par structure.
// Avec businessUnit : comptabilité partielle, propre à cette structure.
export async function GET(req: NextRequest) {
  try {
    const session = await requireSession();
    const { searchParams } = new URL(req.url);
    const businessUnit = searchParams.get('businessUnit');
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    if (!businessUnit && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: "La vue d'ensemble est réservée à l'administrateur." }, { status: 403 });
    }

    const where: Record<string, unknown> = {};
    if (businessUnit) where.businessUnit = businessUnit;
    if (from || to) {
      where.date = {};
      if (from) (where.date as Record<string, Date>).gte = new Date(from);
      if (to) {
        const end = new Date(to);
        end.setHours(23, 59, 59, 999);
        (where.date as Record<string, Date>).lte = end;
      }
    }

    const entries = await prisma.accountingEntry.findMany({
      where,
      orderBy: { date: 'asc' },
      select: { date: true, type: true, category: true, amount: true, businessUnit: true },
    });

    let totalEntrees = 0;
    let totalSorties = 0;

    // Agrégats par mois (YYYY-MM)
    const byMonth = new Map<string, { entrees: number; sorties: number }>();
    // Répartition des sorties et entrées par catégorie
    const catSorties = new Map<string, number>();
    const catEntrees = new Map<string, number>();

    // Répartition par structure (uniquement pertinent en vue générale, sans filtre businessUnit).
    const byStructureMap = new Map<string, { entrees: number; sorties: number }>();

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

      const structKey = e.businessUnit ?? 'GENERAL';
      const s = byStructureMap.get(structKey) ?? { entrees: 0, sorties: 0 };
      if (e.type === 'ENTREE') s.entrees += amt; else s.sorties += amt;
      byStructureMap.set(structKey, s);
    }

    const byStructure = Array.from(byStructureMap.entries())
      .map(([key, v]) => ({
        businessUnit: key,
        label: key === 'GENERAL' ? 'Général (hors structure)' : BUSINESS_UNITS.find((u) => u.key === key)?.label ?? key,
        entrees: v.entrees,
        sorties: v.sorties,
        solde: v.entrees - v.sorties,
      }))
      .sort((a, b) => (b.entrees + b.sorties) - (a.entrees + a.sorties));

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
      byStructure,
    });
  } catch (err) {
    return handleAccessError(err);
  }
}
