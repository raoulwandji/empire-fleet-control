import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession, handleAccessError } from '@/lib/access';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireSession();

    const now = new Date();
    const day = now.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() + diff);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);

    const owner = await prisma.owner.findUniqueOrThrow({
      where: { id: params.id },
      include: {
        drivers: {
          where: { active: true },
          select: {
            id: true,
            code: true,
            fullName: true,
            contractType: true,
            vehiclePlate: true,
            payments: {
              where: { date: { gte: weekStart, lt: weekEnd } },
              select: { amount: true, date: true },
            },
          },
          orderBy: { fullName: 'asc' },
        },
        commissions: {
          orderBy: { weekStart: 'desc' },
          take: 12,
          include: { enteredBy: { select: { fullName: true } } },
        },
        prefinancements: {
          orderBy: { weekStart: 'desc' },
          take: 24,
          include: {
            enteredBy: { select: { fullName: true } },
            driver: { select: { id: true, fullName: true, vehiclePlate: true, code: true } },
          },
        },
      },
    });

    return NextResponse.json({ owner, weekStart: weekStart.toISOString() });
  } catch (err) {
    return handleAccessError(err);
  }
}
