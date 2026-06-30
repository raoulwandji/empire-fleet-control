import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession, requireAdminOrManager, handleAccessError, logAudit } from '@/lib/access';

// DELETE /api/assignments/[id] — admin + manager
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    requireAdminOrManager(session.user.role);

    await prisma.assignment.delete({ where: { id: params.id } });
    await logAudit(session.user.id, 'DELETE_ASSIGNMENT', 'Assignment', params.id);

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleAccessError(err);
  }
}
