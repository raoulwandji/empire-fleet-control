import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession, requireAdminOrManager, handleAccessError, logAudit } from '@/lib/access';

// DELETE /api/accounting/[id] — admin + manager (correction d'écritures)
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    requireAdminOrManager(session.user.role);

    await prisma.accountingEntry.delete({ where: { id: params.id } });
    await logAudit(session.user.id, 'DELETE_ACCOUNTING', 'AccountingEntry', params.id);

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleAccessError(err);
  }
}
