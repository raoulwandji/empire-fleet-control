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

// POST — génère automatiquement une écriture SORTIE dans la structure Empire Drive.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    requireAdminOrManager(session.user.role);
    const body = schema.parse(await req.json());

    const owner = await prisma.owner.findUnique({ where: { id: params.id }, select: { fullName: true } });
    const date = new Date(body.weekStart);

    const pref = await prisma.$transaction(async (tx) => {
      const entry = await tx.accountingEntry.create({
        data: {
          date,
          type: 'SORTIE',
          category: 'Préfinancement',
          label: `Préfinancement — ${owner?.fullName ?? 'Propriétaire'}`,
          amount: body.amount,
          businessUnit: 'EMPIRE_DRIVE',
          note: body.note,
          enteredById: session.user.id,
        },
      });

      return tx.ownerPrefinancement.create({
        data: {
          ownerId: params.id,
          driverId: body.driverId || undefined,
          weekStart: date,
          amount: body.amount,
          note: body.note,
          enteredById: session.user.id,
          accountingEntryId: entry.id,
        },
        include: {
          driver: { select: { fullName: true, vehiclePlate: true, code: true } },
          enteredBy: { select: { fullName: true, username: true } },
        },
      });
    });

    return NextResponse.json(pref, { status: 201 });
  } catch (err) {
    return handleAccessError(err);
  }
}

// DELETE — supprime aussi l'écriture comptable liée.
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    requireAdminOrManager(session.user.role);
    const prefId = req.nextUrl.searchParams.get('id');
    if (!prefId) return NextResponse.json({ error: 'id requis' }, { status: 400 });

    const existing = await prisma.ownerPrefinancement.findFirst({ where: { id: prefId, ownerId: params.id } });

    await prisma.ownerPrefinancement.deleteMany({ where: { id: prefId, ownerId: params.id } });
    if (existing?.accountingEntryId) {
      await prisma.accountingEntry.delete({ where: { id: existing.accountingEntryId } }).catch(() => {});
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleAccessError(err);
  }
}
