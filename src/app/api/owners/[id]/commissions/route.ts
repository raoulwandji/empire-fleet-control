import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAdminOrManager, requireSession, handleAccessError } from '@/lib/access';

const commissionSchema = z.object({
  weekStart: z.string(), // ISO date du lundi
  amount: z.number().positive(),
  note: z.string().optional(),
});

// POST /api/owners/[id]/commissions — enregistrer une commission
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    requireAdminOrManager(session.user.role);
    const body = commissionSchema.parse(await req.json());

    const commission = await prisma.ownerCommission.upsert({
      where: { ownerId_weekStart: { ownerId: params.id, weekStart: new Date(body.weekStart) } },
      create: {
        ownerId: params.id,
        weekStart: new Date(body.weekStart),
        amount: body.amount,
        note: body.note,
        enteredById: session.user.id,
      },
      update: {
        amount: body.amount,
        note: body.note,
        enteredById: session.user.id,
      },
    });

    return NextResponse.json(commission, { status: 201 });
  } catch (err) {
    return handleAccessError(err);
  }
}

// DELETE /api/owners/[id]/commissions?weekStart=...
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    requireAdminOrManager(session.user.role);
    const weekStart = req.nextUrl.searchParams.get('weekStart');
    if (!weekStart) return NextResponse.json({ error: 'weekStart requis' }, { status: 400 });

    await prisma.ownerCommission.deleteMany({
      where: { ownerId: params.id, weekStart: new Date(weekStart) },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleAccessError(err);
  }
}
