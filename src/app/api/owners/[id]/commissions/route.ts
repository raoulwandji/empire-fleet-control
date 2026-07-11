import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAdminOrManager, requireSession, handleAccessError } from '@/lib/access';

const commissionSchema = z.object({
  weekStart: z.string(), // ISO date du lundi
  amount: z.number().positive(),
  note: z.string().optional(),
});

// POST /api/owners/[id]/commissions — enregistrer une commission.
// Génère/actualise automatiquement une écriture ENTREE dans la structure Empire Drive.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    requireAdminOrManager(session.user.role);
    const body = commissionSchema.parse(await req.json());

    const owner = await prisma.owner.findUnique({ where: { id: params.id }, select: { fullName: true } });
    const date = new Date(body.weekStart);
    const label = `Commission Empire — ${owner?.fullName ?? 'Propriétaire'}`;

    const commission = await prisma.$transaction(async (tx) => {
      const existing = await tx.ownerCommission.findUnique({
        where: { ownerId_weekStart: { ownerId: params.id, weekStart: date } },
      });

      let accountingEntryId = existing?.accountingEntryId ?? null;
      if (accountingEntryId) {
        await tx.accountingEntry.update({
          where: { id: accountingEntryId },
          data: { amount: body.amount, note: body.note, date },
        });
      } else {
        const entry = await tx.accountingEntry.create({
          data: {
            date,
            type: 'ENTREE',
            category: 'Commission Empire',
            label,
            amount: body.amount,
            businessUnit: 'EMPIRE_DRIVE',
            note: body.note,
            enteredById: session.user.id,
          },
        });
        accountingEntryId = entry.id;
      }

      return tx.ownerCommission.upsert({
        where: { ownerId_weekStart: { ownerId: params.id, weekStart: date } },
        create: {
          ownerId: params.id,
          weekStart: date,
          amount: body.amount,
          note: body.note,
          enteredById: session.user.id,
          accountingEntryId,
        },
        update: {
          amount: body.amount,
          note: body.note,
          enteredById: session.user.id,
          accountingEntryId,
        },
      });
    });

    return NextResponse.json(commission, { status: 201 });
  } catch (err) {
    return handleAccessError(err);
  }
}

// DELETE /api/owners/[id]/commissions?weekStart=... — supprime aussi l'écriture liée.
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    requireAdminOrManager(session.user.role);
    const weekStart = req.nextUrl.searchParams.get('weekStart');
    if (!weekStart) return NextResponse.json({ error: 'weekStart requis' }, { status: 400 });

    const date = new Date(weekStart);
    const existing = await prisma.ownerCommission.findUnique({
      where: { ownerId_weekStart: { ownerId: params.id, weekStart: date } },
    });

    await prisma.ownerCommission.deleteMany({ where: { ownerId: params.id, weekStart: date } });
    if (existing?.accountingEntryId) {
      await prisma.accountingEntry.delete({ where: { id: existing.accountingEntryId } }).catch(() => {});
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleAccessError(err);
  }
}
