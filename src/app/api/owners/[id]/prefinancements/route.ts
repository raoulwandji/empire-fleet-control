import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAdminOrManager, requireSession, handleAccessError } from '@/lib/access';

const schema = z.object({
  weekStart: z.string(),
  amount: z.number().positive(),
  note: z.string().min(1, 'L\'objet du préfinancement est requis.'),
  driverId: z.string().optional(),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    requireAdminOrManager(session.user.role);
    const body = schema.parse(await req.json());

    const pref = await prisma.ownerPrefinancement.create({
      data: {
        ownerId: params.id,
        driverId: body.driverId || undefined,
        weekStart: new Date(body.weekStart),
        amount: body.amount,
        note: body.note,
        enteredById: session.user.id,
      },
      include: {
        driver: { select: { fullName: true, vehiclePlate: true, code: true } },
        enteredBy: { select: { fullName: true } },
      },
    });

    return NextResponse.json(pref, { status: 201 });
  } catch (err) {
    return handleAccessError(err);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    requireAdminOrManager(session.user.role);
    const prefId = req.nextUrl.searchParams.get('id');
    if (!prefId) return NextResponse.json({ error: 'id requis' }, { status: 400 });

    await prisma.ownerPrefinancement.deleteMany({
      where: { id: prefId, ownerId: params.id },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleAccessError(err);
  }
}
