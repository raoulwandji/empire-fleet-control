import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession, handleAccessError, logAudit } from '@/lib/access';
import { pendingOwnerUpdateSchema } from '@/lib/validation';

// PATCH /api/pending-owners/[id] — tout utilisateur authentifié
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();

    const body = await req.json();
    const data = pendingOwnerUpdateSchema.parse(body);

    const pendingOwner = await prisma.pendingOwner.update({
      where: { id: params.id },
      data,
    });

    await logAudit(session.user.id, 'UPDATE_PENDING_OWNER', 'PendingOwner', pendingOwner.id, data);

    return NextResponse.json(pendingOwner);
  } catch (err) {
    return handleAccessError(err);
  }
}

// DELETE /api/pending-owners/[id] — tout utilisateur authentifié
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();

    await prisma.pendingOwner.delete({ where: { id: params.id } });
    await logAudit(session.user.id, 'DELETE_PENDING_OWNER', 'PendingOwner', params.id);

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleAccessError(err);
  }
}
