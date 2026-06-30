import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession, requireAdmin, handleAccessError, logAudit } from '@/lib/access';

// DELETE /api/assignments/[id] — reserve a l'admin
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    requireAdmin(session.user.role);

    await prisma.assignment.delete({ where: { id: params.id } });
    await logAudit(session.user.id, 'DELETE_ASSIGNMENT', 'Assignment', params.id);

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleAccessError(err);
  }
}
