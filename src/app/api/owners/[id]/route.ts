import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireSession, requireAdminOrManager, handleAccessError } from '@/lib/access';

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
            id: true, code: true, fullName: true, contractType: true, vehiclePlate: true,
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

const ownerUpdateSchema = z.object({
  fullName: z.string().min(2).optional(),
  phone: z.string().min(6).optional(),
  location: z.string().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    requireAdminOrManager(session.user.role);
    const body = ownerUpdateSchema.parse(await req.json());
    const owner = await prisma.owner.update({ where: { id: params.id }, data: body });
    return NextResponse.json(owner);
  } catch (err) {
    return handleAccessError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    requireAdminOrManager(session.user.role);
    await prisma.owner.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleAccessError(err);
  }
}
