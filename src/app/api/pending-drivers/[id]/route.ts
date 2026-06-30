import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession, handleAccessError, logAudit } from '@/lib/access';
import { pendingDriverUpdateSchema } from '@/lib/validation';

// PATCH /api/pending-drivers/[id] — admin ET employé (pas de notion d'affectation sur ce pool)
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();

    const body = await req.json();
    const data = pendingDriverUpdateSchema.parse(body);

    const pendingDriver = await prisma.pendingDriver.update({
      where: { id: params.id },
      data,
    });

    await logAudit(session.user.id, 'UPDATE_PENDING_DRIVER', 'PendingDriver', pendingDriver.id, data);

    return NextResponse.json(pendingDriver);
  } catch (err) {
    return handleAccessError(err);
  }
}

// DELETE /api/pending-drivers/[id] — admin ET employé
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();

    await prisma.pendingDriver.delete({ where: { id: params.id } });
    await logAudit(session.user.id, 'DELETE_PENDING_DRIVER', 'PendingDriver', params.id);

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleAccessError(err);
  }
}
