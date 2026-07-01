import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession, requireAdminOrManager, handleAccessError } from '@/lib/access';

export async function GET() {
  try {
    const session = await requireSession();
    requireAdminOrManager(session.user.role);

    const commissions = await prisma.ownerCommission.findMany({
      select: { weekStart: true, amount: true },
      orderBy: { weekStart: 'asc' },
    });

    const byWeek = new Map<string, number>();
    for (const c of commissions) {
      const wk = c.weekStart.toISOString().slice(0, 10);
      byWeek.set(wk, (byWeek.get(wk) ?? 0) + Number(c.amount));
    }

    const points = [...byWeek.entries()].map(([wk, total]) => {
      const d = new Date(wk);
      const label = d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
      return { week: wk, label, total };
    });

    return NextResponse.json({ points });
  } catch (err) {
    return handleAccessError(err);
  }
}
