import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession, requireAdmin, handleAccessError, logAudit } from '@/lib/access';

// DELETE /api/structure-assignments/[id] — admin uniquement : retire un gestionnaire d'une structure
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    requireAdmin(session.user.role);

    await prisma.structureAssignment.delete({ where: { id: params.id } });
    await logAudit(session.user.id, 'DELETE_STRUCTURE_ASSIGNMENT', 'StructureAssignment', params.id);

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleAccessError(err);
  }
}
