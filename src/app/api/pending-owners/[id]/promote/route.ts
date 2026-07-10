import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession, requireCapability, handleAccessError, logAudit } from '@/lib/access';

// POST /api/pending-owners/[id]/promote
// Intègre un propriétaire en attente à la liste officielle des propriétaires (table Owner),
// puis le retire automatiquement de la liste d'attente.
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    await requireCapability(session.user.id, session.user.role, 'owners');

    const pendingOwner = await prisma.pendingOwner.findUnique({ where: { id: params.id } });
    if (!pendingOwner) {
      return NextResponse.json({ error: 'Propriétaire en attente introuvable.' }, { status: 404 });
    }

    const owner = await prisma.$transaction(async (tx) => {
      const created = await tx.owner.create({
        data: {
          fullName: pendingOwner.fullName,
          phone: pendingOwner.phone,
          location: pendingOwner.location,
        },
      });
      await tx.pendingOwner.delete({ where: { id: pendingOwner.id } });
      return created;
    });

    await logAudit(session.user.id, 'PROMOTE_PENDING_OWNER', 'Owner', owner.id, {
      pendingOwnerId: pendingOwner.id,
      fullName: owner.fullName,
    });

    return NextResponse.json(owner, { status: 201 });
  } catch (err) {
    return handleAccessError(err);
  }
}
