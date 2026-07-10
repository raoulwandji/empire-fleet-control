import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import {
  requireSession,
  handleAccessError,
  logAudit,
  requireCapability,
  requireStructureWriteWindow,
} from '@/lib/access';

const updateSchema = z.object({
  date: z.string().min(1).optional(),
  category: z.string().min(1).optional(),
  label: z.string().min(1).optional(),
  amount: z.number().positive().optional(),
  paymentMode: z.enum(['ESPECES', 'MOBILE_MONEY', 'VIREMENT', 'AUTRE', 'PORTEFEUILLE']).optional(),
  note: z.string().optional(),
});

// PATCH /api/accounting/[id] — corrige une écriture.
// Écriture générale (sans structure) : capacité 'accounting_delete'.
// Écriture de structure : ADMIN toujours, gestionnaire affecté dans les 5h suivant la saisie.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();

    const entry = await prisma.accountingEntry.findUnique({ where: { id: params.id } });
    if (!entry) {
      return NextResponse.json({ error: 'Écriture introuvable.' }, { status: 404 });
    }

    if (entry.businessUnit) {
      await requireStructureWriteWindow(session.user.id, session.user.role, entry.businessUnit, entry.createdAt);
    } else {
      await requireCapability(session.user.id, session.user.role, 'accounting_delete');
    }

    const body = await req.json();
    const data = updateSchema.parse(body);

    const updated = await prisma.accountingEntry.update({
      where: { id: params.id },
      data: { ...data, date: data.date ? new Date(data.date) : undefined },
    });

    await logAudit(session.user.id, 'UPDATE_ACCOUNTING', 'AccountingEntry', updated.id, data);

    return NextResponse.json(updated);
  } catch (err) {
    return handleAccessError(err);
  }
}

// DELETE /api/accounting/[id] — même règle que PATCH ci-dessus.
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();

    const entry = await prisma.accountingEntry.findUnique({ where: { id: params.id } });
    if (!entry) {
      return NextResponse.json({ error: 'Écriture introuvable.' }, { status: 404 });
    }

    if (entry.businessUnit) {
      await requireStructureWriteWindow(session.user.id, session.user.role, entry.businessUnit, entry.createdAt);
    } else {
      await requireCapability(session.user.id, session.user.role, 'accounting_delete');
    }

    await prisma.accountingEntry.delete({ where: { id: params.id } });
    await logAudit(session.user.id, 'DELETE_ACCOUNTING', 'AccountingEntry', params.id);

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleAccessError(err);
  }
}
